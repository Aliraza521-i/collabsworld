import mongoose from 'mongoose';
import User from './model/User.js';
import Website from './model/Website.js';
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

// Create sample data
const populateSampleData = async () => {
  try {
    await connectDB();
    
    console.log('Populating sample data...');
    
    // Clear existing data
    await User.deleteMany({});
    await Website.deleteMany({});
    await Order.deleteMany({});
    
    console.log('Cleared existing data');
    
    // Create sample users
    const publisher = new User({
      firstName: 'John',
      lastName: 'Publisher',
      email: 'publisher@example.com',
      password: 'password123',
      role: 'publisher',
      profileImage: null
    });
    
    const advertiser = new User({
      firstName: 'Jane',
      lastName: 'Advertiser',
      email: 'advertiser@example.com',
      password: 'password123',
      role: 'advertiser',
      profileImage: null
    });
    
    await publisher.save();
    await advertiser.save();
    
    console.log('Created sample users');
    
    // Create sample website
    const website = new Website({
      domain: 'techblog.com',
      userId: publisher._id,
      siteDescription: 'A technology blog covering the latest trends and innovations',
      category: 'Technology',
      keywords: ['technology', 'innovation', 'AI', 'machine learning'],
      country: 'United States',
      mainLanguage: 'English',
      advertisingRequirements: 'No adult content, no gambling',
      publishingSections: 'Blog posts, news articles',
      publishingPrice: 50,
      copywritingPrice: 25,
      status: 'approved',
      metrics: {
        da: 50,
        dr: 45,
        monthlyTraffic: 10000
      }
    });
    
    await website.save();
    
    console.log('Created sample website');
    
    // Create sample orders with different statuses
    const orders = [
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'AI Technology Trends 2025',
        description: 'Write an article about the latest AI technology trends',
        contentRequirements: {
          wordCount: 800,
          targetUrl: 'https://example.com/ai-trends',
          anchorText: 'AI Technology Trends',
          linkType: 'dofollow',
          additionalInstructions: 'Focus on machine learning and neural networks'
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
        title: 'Machine Learning Applications',
        description: 'Explore real-world applications of machine learning',
        contentRequirements: {
          wordCount: 1000,
          targetUrl: 'https://example.com/ml-applications',
          anchorText: 'Machine Learning Applications',
          linkType: 'nofollow',
          additionalInstructions: 'Include case studies and examples'
        },
        basePrice: 60,
        additionalCharges: {
          copywriting: 25,
          rushOrder: 0,
          premium: 0
        },
        totalPrice: 85,
        platformCommission: 8.5,
        publisherEarnings: 76.5,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        rushOrder: false,
        status: 'approved'
      },
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'Blockchain in Finance',
        description: 'How blockchain technology is revolutionizing finance',
        contentRequirements: {
          wordCount: 900,
          targetUrl: 'https://example.com/blockchain-finance',
          anchorText: 'Blockchain in Finance',
          linkType: 'dofollow',
          additionalInstructions: 'Focus on cryptocurrency and smart contracts'
        },
        basePrice: 55,
        additionalCharges: {
          copywriting: 22,
          rushOrder: 0,
          premium: 6
        },
        totalPrice: 83,
        platformCommission: 8.3,
        publisherEarnings: 74.7,
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        rushOrder: false,
        status: 'completed'
      },
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'Cloud Computing Benefits',
        description: 'Benefits and challenges of cloud computing for businesses',
        contentRequirements: {
          wordCount: 750,
          targetUrl: 'https://example.com/cloud-computing',
          anchorText: 'Cloud Computing Benefits',
          linkType: 'nofollow',
          additionalInstructions: 'Include security considerations'
        },
        basePrice: 45,
        additionalCharges: {
          copywriting: 18,
          rushOrder: 0,
          premium: 0
        },
        totalPrice: 63,
        platformCommission: 6.3,
        publisherEarnings: 56.7,
        deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        rushOrder: false,
        status: 'revision_requested'
      },
      {
        publisherId: publisher._id,
        advertiserId: advertiser._id,
        websiteId: website._id,
        title: 'Cybersecurity Best Practices',
        description: 'Essential cybersecurity practices for small businesses',
        contentRequirements: {
          wordCount: 850,
          targetUrl: 'https://example.com/cybersecurity',
          anchorText: 'Cybersecurity Best Practices',
          linkType: 'dofollow',
          additionalInstructions: 'Include recent threats and prevention methods'
        },
        basePrice: 52,
        additionalCharges: {
          copywriting: 21,
          rushOrder: 8,
          premium: 4
        },
        totalPrice: 85,
        platformCommission: 8.5,
        publisherEarnings: 76.5,
        deadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
        rushOrder: true,
        status: 'rejected'
      }
    ];
    
    // Save orders
    for (let i = 0; i < orders.length; i++) {
      const order = new Order(orders[i]);
      await order.save();
      console.log(`Created order: ${order.orderId} with status: ${order.status}`);
    }
    
    console.log('Sample data populated successfully!');
    
    // Verify data
    const userCount = await User.countDocuments();
    const websiteCount = await Website.countDocuments();
    const orderCount = await Order.countDocuments();
    
    console.log(`Verification - Users: ${userCount}, Websites: ${websiteCount}, Orders: ${orderCount}`);
    
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

populateSampleData();