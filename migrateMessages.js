import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Chat from './model/Chat.js';
import User from './model/User.js';

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database_name');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const migrateMessages = async () => {
  await connectDB();
  
  try {
    console.log('Starting message migration...');
    
    // Find all chats
    const chats = await Chat.find({});
    console.log(`Found ${chats.length} chats to process`);
    
    let totalMessagesUpdated = 0;
    
    for (const chat of chats) {
      console.log(`Processing chat: ${chat._id}`);
      let messagesUpdatedInThisChat = 0;
      
      // Process each message in the chat
      for (const message of chat.messages) {
        // If message doesn't have senderRole or has an invalid value, we need to add it
        if (!message.senderRole || !['publisher', 'advertiser', 'admin', 'user'].includes(message.senderRole)) {
          // Find the participant in this chat to get their role
          const participant = chat.participants.find(p => 
            p.userId && message.senderId && 
            p.userId.toString() === message.senderId.toString()
          );
          
          // If we found the participant, use their role
          if (participant && participant.role && ['publisher', 'advertiser', 'admin', 'user'].includes(participant.role)) {
            message.senderRole = participant.role;
            messagesUpdatedInThisChat++;
          } else if (message.senderId) {
            // If we couldn't find the participant, try to get role from User collection
            try {
              const user = await User.findById(message.senderId);
              if (user && user.role && ['publisher', 'advertiser', 'admin', 'user'].includes(user.role)) {
                message.senderRole = user.role;
                messagesUpdatedInThisChat++;
              } else {
                // Default to 'user' if we can't determine a valid role
                message.senderRole = 'user';
                messagesUpdatedInThisChat++;
              }
            } catch (userError) {
              console.log(`Could not find user for message ${message._id}, setting to 'user' role`);
              message.senderRole = 'user';
              messagesUpdatedInThisChat++;
            }
          } else {
            // Default to 'user' if no senderId
            message.senderRole = 'user';
            messagesUpdatedInThisChat++;
          }
        }
      }
      
      // Save the chat if we updated any messages
      if (messagesUpdatedInThisChat > 0) {
        await chat.save();
        console.log(`Updated ${messagesUpdatedInThisChat} messages in chat ${chat._id}`);
        totalMessagesUpdated += messagesUpdatedInThisChat;
      }
    }
    
    console.log(`Migration completed. Updated ${totalMessagesUpdated} messages in total.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateMessages();