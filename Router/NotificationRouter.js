import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, requireRole as authorizeRole } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import NotificationController from '../controllers/NotificationController.js';

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

// User notification management
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['unread', 'read', 'archived']).withMessage('Invalid status'),
    query('type').optional().isLength({ min: 1 }).withMessage('Invalid type'),
    query('sortBy').optional().isIn(['createdAt', 'readAt', 'priority']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['1', '-1']).withMessage('Invalid sort order')
  ],
  handleValidationErrors,
  NotificationController.getUserNotifications
);

router.put('/:notificationId/read',
  [
    param('notificationId').isMongoId().withMessage('Valid notification ID is required')
  ],
  handleValidationErrors,
  NotificationController.markAsRead
);

router.put('/read-all',
  NotificationController.markAllAsRead
);

router.put('/:notificationId/archive',
  [
    param('notificationId').isMongoId().withMessage('Valid notification ID is required')
  ],
  handleValidationErrors,
  NotificationController.archiveNotification
);

router.delete('/:notificationId',
  [
    param('notificationId').isMongoId().withMessage('Valid notification ID is required')
  ],
  handleValidationErrors,
  NotificationController.deleteNotification
);

router.get('/unread-count',
  NotificationController.getUnreadCount
);

// User notification preferences
router.get('/preferences',
  NotificationController.getUserPreferences
);

router.put('/preferences',
  [
    body('email.enabled').optional().isBoolean().withMessage('Email enabled must be boolean'),
    body('email.frequency').optional().isIn(['immediate', 'daily_digest', 'weekly_digest', 'disabled']).withMessage('Invalid email frequency'),
    body('sms.enabled').optional().isBoolean().withMessage('SMS enabled must be boolean'),
    body('push.enabled').optional().isBoolean().withMessage('Push enabled must be boolean'),
    body('inApp.enabled').optional().isBoolean().withMessage('In-app enabled must be boolean'),
    body('categories.*').optional().isBoolean().withMessage('Category values must be boolean'),
    body('doNotDisturb.enabled').optional().isBoolean().withMessage('Do not disturb enabled must be boolean'),
    body('doNotDisturb.startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format'),
    body('doNotDisturb.endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format')
  ],
  handleValidationErrors,
  NotificationController.updateUserPreferences
);

// Admin routes
router.use('/admin', authorizeRole(['admin']));

// Admin notification templates
router.get('/admin/templates',
  NotificationController.getNotificationTemplates
);

router.post('/admin/templates',
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('type').notEmpty().withMessage('Template type is required'),
    body('subject').notEmpty().withMessage('Template subject is required'),
    body('content').notEmpty().withMessage('Template content is required'),
    body('channels').isArray().withMessage('Channels must be an array'),
    body('channels.*').isIn(['email', 'sms', 'push', 'inApp']).withMessage('Invalid channel'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
  ],
  handleValidationErrors,
  NotificationController.createNotificationTemplate
);

router.put('/admin/templates/:templateId',
  [
    param('templateId').isMongoId().withMessage('Valid template ID is required'),
    body('name').optional().notEmpty().withMessage('Template name is required'),
    body('type').optional().notEmpty().withMessage('Template type is required'),
    body('subject').optional().notEmpty().withMessage('Template subject is required'),
    body('content').optional().notEmpty().withMessage('Template content is required'),
    body('channels').optional().isArray().withMessage('Channels must be an array'),
    body('channels.*').optional().isIn(['email', 'sms', 'push', 'inApp']).withMessage('Invalid channel'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
  ],
  handleValidationErrors,
  NotificationController.updateNotificationTemplate
);

router.delete('/admin/templates/:templateId',
  [
    param('templateId').isMongoId().withMessage('Valid template ID is required')
  ],
  handleValidationErrors,
  NotificationController.deleteNotificationTemplate
);

// Admin bulk notifications
router.post('/admin/bulk',
  [
    body('userIds').isArray().withMessage('User IDs must be an array'),
    body('userIds.*').isMongoId().withMessage('Each user ID must be valid'),
    body('type').notEmpty().withMessage('Notification type is required'),
    body('data').isObject().withMessage('Data must be an object')
  ],
  handleValidationErrors,
  NotificationController.sendBulkNotification
);

// Admin analytics
router.get('/admin/analytics',
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period')
  ],
  handleValidationErrors,
  NotificationController.getNotificationAnalytics
);

export default router;