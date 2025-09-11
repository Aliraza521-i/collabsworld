import { validationResult } from 'express-validator';
import { Notification, NotificationPreference, NotificationTemplate } from '../Models/NotificationModel.js';
import NotificationService from '../services/NotificationService.js';

export class NotificationController {
  
  // Get user notifications
  static async getUserNotifications(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const {
        page = 1,
        limit = 20,
        status,
        type,
        sortBy = 'createdAt',
        sortOrder = -1
      } = req.query;

      const result = await NotificationService.getUserNotifications(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        type,
        sortBy,
        sortOrder: parseInt(sortOrder)
      });

      res.json({
        success: true,
        notifications: result.notifications,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await NotificationService.markAsRead(notificationId, userId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
        notification
      });

    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      
      const result = await NotificationService.markAllAsRead(userId);
      
      res.json({
        success: true,
        message: `Marked ${result.modifiedCount} notifications as read`,
        count: result.modifiedCount
      });

    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Archive notification
  static async archiveNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await NotificationService.archiveNotification(notificationId, userId);
      
      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification archived',
        notification
      });

    } catch (error) {
      console.error('Archive notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to archive notification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Delete notification
  static async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const deleted = await NotificationService.deleteNotification(notificationId, userId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted'
      });

    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get unread notification count
  static async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      
      const count = await NotificationService.getUnreadCount(userId);
      
      res.json({
        success: true,
        count
      });

    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get unread notification count',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get user notification preferences
  static async getUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      console.log('Getting preferences for user:', userId);
      
      const preferences = await NotificationService.getUserPreferences(userId);
      console.log('Successfully retrieved preferences for user:', userId, preferences);
      
      res.json({
        success: true,
        preferences
      });

    } catch (error) {
      console.error('Get preferences error for user:', req.user.id, error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      
      // Check if it's a Mongoose error
      if (error.name && error.name.includes('Mongoose')) {
        console.error('Mongoose error details:', error);
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Update user notification preferences
  static async updateUserPreferences(req, res) {
    try {
      const userId = req.user.id;
      const preferencesData = req.body;
      
      const preferences = await NotificationService.updateUserPreferences(userId, preferencesData);
      
      res.json({
        success: true,
        message: 'Notification preferences updated',
        preferences
      });

    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Get all notification templates
  static async getNotificationTemplates(req, res) {
    try {
      const templates = await NotificationTemplate.find({}).sort({ createdAt: -1 });
      
      res.json({
        success: true,
        templates
      });

    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification templates',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Create notification template
  static async createNotificationTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const templateData = req.body;
      
      const template = new NotificationTemplate(templateData);
      await template.save();
      
      res.status(201).json({
        success: true,
        message: 'Notification template created',
        template
      });

    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Update notification template
  static async updateNotificationTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const updateData = req.body;
      
      const template = await NotificationTemplate.findByIdAndUpdate(
        templateId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Notification template updated',
        template
      });

    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Delete notification template
  static async deleteNotificationTemplate(req, res) {
    try {
      const { templateId } = req.params;
      
      const template = await NotificationTemplate.findByIdAndDelete(templateId);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Notification template deleted'
      });

    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Send bulk notification
  static async sendBulkNotification(req, res) {
    try {
      const { userIds, type, data } = req.body;
      
      const results = await NotificationService.sendBulkNotifications(userIds, type, data);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      res.json({
        success: true,
        message: `Sent notifications to ${successCount} users, ${failureCount} failed`,
        results: results.filter(r => !r.success) // Only return failed results
      });

    } catch (error) {
      console.error('Bulk notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send bulk notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Get notification analytics
  static async getNotificationAnalytics(req, res) {
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

      // Get notification statistics
      const totalNotifications = await Notification.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const unreadNotifications = await Notification.countDocuments({
        status: 'unread',
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const channelStats = await Notification.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            emailSent: {
              $sum: { $cond: [{ $eq: ['$channels.email.sent', true] }, 1, 0] }
            },
            smsSent: {
              $sum: { $cond: [{ $eq: ['$channels.sms.sent', true] }, 1, 0] }
            },
            pushSent: {
              $sum: { $cond: [{ $eq: ['$channels.push.sent', true] }, 1, 0] }
            },
            inAppDelivered: {
              $sum: { $cond: [{ $eq: ['$channels.inApp.delivered', true] }, 1, 0] }
            }
          }
        }
      ]);

      const typeStats = await Notification.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        },
        {
          $limit: 10
        }
      ]);

      res.json({
        success: true,
        analytics: {
          period,
          totalNotifications,
          unreadNotifications,
          channels: channelStats[0] || {
            emailSent: 0,
            smsSent: 0,
            pushSent: 0,
            inAppDelivered: 0
          },
          topNotificationTypes: typeStats
        }
      });

    } catch (error) {
      console.error('Notification analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

export default NotificationController;