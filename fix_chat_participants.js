import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Chat from './model/Chat.js';

dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colabworld');

const fixChatParticipants = async () => {
  try {
    console.log('Looking for chats with string user IDs...');
    
    // Find all chats
    const chats = await Chat.find({});
    
    console.log(`Found ${chats.length} chats to check`);
    
    let fixedCount = 0;
    
    for (const chat of chats) {
      let needsUpdate = false;
      const fixedParticipants = [];
      
      for (const participant of chat.participants) {
        // Check if userId is a string instead of ObjectId
        if (typeof participant.userId === 'string') {
          console.log(`Fixing chat ${chat._id}: Converting string userId to ObjectId`);
          console.log(`  Old userId: ${participant.userId} (type: ${typeof participant.userId})`);
          
          // Convert string to ObjectId
          try {
            const objectId = new mongoose.Types.ObjectId(participant.userId);
            fixedParticipants.push({
              ...participant,
              userId: objectId
            });
            needsUpdate = true;
            console.log(`  New userId: ${objectId} (type: ${typeof objectId})`);
          } catch (error) {
            console.error(`  Error converting ${participant.userId} to ObjectId:`, error.message);
            // Keep the original participant if conversion fails
            fixedParticipants.push(participant);
          }
        } else {
          // Keep participants that are already correct
          fixedParticipants.push(participant);
        }
      }
      
      // Update the chat if needed
      if (needsUpdate) {
        chat.participants = fixedParticipants;
        await chat.save();
        console.log(`Updated chat ${chat._id}`);
        fixedCount++;
      }
    }
    
    console.log(`\nFixed ${fixedCount} chats with string user IDs`);
    
  } catch (error) {
    console.error('Fix error:', error);
  } finally {
    mongoose.connection.close();
  }
};

fixChatParticipants();