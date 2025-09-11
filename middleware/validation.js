import { body, param, query, validationResult } from 'express-validator';

// Error handling middleware
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Chat validation rules
export const chatValidation = {
  createChat: [
    body('type')
      .isIn(['order', 'support', 'direct'])
      .withMessage('Chat type must be order, support, or direct'),
    body('orderId')
      .optional()
      .isMongoId()
      .withMessage('Order ID must be a valid MongoDB ObjectId'),
    body('participants')
      .isArray({ min: 1 })
      .withMessage('Participants must be an array with at least one user'),
    body('participants.*')
      .isMongoId()
      .withMessage('Each participant must be a valid user ID'),
    body('title')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Title must be between 1 and 100 characters'),
    handleValidationErrors
  ],

  sendMessage: [
    body('content')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message content must be between 1 and 5000 characters'),
    body('type')
      .optional()
      .isIn(['text', 'file', 'image', 'system'])
      .withMessage('Message type must be text, file, image, or system'),
    body('replyTo')
      .optional()
      .isMongoId()
      .withMessage('Reply to must be a valid message ID'),
    handleValidationErrors
  ]
};

// Order validation rules
export const orderValidation = {
  createOrder: [
    body('websiteId')
      .isMongoId()
      .withMessage('Website ID must be a valid MongoDB ObjectId'),
    body('contentType')
      .isIn(['article', 'review', 'interview', 'news', 'tutorial'])
      .withMessage('Content type must be valid'),
    body('wordCount')
      .isInt({ min: 300, max: 5000 })
      .withMessage('Word count must be between 300 and 5000'),
    body('targetUrl')
      .isURL()
      .withMessage('Target URL must be a valid URL'),
    body('anchorText')
      .isLength({ min: 1, max: 100 })
      .withMessage('Anchor text must be between 1 and 100 characters'),
    body('keywords')
      .isArray({ min: 1, max: 10 })
      .withMessage('Keywords must be an array with 1-10 items'),
    body('specialInstructions')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Special instructions cannot exceed 1000 characters'),
    body('deadline')
      .isISO8601()
      .withMessage('Deadline must be a valid date'),
    handleValidationErrors
  ],

  updateOrder: [
    param('orderId')
      .isMongoId()
      .withMessage('Order ID must be a valid MongoDB ObjectId'),
    body('status')
      .optional()
      .isIn(['pending', 'accepted', 'in_progress', 'content_submitted', 'revision_requested', 'completed', 'cancelled'])
      .withMessage('Status must be valid'),
    handleValidationErrors
  ]
};

// Website validation rules
export const websiteValidation = {
  addWebsite: [
    body('domain')
      .isURL({ require_protocol: false })
      .withMessage('Domain must be a valid URL'),
    body('category')
      .isIn(['technology', 'business', 'health', 'lifestyle', 'education', 'entertainment', 'sports', 'travel'])
      .withMessage('Category must be valid'),
    body('country')
      .isLength({ min: 2, max: 2 })
      .withMessage('Country must be a 2-letter country code'),
    body('mainLanguage')
      .isLength({ min: 2, max: 10 })
      .withMessage('Main language must be specified'),
    body('publishingPrice')
      .isFloat({ min: 10 })
      .withMessage('Publishing price must be at least $10'),
    body('copywritingPrice')
      .optional()
      .isFloat({ min: 5 })
      .withMessage('Copywriting price must be at least $5'),
    body('linkType')
      .isIn(['dofollow', 'nofollow', 'both'])
      .withMessage('Link type must be dofollow, nofollow, or both'),
    body('numberOfLinks')
      .isInt({ min: 1, max: 5 })
      .withMessage('Number of links must be between 1 and 5'),
    handleValidationErrors
  ]
};

// User validation rules
export const userValidation = {
  register: [
    body('firstName')
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email must be valid'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .isIn(['publisher', 'advertiser'])
      .withMessage('Role must be publisher or advertiser'),
    body('phoneNumber')
      .optional()
      .isMobilePhone()
      .withMessage('Phone number must be valid'),
    handleValidationErrors
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Email must be valid'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ]
};

// Wallet validation rules
export const walletValidation = {
  addPaymentMethod: [
    body('type')
      .isIn(['bank_account', 'paypal', 'stripe', 'crypto', 'mobile_payment'])
      .withMessage('Payment method type must be valid'),
    body('accountDetails')
      .isObject()
      .withMessage('Account details must be an object'),
    body('isDefault')
      .optional()
      .isBoolean()
      .withMessage('isDefault must be a boolean'),
    handleValidationErrors
  ],

  withdrawal: [
    body('amount')
      .isFloat({ min: 10 })
      .withMessage('Withdrawal amount must be at least $10'),
    body('paymentMethodId')
      .isMongoId()
      .withMessage('Payment method ID must be valid'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter code'),
    handleValidationErrors
  ]
};

// Query validation
export const queryValidation = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
  ],

  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO date'),
    handleValidationErrors
  ]
};

// Generic validation helpers
export const validateMongoId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} must be a valid MongoDB ObjectId`),
  handleValidationErrors
];

export const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be valid'),
  handleValidationErrors
];

export const validatePassword = [
  body('password')
    .isLength({ min: 6 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 6 characters and contain uppercase, lowercase, and number'),
  handleValidationErrors
];

export default {
  chatValidation,
  orderValidation,
  websiteValidation,
  userValidation,
  walletValidation,
  queryValidation,
  validateMongoId,
  validateEmail,
  validatePassword,
  handleValidationErrors
};