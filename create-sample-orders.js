import mongoose from 'mongoose';
import Order from './model/Order.js';
import Website from './model/Website.js';
import User from './model/User.js';
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

// Create sample orders
const createSampleOrders = async () => {
  try {
    await connectDB();
    
    console.log('Creating sample orders...');
    
    // Check if we have users and websites
    const users = await User.find();
    const websites = await Website.find();
    
    console.log(`Found ${users.length} users and ${websites.length} websites`);
    
    if (users.length < 2) {
      console.log('Need at least 2 users (publisher and advertiser)');
      await mongoose.connection.close();
      return;
    }
    
    if (websites.length < 1) {
      console.log('Need at least 1 website');
      await mongoose.connection.close();
      return;
    }
    
    // Select publisher and advertiser
    const publisher = users[0];
    const advertiser = users.length > 1 ? users[1] : users[0];
    const website = websites[0];
    
    console.log(`Using publisher: ${publisher._id}, advertiser: ${advertiser._id}, website: ${website._id}`);
    
    // Create sample orders with different statuses
    const sampleOrders = [
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'Sample Blog Post Order',
        description: 'Create a blog post about technology trends',
        contentRequirements: {
          wordCount: 800,
          targetUrl: 'https://example.com/tech-trends',
          anchorText: 'Technology Trends 2025',
          linkType: 'dofollow',
          additionalInstructions: 'Focus on AI and machine learning developments'
        },
        basePrice: 50,
        additionalCharges: {
          copywriting: 20,
          rushOrder: 10,
          premium: 5
        },
        totalPrice: 85,
        platformCommission: 8.5,
        publisherEarnings: 76.5,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        rushOrder: true,
        status: 'pending'
      },
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'Product Review Order',
        description: 'Write a detailed review of our new product',
        contentRequirements: {
          wordCount: 1000,
          targetUrl: 'https://example.com/product-review',
          anchorText: 'Best Product Review',
          linkType: 'nofollow',
          additionalInstructions: 'Include pros and cons with images'
        },
        basePrice: 75,
        additionalCharges: {
          copywriting: 30,
          rushOrder: 0,
          premium: 0
        },
        totalPrice: 105,
        platformCommission: 10.5,
        publisherEarnings: 94.5,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        rushOrder: false,
        status: 'approved'
      },
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'News Article Order',
        description: 'Create a news article about industry developments',
        contentRequirements: {
          wordCount: 600,
          targetUrl: 'https://example.com/news',
          anchorText: 'Industry News',
          linkType: 'dofollow',
          additionalInstructions: 'Focus on recent developments in the field'
        },
        basePrice: 40,
        additionalCharges: {
          copywriting: 15,
          rushOrder: 0,
          premium: 8
        },
        totalPrice: 63,
        platformCommission: 6.3,
        publisherEarnings: 56.7,
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        rushOrder: false,
        status: 'completed'
      }
    ];
    
    // Create the orders
    for (let i = 0; i < sampleOrders.length; i++) {
      const orderData = sampleOrders[i];
      const order = new Order(orderData);
      await order.save();
      console.log(`Created order ${order.orderId} with status: ${order.status}`);
    }
    
    console.log('Sample orders created successfully!');
    
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

createSampleOrders();