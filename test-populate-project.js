import dotenv from 'dotenv';
import connectDB from './config/Db.js';
import Project from './model/Project.js';
import User from './model/User.js'; // Import User model

dotenv.config();

const testPopulateProject = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Try to fetch a specific project with population
    const projectId = '68e43e6d1248eefa8576db1a'; // Use the ID of the third project
    console.log('Fetching project with ID:', projectId);
    
    const project = await Project.findById(projectId).populate('userId', 'firstName lastName email');
    console.log('Project found with population:', project);
    console.log('Project userId:', project.userId);
    console.log('Project userId type:', typeof project.userId);
    if (project.userId) {
      console.log('Project userId toString():', project.userId.toString());
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testPopulateProject();