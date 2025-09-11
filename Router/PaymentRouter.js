import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken, requireRole as authorizeRole } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validation.js';
import { PaymentController } from '../controllers/PaymentController.js';

const router = express.Router();

// All payment routes require authentication
router.use(authenticateToken);

// Payment initialization
router.post('/initiate',
  [
    body('orderId').isMongoId().withMessage('Valid order ID is required'),
    body('paymentMethod').isIn(['stripe', 'paypal', 'crypto', 'wallet'])
      .withMessage('Valid payment method is required'),
    body('currency').optional().isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BTC', 'ETH', 'USDT'])
      .withMessage('Unsupported currency'),
    body('returnUrl').optional().isURL().withMessage('Valid return URL is required'),
    body('webhookUrl').optional().isURL().withMessage('Valid webhook URL is required')
  ],
  handleValidationErrors,
  PaymentController.initiatePayment
);

// Payment confirmation webhook (public endpoint)
router.post('/confirm',
  [
    body('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('providerTransactionId').notEmpty().withMessage('Provider transaction ID is required'),
    body('status').isIn(['pending', 'completed', 'failed', 'cancelled'])
      .withMessage('Valid status is required')
  ],
  handleValidationErrors,
  PaymentController.confirmPayment
);

// Escrow management
router.post('/escrow/:escrowId/release',
  [
    param('escrowId').isMongoId().withMessage('Valid escrow ID is required')
  ],
  handleValidationErrors,
  PaymentController.releaseEscrow
);

// Dispute management
router.post('/escrow/:escrowId/dispute',
  [
    param('escrowId').isMongoId().withMessage('Valid escrow ID is required'),
    body('reason').notEmpty().withMessage('Dispute reason is required'),
    body('description').notEmpty().withMessage('Dispute description is required')
  ],
  handleValidationErrors,
  PaymentController.createDispute
);

// Refund requests
router.post('/:paymentId/refund',
  [
    param('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid refund amount is required'),
    body('reason').optional().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'advertiser']),
  PaymentController.requestRefund
);

// Payment method management (for advertisers)
router.get('/methods',
  authorizeRole(['advertiser']),
  PaymentController.getUserPaymentMethods
);

router.post('/methods',
  [
    body('type').isIn(['credit_card', 'debit_card', 'paypal', 'bank_account', 'crypto_wallet'])
      .withMessage('Valid payment method type is required'),
    body('isDefault').optional().isBoolean().withMessage('isDefault must be boolean')
  ],
  handleValidationErrors,
  authorizeRole(['advertiser']),
  PaymentController.addPaymentMethod
);

router.put('/methods/:methodId/default',
  [
    param('methodId').isMongoId().withMessage('Valid payment method ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['advertiser']),
  PaymentController.setDefaultPaymentMethod
);

router.delete('/methods/:methodId',
  [
    param('methodId').isMongoId().withMessage('Valid payment method ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['advertiser']),
  PaymentController.removePaymentMethod
);

// Transaction history
router.get('/transactions',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  authorizeRole(['advertiser', 'publisher']),
  PaymentController.getTransactionHistory
);

// Payment details
router.get('/:paymentId',
  [
    param('paymentId').isMongoId().withMessage('Valid payment ID is required')
  ],
  handleValidationErrors,
  authorizeRole(['admin', 'advertiser', 'publisher']),
  PaymentController.getPaymentDetails
);

// Admin routes
router.use('/admin', authorizeRole(['admin']));

// Admin payment management
router.get('/admin/payments',
  [
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  PaymentController.adminGetPayments
);

router.put('/admin/payments/:paymentId/status',
  [
    param('paymentId').isMongoId().withMessage('Valid payment ID is required'),
    body('status').isIn(['completed', 'failed', 'cancelled', 'refunded'])
      .withMessage('Valid status is required')
  ],
  handleValidationErrors,
  PaymentController.adminUpdatePaymentStatus
);

// Admin escrow management
router.get('/admin/escrows',
  [
    query('status').optional().isIn(['pending', 'funded', 'released', 'disputed', 'refunded', 'cancelled']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  PaymentController.adminGetEscrows
);

router.put('/admin/escrows/:escrowId/dispute',
  [
    param('escrowId').isMongoId().withMessage('Valid escrow ID is required'),
    body('resolution').notEmpty().withMessage('Resolution is required'),
    body('status').isIn(['resolved', 'escalated']).withMessage('Valid status is required')
  ],
  handleValidationErrors,
  PaymentController.adminResolveDispute
);

// Currency management
router.get('/admin/currencies',
  PaymentController.adminGetCurrencies
);

router.put('/admin/currencies/:currencyCode',
  [
    param('currencyCode').isLength({ min: 3, max: 3 }).withMessage('Valid currency code is required'),
    body('exchangeRate').isFloat({ min: 0 }).withMessage('Valid exchange rate is required'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
  ],
  handleValidationErrors,
  PaymentController.adminUpdateCurrency
);

// Analytics
router.get('/admin/analytics',
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Valid period is required'),
    query('currency').optional().isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BTC', 'ETH', 'USDT'])
  ],
  handleValidationErrors,
  PaymentController.adminGetAnalytics
);

export default router;