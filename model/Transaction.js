import mongoose from 'mongoose';

// Function to generate transactionId synchronously
const generateTransactionId = function() {
  // Generate a simple transactionId without database query to avoid async issues
  return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const transactionSchema = new mongoose.Schema(
  {
    // Transaction identification
    transactionId: {
      type: String,
      unique: true,
      required: true,
      default: generateTransactionId
    },
    
    // User and wallet references
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Wallet ID is required'],
    },
    
    // Transaction details
    type: {
      type: String,
      enum: [
        'earning',           // Money earned from completed order
        'withdrawal',        // Money withdrawn by user
        'deposit',          // Money deposited by advertiser
        'refund',           // Refund to advertiser
        'commission',       // Platform commission
        'bonus',            // Bonus payment
        'penalty',          // Penalty deduction
        'adjustment',       // Manual adjustment by admin
        'fee'              // Platform or payment processing fee
      ],
      required: [true, 'Transaction type is required'],
    },
    
    // Amount and currency
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'PKR', 'INR'],
      default: 'USD',
    },
    
    // Balance tracking
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before transaction is required'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after transaction is required'],
    },
    
    // Transaction status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'],
      default: 'pending',
    },
    
    // Related entities
    orderId: {
      type: String,
      ref: 'Order',
    },
    withdrawalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal',
    },
    
    // Payment details
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'paypal', 'stripe', 'jazzcash', 'easypaisa', 'crypto', 'internal'],
    },
    paymentGateway: {
      transactionId: String,
      gatewayName: String,
      gatewayResponse: mongoose.Schema.Types.Mixed,
    },
    
    // Processing details
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Admin who processed manually
    },
    processedAt: Date,
    
    // Description and metadata
    description: {
      type: String,
      required: [true, 'Transaction description is required'],
      trim: true,
    },
    internalNotes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    
    // Fee breakdown
    fees: {
      platformFee: {
        type: Number,
        default: 0,
      },
      paymentProcessingFee: {
        type: Number,
        default: 0,
      },
      currencyConversionFee: {
        type: Number,
        default: 0,
      },
      totalFees: {
        type: Number,
        default: 0,
      },
    },
    
    // Tax information
    taxInfo: {
      taxable: {
        type: Boolean,
        default: false,
      },
      taxAmount: {
        type: Number,
        default: 0,
      },
      taxRate: {
        type: Number,
        default: 0,
      },
      taxRegion: String,
    },
    
    // Timestamps
    scheduledAt: Date,
    completedAt: Date,
    failedAt: Date,
    
    // Error handling
    errorDetails: {
      code: String,
      message: String,
      timestamp: Date,
      retryCount: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to generate transaction ID
transactionSchema.pre('save', async function(next) {
  console.log('Pre-save middleware called for transaction, transactionId exists:', !!this.transactionId);
  if (!this.transactionId) {
    console.log('Generating new transactionId');
    // Generate a simple transactionId without database query to avoid async issues
    this.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Generated transactionId:', this.transactionId);
  } else {
    console.log('Using existing transactionId:', this.transactionId);
  }
  next();
});

// Indexes for performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;