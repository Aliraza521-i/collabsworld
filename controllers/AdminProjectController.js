import { validationResult } from 'express-validator';
import Project from '../model/Project.js';

export class AdminProjectController {
  
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

  // Get a specific project by ID (admin)
  static async getProjectById(req, res) {
    try {
      const { projectId } = req.params;
      
      const project = await Project.findById(projectId)
        .populate('userId', 'firstName lastName email');
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      res.json({
        success: true,
        data: project
      });

    } catch (error) {
      console.error('Get project by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve project',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update a project (admin)
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

      const { projectId } = req.params;
      const updateData = req.body;
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Update project fields (admin can update any field)
      Object.keys(updateData).forEach(key => {
        if (key !== '_id') { // Don't allow updating _id
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

  // Delete a project (admin)
  static async deleteProject(req, res) {
    try {
      const { projectId } = req.params;
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      await Project.findByIdAndDelete(projectId);
      
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

  // Update project status (admin)
  static async updateProjectStatus(req, res) {
    try {
      const { projectId } = req.params;
      const { status } = req.body;
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      // Validate status
      const allowedStatuses = ['active', 'completed', 'pending', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }
      
      project.status = status;
      await project.save();
      
      res.json({
        success: true,
        message: 'Project status updated successfully',
        data: project
      });

    } catch (error) {
      console.error('Update project status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update project status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get project statistics (admin)
  static async getProjectStats(req, res) {
    try {
      const { projectId } = req.params;
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      res.json({
        success: true,
        data: project.stats
      });

    } catch (error) {
      console.error('Get project stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve project statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update project statistics (admin)
  static async updateProjectStats(req, res) {
    try {
      const { projectId } = req.params;
      const { stats } = req.body;
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
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

export default AdminProjectController;