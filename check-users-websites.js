import mongoose from 'mongoose';
import User from './model/User.js';
import Website from './model/Website.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/contlink');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Check users and websites
const checkUsersAndWebsites = async () => {
  try {
    await connectDB();
    
    console.log('Checking users and websites in database...');
    
    // Count users
    const userCount = await User.countDocuments();
    console.log('Total users:', userCount);
    
    if (userCount > 0) {
      // Get sample users
      const users = await User.find().limit(5);
      console.log('Sample users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - Role: ${user.role}`);
      });
    } else {
      console.log('No users found in database');
    }
    
    // Count websites
    const websiteCount = await Website.countDocuments();
    console.log('Total websites:', websiteCount);
    
    if (websiteCount > 0) {
      // Get sample websites
      const websites = await Website.find().limit(5);
      console.log('Sample websites:');
      websites.forEach((website, index) => {
        console.log(`${index + 1}. ${website.domain} - Status: ${website.status} - Owner: ${website.userId}`);
      });
    } else {
      console.log('No websites found in database');
    }
    
    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
};

checkUsersAndWebsites();