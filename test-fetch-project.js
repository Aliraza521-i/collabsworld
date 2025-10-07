import dotenv from 'dotenv';
import connectDB from './config/Db.js';
import Project from './model/Project.js';

dotenv.config();

const testFetchProject = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Try to fetch a specific project
    const projectId = '68e43e6d1248eefa8576db1a'; // Use the ID of the third project
    console.log('Fetching project with ID:', projectId);
    
    const project = await Project.findById(projectId);
    console.log('Project found:', project);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testFetchProject();