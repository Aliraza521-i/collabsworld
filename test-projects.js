import dotenv from 'dotenv';
import connectDB from './config/Db.js';
import Project from './model/Project.js';

dotenv.config();

const testProjects = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Find all projects
    const projects = await Project.find({});
    console.log('Total projects found:', projects.length);
    
    // Print project details
    projects.forEach((project, index) => {
      console.log(`\nProject ${index + 1}:`);
      console.log('ID:', project._id.toString());
      console.log('Title:', project.title);
      console.log('User ID:', project.userId ? project.userId.toString() : 'N/A');
      console.log('Created At:', project.createdAt);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

testProjects();