import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colabworld');

const debugDatabase = async () => {
  try {
    console.log('Connected to database');
    
    // Wait for connection
    await mongoose.connection.asPromise();
    
    // Get collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Check if Chat collection exists
    const chatCollection = collections.find(c => c.name === 'chats');
    if (chatCollection) {
      console.log('\nFound chats collection');
      const chatCount = await mongoose.connection.db.collection('chats').countDocuments();
      console.log(`Total chats: ${chatCount}`);
      
      if (chatCount > 0) {
        // Get recent chats
        const chats = await mongoose.connection.db.collection('chats')
          .find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();
        
        console.log(`\nRecent chats:`);
        chats.forEach((chat, index) => {
          console.log(`\n--- Chat ${index + 1} ---`);
          console.log('Chat ID:', chat._id.toString());
          console.log('Chat Type:', chat.chatType);
          console.log('Participants count:', chat.participants ? chat.participants.length : 0);
          
          if (chat.participants) {
            chat.participants.forEach((p, pIndex) => {
              console.log(`  Participant ${pIndex + 1}:`);
              console.log(`    userId: ${p.userId} (type: ${typeof p.userId})`);
              if (p.userId && typeof p.userId === 'object') {
                console.log(`    userId constructor: ${p.userId.constructor.name}`);
              }
              console.log(`    role: ${p.role}`);
              console.log(`    isActive: ${p.isActive}`);
            });
          }
        });
      }
    } else {
      console.log('\nNo chats collection found');
    }
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    mongoose.connection.close();
  }
};

debugDatabase();