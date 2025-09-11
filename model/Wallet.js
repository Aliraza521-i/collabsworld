import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    
    // Balance information
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Currency
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'PKR', 'INR'],
      default: 'USD',
    },
    
    // Payment methods
    paymentMethods: [{
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
      isDefault: {
        type: Boolean,
        default: false,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
      verifiedAt: Date,
      addedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    
    // Withdrawal settings
    withdrawalSettings: {
      minimumAmount: {
        type: Number,
        default: 50,
      },
      autoWithdrawal: {
        enabled: {
          type: Boolean,
          default: false,
        },
        threshold: {
          type: Number,
          default: 500,
        },
        schedule: {
          type: String,
          enum: ['weekly', 'monthly'],
          default: 'monthly',
        },
      },
    },
    
    // Transaction history summary
    transactionSummary: {
      lastTransactionAt: Date,
      totalTransactions: {
        type: Number,
        default: 0,
      },
      monthlyEarnings: [{
        month: Number,
        year: Number,
        amount: Number,
        transactions: Number,
      }],
    },
    
    // Status and flags
    status: {
      type: String,
      enum: ['active', 'suspended', 'frozen'],
      default: 'active',
    },
    flags: {
      hasPendingWithdrawal: {
        type: Boolean,
        default: false,
      },
      hasFailedPayment: {
        type: Boolean,
        default: false,
      },
      requiresVerification: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
walletSchema.index({ status: 1 });
walletSchema.index({ 'flags.hasPendingWithdrawal': 1 });

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;