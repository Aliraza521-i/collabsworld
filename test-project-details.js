// Test script for Project Details API
import axios from 'axios';

// Base URL for the API
const BASE_URL = 'http://localhost:3000/api/v1';

// Advertiser credentials (you'll need to use a real advertiser token)
const ADVERTISER_TOKEN = 'YOUR_ADVERTISER_JWT_TOKEN_HERE';

// Create axios instance with advertiser token
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADVERTISER_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testProjectDetailsAPI() {
  try {
    console.log('Testing Project Details API...\n');

    // 1. Get all projects for the advertiser
    console.log('1. Getting all projects...');
    const allProjects = await api.get('/advertiser/projects');
    console.log('Success:', allProjects.data.success);
    console.log('Total projects:', allProjects.data.pagination?.total || 0);
    
    if (allProjects.data.data && allProjects.data.data.length > 0) {
      const projectId = allProjects.data.data[0]._id;
      console.log(`First project ID: ${projectId}`);
      
      // 2. Get details for the first project
      console.log(`\n2. Getting details for project ${projectId}...`);
      const projectDetails = await api.get(`/advertiser/projects/${projectId}`);
      console.log('Success:', projectDetails.data.success);
      console.log('Project title:', projectDetails.data.data?.title || 'None');
      console.log('Project website:', projectDetails.data.data?.website || 'None');
      
      console.log('\nProject details retrieved successfully!');
    } else {
      console.log('No projects found for this advertiser.');
    }

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testProjectDetailsAPI();