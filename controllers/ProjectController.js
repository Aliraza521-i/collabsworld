import { validationResult } from 'express-validator';
import Project from '../model/Project.js';
import User from '../model/User.js'; // Import User model for population

export class ProjectController {
  
  // Create a new project
  static async createProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { 
        title, 
        website, 
        categories, 
        language, 
        budget, 
        minPostBudget, 
        maxPostBudget, 
        postsRequired, 
        description 
      } = req.body;
      
      const project = new Project({
        title,
        website,
        categories,
        language,
        budget,
        minPostBudget,
        maxPostBudget,
        postsRequired,
        description,
        userId: req.user.id,
        stats: {
          finishedPosts: 0,
          activePosts: 0,
          pendingReviews: 0,
          totalOrders: 0
        }
      });
      
      await project.save();
      
      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: project
      });

    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get all projects (admin)
  static async getAllProjects(req, res) {
    try {
      const {
        search,
        status,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = '-1'
      } = req.query;

      const query = {};
      
      // Add search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { website: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Add status filter
      if (status && status !== 'all') {
        query.status = status;
      }

      // Validate sortBy field
      const allowedSortFields = ['createdAt', 'title', 'website'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      
      // Validate sortOrder
      const sortValue = sortOrder === '-1' ? -1 : 1;
      
      // Build sort object properly
      const sortObj = {};
      sortObj[sortField] = sortValue;

      const projects = await Project.find(query)
        .populate('userId', 'firstName lastName email')
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Project.countDocuments(query);
      
      res.json({
        success: true,
        data: projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get all projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve projects',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get projects for a specific advertiser
  static async getAdvertiserProjects(req, res) {
    try {
      const {
        search,
        status,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = '-1'
      } = req.query;

      const query = { userId: req.user.id };
      
      // Add search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { website: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Add status filter
      if (status && status !== 'all') {
        query.status = status;
      }

      // Validate sortBy field
      const allowedSortFields = ['createdAt', 'title', 'website'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      
      // Validate sortOrder
      const sortValue = sortOrder === '-1' ? -1 : 1;
      
      // Build sort object properly
      const sortObj = {};
      sortObj[sortField] = sortValue;

      const projects = await Project.find(query)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await Project.countDocuments(query);
      
      res.json({
        success: true,
        data: projects,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get advertiser projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve projects',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get a specific project by ID
  static async getProjectById(req, res) {
    try {
      const { id } = req.params;
      
      console.log('=== DEBUG: getProjectById ===');
      console.log('Received ID parameter:', id);
      console.log('Type of ID:', typeof id);
      console.log('Request params:', req.params);
      console.log('Request user:', req.user);
      
      // Check if ID is undefined or null
      if (!id) {
        console.log('ERROR: No ID provided');
        return res.status(400).json({
          success: false,
          message: 'Project ID is required'
        });
      }
      
      // Check if ID is a valid ObjectId
      if (id === 'undefined' || id === 'null') {
        console.log('ERROR: Invalid ID value:', id);
        return res.status(400).json({
          success: false,
          message: 'Invalid project ID'
        });
      }
      
      console.log('Attempting to find project with ID:', id);
      const project = await Project.findById(id)
        .populate('userId', 'firstName lastName email');
      
      console.log('Project found in database:', project);
      
      if (!project) {
        console.log('ERROR: Project not found in database');
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if user is authorized to view this project
      // When populated, project.userId is an object, otherwise it's an ObjectId
      const projectUserId = project.userId ? 
        (typeof project.userId === 'object' ? project.userId._id.toString() : project.userId.toString()) : 
        null;
      
      console.log('Project user ID:', projectUserId);
      console.log('Request user ID:', req.user.id);
      console.log('User role:', req.user.role);
      console.log('Is admin:', req.user.role === 'admin');
      console.log('Is owner:', projectUserId === req.user.id);
      
      if (req.user.role !== 'admin' && projectUserId !== req.user.id) {
        console.log('ERROR: User not authorized to view this project');
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this project'
        });
      }
      
      console.log('SUCCESS: Returning project data');
      res.json({
        success: true,
        data: project
      });

    } catch (error) {
      console.error('Get project by ID error:', error);
      // Check if it's a CastError (invalid ObjectId)
      if (error.name === 'CastError') {
        console.log('ERROR: Invalid ObjectId format');
        return res.status(400).json({
          success: false,
          message: 'Invalid project ID format',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update a project
  static async updateProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = req.body;
      
      const project = await Project.findById(id);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if user is authorized to update this project
      // When populated, project.userId is an object, otherwise it's an ObjectId
      const projectUserId = project.userId ? 
        (typeof project.userId === 'object' ? project.userId._id.toString() : project.userId.toString()) : 
        null;
      
      if (req.user.role !== 'admin' && projectUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this project'
        });
      }
      
      // Update project fields
      Object.keys(updateData).forEach(key => {
        if (key !== 'userId' && key !== '_id') { // Don't allow updating userId or _id
          project[key] = updateData[key];
        }
      });
      
      await project.save();
      
      res.json({
        success: true,
        message: 'Project updated successfully',
        data: project
      });

    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Delete a project
  static async deleteProject(req, res) {
    try {
      const { id } = req.params;
      
      const project = await Project.findById(id);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if user is authorized to delete this project
      // When populated, project.userId is an object, otherwise it's an ObjectId
      const projectUserId = project.userId ? 
        (typeof project.userId === 'object' ? project.userId._id.toString() : project.userId.toString()) : 
        null;
      
      if (req.user.role !== 'admin' && projectUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to delete this project'
        });
      }
      
      await Project.findByIdAndDelete(id);
      
      res.json({
        success: true,
        message: 'Project deleted successfully'
      });

    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update project statistics
  static async updateProjectStats(req, res) {
    try {
      const { id } = req.params;
      const { stats } = req.body;
      
      const project = await Project.findById(id);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Check if user is authorized to update this project
      // When populated, project.userId is an object, otherwise it's an ObjectId
      const projectUserId = project.userId ? 
        (typeof project.userId === 'object' ? project.userId._id.toString() : project.userId.toString()) : 
        null;
      
      if (req.user.role !== 'admin' && projectUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this project'
        });
      }
      
      // Update stats
      Object.keys(stats).forEach(key => {
        if (project.stats.hasOwnProperty(key)) {
          project.stats[key] = stats[key];
        }
      });
      
      await project.save();
      
      res.json({
        success: true,
        message: 'Project statistics updated successfully',
        data: project
      });

    } catch (error) {
      console.error('Update project stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update project statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default ProjectController;