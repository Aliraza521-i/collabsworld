require('dotenv').config();
const mongoose = require('mongoose');
const { Notification } = require('./Models/NotificationModel');

async function checkNotifications() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');
    
    // Check notifications for the publisher having issues
    const notifications = await Notification.find({ userId: '68bb681c11a81f535da6ee62' })
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('Recent notifications for publisher 68bb681c11a81f535da6ee62:');
    notifications.forEach(notification => {
      console.log(`- Type: ${notification.type}, Chat ID: ${notification.data?.chatId}, Message: ${notification.message}`);
    });
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

checkNotifications();