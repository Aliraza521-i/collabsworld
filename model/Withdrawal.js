import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema(
  {
    // Withdrawal identification
    withdrawalId: {
      type: String,
      unique: true,
      required: true,
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
    
    // Amount details
    requestedAmount: {
      type: Number,
      required: [true, 'Requested amount is required'],
      min: 1,
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
    
    netAmount: {
      type: Number,
      required: [true, 'Net amount is required'],
    },
    
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'PKR', 'INR'],
      default: 'USD',
    },
    
    // Payment method
    paymentMethod: {
      type: {
        type: String,
        enum: ['bank_transfer', 'paypal', 'stripe', 'jazzcash', 'easypaisa', 'crypto'],
        required: true,
      },
      details: {
        // Bank transfer details
        bankName: String,
        accountNumber: String,
        routingNumber: String,
        accountHolderName: String,
        
        // PayPal details
        paypalEmail: String,
        
        // Crypto details
        walletAddress: String,
        cryptoType: String,
        
        // Mobile payment details
        phoneNumber: String,
      },
    },
    
    // Status tracking
    status: {
      type: String,
      enum: [
        'pending',           // Awaiting admin review
        'approved',          // Approved by admin
        'processing',        // Being processed by payment gateway
        'completed',         // Successfully transferred
        'failed',           // Payment failed
        'cancelled',        // Cancelled by user or admin
        'rejected'          // Rejected by admin
      ],
      default: 'pending',
    },
    
    // Processing details
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Admin who processed
    },
    processedAt: Date,
    
    // Payment gateway details
    paymentGateway: {
      transactionId: String,
      gatewayName: String,
      gatewayResponse: mongoose.Schema.Types.Mixed,
      transferredAt: Date,
    },
    
    // Verification and compliance
    verification: {
      ipAddress: String,
      userAgent: String,
      deviceFingerprint: String,
      twoFactorVerified: {
        type: Boolean,
        default: false,
      },
    },
    
    // Admin review
    adminReview: {
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reviewedAt: Date,
      decision: {
        type: String,
        enum: ['approved', 'rejected'],
      },
      notes: String,
      reason: String,
    },
    
    // Timestamps
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: Date,
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
      maxRetries: {
        type: Number,
        default: 3,
      },
    },
    
    // Additional information
    notes: {
      type: String,
      trim: true,
    },
    internalNotes: {
      type: String,
      trim: true,
    },
    
    // Tax information
    taxInfo: {
      taxWithheld: {
        type: Number,
        default: 0,
      },
      taxRate: {
        type: Number,
        default: 0,
      },
      taxRegion: String,
    },
    
    // Automation flags
    isAutomatic: {
      type: Boolean,
      default: false,
    },
    scheduledDate: Date,
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to generate withdrawal ID
withdrawalSchema.pre('save', async function(next) {
  if (!this.withdrawalId) {
    const count = await mongoose.model('Withdrawal').countDocuments();
    this.withdrawalId = `WTH-${Date.now()}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // Calculate net amount if not provided
  if (!this.netAmount && this.requestedAmount) {
    this.netAmount = this.requestedAmount - (this.fees?.totalFees || 0);
  }
  
  next();
});

// Indexes for performance
withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ walletId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });
withdrawalSchema.index({ 'paymentMethod.type': 1 });
withdrawalSchema.index({ requestedAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export default Withdrawal;