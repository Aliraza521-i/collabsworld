import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Chat from './model/Chat.js';

dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colabworld');

const testChatCreation = async () => {
  try {
    console.log('Testing chat creation...');
    
    // Create a test chat
    const chat = new Chat({
      chatId: 'TEST-CHAT-001',
      chatType: 'general',
      participants: [
        { 
          userId: new mongoose.Types.ObjectId('68bb681c11a81f535da6ee62'), 
          role: 'publisher', 
          joinedAt: new Date(), 
          isActive: true 
        },
        { 
          userId: new mongoose.Types.ObjectId('68ba0c42b4b42dc1145be1b9'), 
          role: 'advertiser', 
          joinedAt: new Date(), 
          isActive: true 
        }
      ],
      title: 'Test Chat',
      description: 'Test chat for debugging',
      status: 'active',
      priority: 'normal'
    });

    console.log('Saving chat...');
    const savedChat = await chat.save();
    console.log('Chat saved successfully!');
    console.log('Chat ID:', savedChat._id.toString());
    
    // Check the participants
    console.log('Participants:');
    savedChat.participants.forEach((p, index) => {
      console.log(`  Participant ${index + 1}:`);
      console.log(`    userId: ${p.userId} (type: ${typeof p.userId})`);
      console.log(`    userId constructor: ${p.userId.constructor.name}`);
      console.log(`    role: ${p.role}`);
    });
    
    // Now try to find it
    console.log('\nFinding chat by ID...');
    const foundChat = await Chat.findById(savedChat._id);
    console.log('Found chat:');
    console.log('Chat ID:', foundChat._id.toString());
    console.log('Participants:');
    foundChat.participants.forEach((p, index) => {
      console.log(`  Participant ${index + 1}:`);
      console.log(`    userId: ${p.userId} (type: ${typeof p.userId})`);
      console.log(`    userId constructor: ${p.userId.constructor.name}`);
      console.log(`    role: ${p.role}`);
    });
    
    // Test participant lookup
    const testUserId = '68ba0c42b4b42dc1145be1b9';
    console.log(`\nChecking if user ${testUserId} is a participant:`);
    const isParticipant = foundChat.participants.some(p => {
      const participantId = p.userId.toString();
      const match = participantId === testUserId;
      console.log(`  Comparing ${participantId} with ${testUserId} - Match: ${match}`);
      return match;
    });
    console.log(`User is participant: ${isParticipant}`);
    
    // Clean up - delete the test chat
    await Chat.findByIdAndDelete(savedChat._id);
    console.log('\nTest chat deleted.');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    mongoose.connection.close();
  }
};

testChatCreation();