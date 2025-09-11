import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  payerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BTC', 'ETH', 'USDT'],
    default: 'USD'
  },
  originalAmount: {
    type: Number,
    required: true
  },
  originalCurrency: {
    type: String,
    required: true,
    default: 'USD'
  },
  exchangeRate: {
    type: Number,
    default: 1
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['stripe', 'paypal', 'crypto', 'wallet', 'bank_transfer']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  providerTransactionId: {
    type: String,
    index: true
  },
  providerData: {
    type: mongoose.Schema.Types.Mixed
  },
  paidAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    min: 0
  },
  platformFee: {
    type: Number,
    default: 0
  },
  processingFee: {
    type: Number,
    default: 0
  },
  metadata: {
    returnUrl: String,
    webhookUrl: String,
    orderDetails: mongoose.Schema.Types.Mixed,
    customerInfo: mongoose.Schema.Types.Mixed
  },
  failureReason: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
PaymentSchema.index({ orderId: 1, status: 1 });
PaymentSchema.index({ payerId: 1, createdAt: -1 });

// Virtual for net amount after fees
PaymentSchema.virtual('netAmount').get(function() {
  return this.amount - this.platformFee - this.processingFee;
});

// Static method to get payment summary
PaymentSchema.statics.getPaymentSummary = function(userId, dateRange = {}) {
  const match = { payerId: userId };
  
  if (dateRange.from || dateRange.to) {
    match.createdAt = {};
    if (dateRange.from) match.createdAt.$gte = new Date(dateRange.from);
    if (dateRange.to) match.createdAt.$lte = new Date(dateRange.to);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    }
  ]);
};

const Payment = mongoose.model('Payment', PaymentSchema);

// Escrow Schema
const EscrowSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    unique: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'BTC', 'ETH', 'USDT']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'funded', 'released', 'disputed', 'refunded', 'cancelled', 'auto_release_eligible'],
    default: 'pending'
  },
  fundedAt: {
    type: Date
  },
  releasedAt: {
    type: Date
  },
  releasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  autoReleaseDate: {
    type: Date
  },
  platformCommission: {
    type: Number,
    default: 0
  },
  terms: {
    deliveryDeadline: Date,
    revisionRounds: {
      type: Number,
      default: 2
    },
    autoReleaseHours: {
      type: Number,
      default: 72
    },
    milestones: [{
      name: String,
      amount: Number,
      dueDate: Date,
      status: {
        type: String,
        enum: ['pending', 'completed', 'overdue']
      }
    }]
  },
  dispute: {
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'escalated']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    description: String,
    evidence: [{
      type: String, // File URLs
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    adminNotes: String,
    resolution: String,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: Date
  },
  history: [{
    action: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Indexes
EscrowSchema.index({ paymentId: 1 });
EscrowSchema.index({ buyerId: 1, sellerId: 1 });
EscrowSchema.index({ status: 1, autoReleaseDate: 1 });

// Method to check if auto-release is eligible
EscrowSchema.methods.checkAutoRelease = function() {
  if (this.status === 'funded' && this.autoReleaseDate && new Date() >= this.autoReleaseDate) {
    this.status = 'auto_release_eligible';
    return true;
  }
  return false;
};

// Pre-save middleware to set auto-release date
EscrowSchema.pre('save', function(next) {
  if (this.isNew && this.status === 'funded' && this.terms.autoReleaseHours) {
    this.autoReleaseDate = new Date(Date.now() + this.terms.autoReleaseHours * 60 * 60 * 1000);
  }
  next();
});

const Escrow = mongoose.model('Escrow', EscrowSchema);

// Currency Model for exchange rates
const CurrencySchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  exchangeRate: {
    type: Number,
    required: true,
    default: 1 // Rate against USD
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCryptocurrency: {
    type: Boolean,
    default: false
  },
  decimals: {
    type: Number,
    default: 2
  },
  minimumAmount: {
    type: Number,
    default: 0.01
  },
  maximumAmount: {
    type: Number,
    default: 1000000
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Currency = mongoose.model('Currency', CurrencySchema);

// Payment Method Schema for storing user payment methods
const PaymentMethodSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_account', 'crypto_wallet']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Encrypted sensitive data
  encryptedData: {
    type: String // Encrypted JSON containing payment method details
  },
  // Public metadata (non-sensitive)
  metadata: {
    last4: String, // Last 4 digits for cards
    brand: String, // Visa, MasterCard, etc.
    expiryMonth: Number,
    expiryYear: Number,
    holderName: String,
    country: String,
    currency: String
  },
  providerData: {
    stripeCustomerId: String,
    stripePaymentMethodId: String,
    paypalCustomerId: String
  }
}, {
  timestamps: true
});

// Ensure only one default payment method per user
PaymentMethodSchema.index({ userId: 1, isDefault: 1 }, { 
  unique: true, 
  partialFilterExpression: { isDefault: true } 
});

const PaymentMethod = mongoose.model('PaymentMethod', PaymentMethodSchema);

export { Payment, Escrow, Currency, PaymentMethod };
export default Payment;