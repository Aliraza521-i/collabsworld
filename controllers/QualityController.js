import { validationResult } from 'express-validator';
import { QualityCheck, QualityReviewer, QualityTemplate } from '../Models/QualityModel.js';
import QualityAssuranceService from '../services/QualityService.js';
import Order from '../model/Order.js';
// ContentModel would be imported here if needed

export class QualityController {
  
  // Create quality check for order
  static async createQualityCheck(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { orderId } = req.body;
      
      const qualityCheck = await QualityAssuranceService.createQualityCheck(orderId);
      
      res.status(201).json({
        success: true,
        message: 'Quality check created successfully',
        qualityCheck
      });

    } catch (error) {
      console.error('Create quality check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quality check',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Run automated checks on content
  static async runAutomatedChecks(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { qualityCheckId } = req.params;
      const { content } = req.body;
      
      const qualityCheck = await QualityAssuranceService.runAutomatedChecks(qualityCheckId, content);
      
      res.json({
        success: true,
        message: 'Automated checks completed',
        qualityCheck
      });

    } catch (error) {
      console.error('Run automated checks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run automated checks',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get quality check details
  static async getQualityCheck(req, res) {
    try {
      const { qualityCheckId } = req.params;
      
      const qualityCheck = await QualityCheck.findById(qualityCheckId)
        .populate('orderId websiteId reviewerId assignedTo')
        .populate({
          path: 'manualReview.comments.reviewerId',
          select: 'firstName lastName email'
        })
        .populate({
          path: 'revisionHistory.submittedBy',
          select: 'firstName lastName email'
        });
      
      if (!qualityCheck) {
        return res.status(404).json({
          success: false,
          message: 'Quality check not found'
        });
      }
      
      res.json({
        success: true,
        qualityCheck
      });

    } catch (error) {
      console.error('Get quality check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quality check',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get quality checks with filters
  static async getQualityChecks(req, res) {
    try {
      const {
        status,
        priority,
        assignedTo,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = '-1'
      } = req.query;

      const query = {};
      
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (assignedTo) query.assignedTo = assignedTo;

      // Validate sortBy field
      const allowedSortFields = ['createdAt', 'priority', 'deadline'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
      
      // Validate sortOrder
      const sortValue = sortOrder === '-1' ? -1 : 1;
      
      // Build sort object properly
      const sortObj = {};
      sortObj[sortField] = sortValue;

      const qualityChecks = await QualityCheck.find(query)
        .populate('orderId websiteId reviewerId assignedTo')
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await QualityCheck.countDocuments(query);
      
      res.json({
        success: true,
        qualityChecks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Get quality checks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quality checks',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Assign quality check to reviewer
  static async assignReviewer(req, res) {
    try {
      const { qualityCheckId } = req.params;
      
      const qualityCheck = await QualityAssuranceService.assignReviewer(qualityCheckId);
      
      res.json({
        success: true,
        message: 'Reviewer assigned successfully',
        qualityCheck
      });

    } catch (error) {
      console.error('Assign reviewer error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign reviewer',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Start manual review
  static async startManualReview(req, res) {
    try {
      const { qualityCheckId } = req.params;
      const reviewerId = req.user.id;
      
      const qualityCheck = await QualityCheck.findById(qualityCheckId);
      if (!qualityCheck) {
        return res.status(404).json({
          success: false,
          message: 'Quality check not found'
        });
      }

      // Check if user is assigned reviewer
      if (qualityCheck.assignedTo.toString() !== reviewerId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to review this quality check'
        });
      }

      qualityCheck.status = 'in_progress';
      qualityCheck.manualReview.reviewStartedAt = new Date();
      
      await qualityCheck.save();
      
      res.json({
        success: true,
        message: 'Manual review started',
        qualityCheck
      });

    } catch (error) {
      console.error('Start manual review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start manual review',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Complete manual review
  static async completeManualReview(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { qualityCheckId } = req.params;
      const { verdict, comments } = req.body;
      const reviewerId = req.user.id;
      
      const qualityCheck = await QualityAssuranceService.completeManualReview(
        qualityCheckId, 
        reviewerId, 
        verdict, 
        comments
      );
      
      res.json({
        success: true,
        message: 'Manual review completed',
        qualityCheck
      });

    } catch (error) {
      console.error('Complete manual review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete manual review',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Add comment to quality check
  static async addComment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { qualityCheckId } = req.params;
      const { text } = req.body;
      const reviewerId = req.user.id;
      
      const qualityCheck = await QualityAssuranceService.addComment(
        qualityCheckId, 
        reviewerId, 
        text
      );
      
      res.json({
        success: true,
        message: 'Comment added successfully',
        qualityCheck
      });

    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add comment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Submit revision for quality check
  static async submitRevision(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { qualityCheckId } = req.params;
      const { changes } = req.body;
      const userId = req.user.id;
      
      const qualityCheck = await QualityAssuranceService.submitRevision(
        qualityCheckId, 
        userId, 
        changes
      );
      
      res.json({
        success: true,
        message: 'Revision submitted successfully',
        qualityCheck
      });

    } catch (error) {
      console.error('Submit revision error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit revision',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get overdue quality checks
  static async getOverdueQualityChecks(req, res) {
    try {
      const overdueChecks = await QualityAssuranceService.getOverdueQualityChecks();
      
      res.json({
        success: true,
        overdueChecks
      });

    } catch (error) {
      console.error('Get overdue checks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve overdue quality checks',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get quality checks by reviewer
  static async getQualityChecksByReviewer(req, res) {
    try {
      const { status } = req.query;
      const reviewerId = req.user.id;
      
      const qualityChecks = await QualityAssuranceService.getQualityChecksByReviewer(reviewerId, status);
      
      res.json({
        success: true,
        qualityChecks
      });

    } catch (error) {
      console.error('Get checks by reviewer error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quality checks',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Quality Reviewer Management
  static async createQualityReviewer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const reviewerData = req.body;
      
      const reviewer = await QualityAssuranceService.createQualityReviewer(userId, reviewerData);
      
      res.status(201).json({
        success: true,
        message: 'Quality reviewer created successfully',
        reviewer
      });

    } catch (error) {
      console.error('Create quality reviewer error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quality reviewer',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async updateQualityReviewer(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const updateData = req.body;
      
      const reviewer = await QualityAssuranceService.updateQualityReviewer(userId, updateData);
      
      if (!reviewer) {
        return res.status(404).json({
          success: false,
          message: 'Quality reviewer not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Quality reviewer updated successfully',
        reviewer
      });

    } catch (error) {
      console.error('Update quality reviewer error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quality reviewer',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async getQualityReviewer(req, res) {
    try {
      const { userId } = req.params;
      
      const reviewer = await QualityAssuranceService.getQualityReviewer(userId);
      
      if (!reviewer) {
        return res.status(404).json({
          success: false,
          message: 'Quality reviewer not found'
        });
      }
      
      res.json({
        success: true,
        reviewer
      });

    } catch (error) {
      console.error('Get quality reviewer error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quality reviewer',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Quality Template Management
  static async createQualityTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const templateData = {
        ...req.body,
        createdBy: req.user.id
      };
      
      const template = await QualityAssuranceService.createQualityTemplate(templateData);
      
      res.status(201).json({
        success: true,
        message: 'Quality template created successfully',
        template
      });

    } catch (error) {
      console.error('Create quality template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create quality template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async getQualityTemplates(req, res) {
    try {
      const { category } = req.query;
      
      const templates = await QualityAssuranceService.getQualityTemplates(category);
      
      res.json({
        success: true,
        templates
      });

    } catch (error) {
      console.error('Get quality templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve quality templates',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async updateQualityTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { templateId } = req.params;
      const updateData = req.body;
      
      const template = await QualityAssuranceService.updateQualityTemplate(templateId, updateData);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Quality template not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Quality template updated successfully',
        template
      });

    } catch (error) {
      console.error('Update quality template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quality template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async deleteQualityTemplate(req, res) {
    try {
      const { templateId } = req.params;
      
      const template = await QualityAssuranceService.deleteQualityTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Quality template not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Quality template deleted successfully'
      });

    } catch (error) {
      console.error('Delete quality template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete quality template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Analytics
  static async getQualityAnalytics(req, res) {
    try {
      const { period = 'week' } = req.query;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // Get quality check statistics
      const totalChecks = await QualityCheck.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const passedChecks = await QualityCheck.countDocuments({
        status: 'passed',
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const failedChecks = await QualityCheck.countDocuments({
        status: 'failed',
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const revisionRequests = await QualityCheck.countDocuments({
        'manualReview.revisionsRequested': true,
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const statusStats = await QualityCheck.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const priorityStats = await QualityCheck.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get top reviewers
      const topReviewers = await QualityReviewer.aggregate([
        {
          $match: {
            'performance.totalReviews': { $gt: 0 }
          }
        },
        {
          $sort: { 'performance.averageScore': -1 }
        },
        {
          $limit: 10
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $project: {
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            email: '$user.email',
            totalReviews: '$performance.totalReviews',
            averageScore: '$performance.averageScore',
            onTimeReviews: '$performance.onTimeReviews'
          }
        }
      ]);

      res.json({
        success: true,
        analytics: {
          period,
          totalChecks,
          passedChecks,
          failedChecks,
          revisionRequests,
          passRate: totalChecks > 0 ? (passedChecks / totalChecks * 100).toFixed(2) : 0,
          statusDistribution: statusStats,
          priorityDistribution: priorityStats,
          topReviewers
        }
      });

    } catch (error) {
      console.error('Quality analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get quality analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default QualityController;