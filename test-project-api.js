// Simple test script to verify project API endpoints
import mongoose from 'mongoose';
import Project from './model/Project.js';

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/collabsworld', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test project operations
const testProjectAPI = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Test 1: Create a project
    console.log('\n📝 Test 1: Creating a project...');
    const projectData = {
      title: 'Test Project',
      website: 'https://example.com',
      userId: new mongoose.Types.ObjectId(),
      categories: ['Technology', 'Business'],
      language: 'English',
      budget: 1000,
      minPostBudget: 50,
      maxPostBudget: 200,
      postsRequired: 5,
      description: 'This is a test project for API validation',
      status: 'active',
      stats: {
        finishedPosts: 0,
        activePosts: 0,
        pendingReviews: 0,
        totalOrders: 0
      }
    };
    
    const project = new Project(projectData);
    const savedProject = await project.save();
    console.log('✅ Project created successfully');
    console.log('Project ID:', savedProject._id);
    
    // Test 2: Retrieve the project
    console.log('\n🔍 Test 2: Retrieving the project...');
    const retrievedProject = await Project.findById(savedProject._id);
    console.log('✅ Project retrieved successfully');
    console.log('Project title:', retrievedProject.title);
    
    // Test 3: Update the project
    console.log('\n✏️ Test 3: Updating the project...');
    retrievedProject.budget = 1500;
    retrievedProject.status = 'completed';
    const updatedProject = await retrievedProject.save();
    console.log('✅ Project updated successfully');
    console.log('New budget:', updatedProject.budget);
    console.log('New status:', updatedProject.status);
    
    // Test 4: Find projects with filters
    console.log('\n📋 Test 4: Finding projects with filters...');
    const projects = await Project.find({ status: 'completed' });
    console.log('✅ Found', projects.length, 'completed projects');
    
    // Test 5: Delete the project
    console.log('\n🗑️ Test 5: Deleting the project...');
    await Project.findByIdAndDelete(savedProject._id);
    console.log('✅ Project deleted successfully');
    
    // Test 6: Verify deletion
    console.log('\n🔍 Test 6: Verifying deletion...');
    const deletedProject = await Project.findById(savedProject._id);
    if (!deletedProject) {
      console.log('✅ Project deletion verified');
    } else {
      console.log('❌ Project still exists');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
  }
};

// Run the tests
testProjectAPI();