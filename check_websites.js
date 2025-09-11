import mongoose from 'mongoose';
require('./config/Db');
const Website = require('./model/Website');

async function checkWebsites() {
  try {
    const websites = await Website.find({});
    console.log('Websites in database:');
    websites.forEach(website => {
      console.log(`ID: ${website._id}, Domain: ${website.domain}, Status: ${website.status}`);
    });
  } catch (error) {
    console.error('Error fetching websites:', error);
  } finally {
    process.exit(0);
  }
}

checkWebsites();