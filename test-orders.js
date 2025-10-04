import mongoose from 'mongoose';
import Order from './model/Order.js';
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

// Test orders
const testOrders = async () => {
  try {
    await connectDB();
    
    console.log('Checking orders in database...');
    
    // Count total orders
    const totalOrders = await Order.countDocuments();
    console.log('Total orders in database:', totalOrders);
    
    if (totalOrders > 0) {
      // Get sample orders
      const sampleOrders = await Order.find().limit(5);
      console.log('Sample orders:');
      sampleOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order.orderId}, Status: ${order.status}, Publisher ID: ${order.publisherId}, Advertiser ID: ${order.advertiserId}`);
      });
      
      // Check orders with different statuses
      const statusCounts = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      console.log('Order status distribution:');
      statusCounts.forEach(status => {
        console.log(`  ${status._id}: ${status.count}`);
      });
    } else {
      console.log('No orders found in database');
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

testOrders();