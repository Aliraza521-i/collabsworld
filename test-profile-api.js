// Simple test script to verify profile API functionality
import axios from 'axios';

// Test the profile API endpoints
async function testProfileAPI() {
  try {
    console.log('Testing profile API endpoints...');
    
    // Test register endpoint
    const registerResponse = await axios.post('http://localhost:5000/api/v1/register', {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      phoneNumber: '1234567890',
      role: 'publisher'
    });
    
    console.log('Register response:', registerResponse.data);
    
    // Test login endpoint
    const loginResponse = await axios.post('http://localhost:5000/api/v1/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    console.log('Login response:', loginResponse.data);
    
    // Extract token from response
    const token = loginResponse.data.token;
    
    if (token) {
      // Test get profile endpoint
      const profileResponse = await axios.get('http://localhost:5000/api/v1/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Profile response:', profileResponse.data);
      
      // Test update profile endpoint
      const updateResponse = await axios.put('http://localhost:5000/api/v1/profile', {
        firstName: 'Updated',
        lastName: 'User'
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Update profile response:', updateResponse.data);
    }
  } catch (error) {
    console.error('Error testing profile API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testProfileAPI();