require('./config/Db');
const mongoose = require('mongoose');
const Website = require('./model/Website');

async function testWebsite() {
  try {
    // Replace this with an actual website ID from your database
    const websiteId = process.argv[2]; // Pass website ID as command line argument
    
    if (!websiteId) {
      console.log('Please provide a website ID as argument');
      const websites = await Website.find({}).limit(5);
      console.log('Available websites:');
      websites.forEach(w => {
        console.log(`ID: ${w._id}, Domain: ${w.domain}, Status: ${w.status}`);
      });
      return;
    }
    
    console.log('Testing with website ID:', websiteId);
    console.log('Is valid ObjectId:', mongoose.Types.ObjectId.isValid(websiteId));
    
    const website = await Website.findById(websiteId);
    console.log('Found website:', website);
    
    if (website) {
      console.log('Website details:');
      console.log('- Domain:', website.domain);
      console.log('- Status:', website.status);
      console.log('- User ID:', website.userId);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testWebsite();