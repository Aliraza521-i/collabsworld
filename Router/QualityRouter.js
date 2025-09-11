import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, requireRole as authorizeRole } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import QualityController from '../controllers/QualityController.js';

const router = express.Router();

// All QA routes require authentication
router.use(authenticateToken);

// Quality Check Management
router.post('/checks',
  [
    body('orderId').isMongoId().withMessage('Valid order ID is required')
  ],
  handleValidationErrors,
  QualityController.createQualityCheck
);

router.post('/checks/:qualityCheckId/automated',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required'),
    body('content').notEmpty().withMessage('Content is required')
  ],
  handleValidationErrors,
  QualityController.runAutomatedChecks
);

router.get('/checks/:qualityCheckId',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required')
  ],
  handleValidationErrors,
  QualityController.getQualityCheck
);

router.get('/checks',
  [
    query('status').optional().isIn(['pending', 'in_progress', 'passed', 'failed', 'needs_revision', 'under_review']).withMessage('Invalid status'),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    query('assignedTo').optional().isMongoId().withMessage('Invalid assignedTo ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sortBy').optional().isIn(['createdAt', 'priority', 'deadline']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['1', '-1']).withMessage('Invalid sort order')
  ],
  handleValidationErrors,
  QualityController.getQualityChecks
);

router.put('/checks/:qualityCheckId/assign',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.assignReviewer
);

router.put('/checks/:qualityCheckId/start-review',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'qa_reviewer']),
  QualityController.startManualReview
);

router.put('/checks/:qualityCheckId/complete-review',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required'),
    body('verdict').isIn(['approved', 'rejected', 'needs_revision']).withMessage('Invalid verdict'),
    body('comments').optional().isLength({ max: 1000 }).withMessage('Comments must be less than 1000 characters')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'qa_reviewer']),
  QualityController.completeManualReview
);

router.post('/checks/:qualityCheckId/comments',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required'),
    body('text').notEmpty().withMessage('Comment text is required').isLength({ max: 500 }).withMessage('Comment must be less than 500 characters')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'qa_reviewer']),
  QualityController.addComment
);

router.post('/checks/:qualityCheckId/revision',
  [
    param('qualityCheckId').isMongoId().withMessage('Valid quality check ID is required'),
    body('changes').notEmpty().withMessage('Changes description is required').isLength({ max: 1000 }).withMessage('Changes must be less than 1000 characters')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'publisher']),
  QualityController.submitRevision
);

// Reviewer-specific endpoints
router.get('/checks/my',
  [
    query('status').optional().isIn(['pending', 'in_progress', 'passed', 'failed', 'needs_revision', 'under_review']).withMessage('Invalid status')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'qa_reviewer']),
  QualityController.getQualityChecksByReviewer
);

// Admin: Overdue checks
router.get('/checks/overdue',
  authorizeRole(['admin']),
  QualityController.getOverdueQualityChecks
);

// Quality Reviewer Management
router.post('/reviewers/:userId',
  [
    param('userId').isMongoId().withMessage('Valid user ID is required'),
    body('specialization').optional().isIn(['content', 'seo', 'technical', 'general']).withMessage('Invalid specialization'),
    body('experienceLevel').optional().isIn(['junior', 'mid', 'senior', 'expert']).withMessage('Invalid experience level')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.createQualityReviewer
);

router.put('/reviewers/:userId',
  [
    param('userId').isMongoId().withMessage('Valid user ID is required'),
    body('specialization').optional().isIn(['content', 'seo', 'technical', 'general']).withMessage('Invalid specialization'),
    body('experienceLevel').optional().isIn(['junior', 'mid', 'senior', 'expert']).withMessage('Invalid experience level'),
    body('availability.status').optional().isIn(['available', 'busy', 'offline']).withMessage('Invalid availability status')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.updateQualityReviewer
);

router.get('/reviewers/:userId',
  [
    param('userId').isMongoId().withMessage('Valid user ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.getQualityReviewer
);

// Quality Template Management
router.post('/templates',
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('category').optional().isIn(['content', 'seo', 'technical', 'general']).withMessage('Invalid category'),
    body('checks').isArray().withMessage('Checks must be an array'),
    body('checks.*.name').notEmpty().withMessage('Check name is required'),
    body('checks.*.type').isIn(['automated', 'manual']).withMessage('Invalid check type'),
    body('checks.*.weight').optional().isInt({ min: 1, max: 100 }).withMessage('Weight must be between 1 and 100'),
    body('checks.*.passThreshold').optional().isInt({ min: 0, max: 100 }).withMessage('Pass threshold must be between 0 and 100')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.createQualityTemplate
);

router.get('/templates',
  [
    query('category').optional().isIn(['content', 'seo', 'technical', 'general']).withMessage('Invalid category')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'qa_reviewer']),
  QualityController.getQualityTemplates
);

router.put('/templates/:templateId',
  [
    param('templateId').isMongoId().withMessage('Valid template ID is required'),
    body('name').optional().notEmpty().withMessage('Template name is required'),
    body('category').optional().isIn(['content', 'seo', 'technical', 'general']).withMessage('Invalid category'),
    body('checks').optional().isArray().withMessage('Checks must be an array'),
    body('checks.*.name').optional().notEmpty().withMessage('Check name is required'),
    body('checks.*.type').optional().isIn(['automated', 'manual']).withMessage('Invalid check type'),
    body('checks.*.weight').optional().isInt({ min: 1, max: 100 }).withMessage('Weight must be between 1 and 100'),
    body('checks.*.passThreshold').optional().isInt({ min: 0, max: 100 }).withMessage('Pass threshold must be between 0 and 100')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.updateQualityTemplate
);

router.delete('/templates/:templateId',
  [
    param('templateId').isMongoId().withMessage('Valid template ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.deleteQualityTemplate
);

// Analytics
router.get('/analytics',
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period')
  ],
  handleValidationErrors,
  authorizeRole(['admin']),
  QualityController.getQualityAnalytics
);

export default router;