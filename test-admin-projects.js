// Test script for Admin Project Management API
import axios from 'axios';

// Base URL for the API
const BASE_URL = 'http://localhost:3000/api/v1';

// Admin credentials (you'll need to use a real admin token)
const ADMIN_TOKEN = 'YOUR_ADMIN_JWT_TOKEN_HERE';

// Create axios instance with admin token
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testAdminProjectAPI() {
  try {
    console.log('Testing Admin Project Management API...\n');

    // 1. Get all projects
    console.log('1. Getting all projects...');
    const allProjects = await api.get('/admin/projects');
    console.log('Success:', allProjects.data.success);
    console.log('Total projects:', allProjects.data.pagination?.total || 0);
    console.log('First project ID:', allProjects.data.data?.[0]?._id || 'None');
    console.log('');

    // 2. If there are projects, test getting a specific project
    if (allProjects.data.data && allProjects.data.data.length > 0) {
      const projectId = allProjects.data.data[0]._id;
      console.log(`2. Getting project ${projectId}...`);
      const project = await api.get(`/admin/projects/${projectId}`);
      console.log('Success:', project.data.success);
      console.log('Project title:', project.data.data?.title || 'None');
      console.log('');

      // 3. Test getting project stats
      console.log(`3. Getting stats for project ${projectId}...`);
      const stats = await api.get(`/admin/projects/${projectId}/stats`);
      console.log('Success:', stats.data.success);
      console.log('Stats:', stats.data.data || 'None');
      console.log('');
    }

    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testAdminProjectAPI();