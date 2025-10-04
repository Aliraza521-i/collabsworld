import mongoose from 'mongoose';

// Function to generate orderId synchronously
const generateOrderId = function() {
  // Generate a simple orderId without database query to avoid async issues
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const orderSchema = new mongoose.Schema(
  {
    // Order identification
    orderId: {
      type: String,
      unique: true,
      required: true,
      default: generateOrderId
    },
    
    // Relationships
    publisherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Publisher ID is required'],
    },
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Advertiser ID is required'],
    },
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      required: [true, 'Website ID is required'],
    },
    chatId: {
      type: String,
      ref: 'Chat',
    },
    
    // Order details
    title: {
      type: String,
      required: [true, 'Order title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Order description is required'],
      trim: true,
    },
    
    // Content specifications
    contentRequirements: {
      wordCount: {
        type: Number,
        required: [true, 'Word count is required'],
        min: 300,
      },
      keywords: [{
        type: String,
        trim: true,
      }],
      targetUrl: {
        type: String,
        required: [true, 'Target URL is required'],
        trim: true,
        default: 'https://example.com'
      },
      anchorText: {
        type: String,
        required: [true, 'Anchor text is required'],
        trim: true,
        default: 'Example Anchor Text'
      },
      linkType: {
        type: String,
        enum: ['dofollow', 'nofollow'],
        default: 'dofollow',
      },
      additionalInstructions: {
        type: String,
        trim: true,
      },
    },
    
    // Pricing
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: 0,
    },
    additionalCharges: {
      copywriting: {
        type: Number,
        default: 0,
        min: 0,
      },
      rushOrder: {
        type: Number,
        default: 0,
        min: 0,
      },
      premium: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: 0,
    },
    platformCommission: {
      type: Number,
      required: [true, 'Platform commission is required'],
      min: 0,
    },
    publisherEarnings: {
      type: Number,
      required: [true, 'Publisher earnings is required'],
      min: 0,
    },
    
    // Timeline
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    rushOrder: {
      type: Boolean,
      default: false,
    },
    
    // Order status workflow
    status: {
      type: String,
      enum: [
        'pending',           // New order, waiting for publisher response
        'approved',          // Publisher accepted the order
        'in_progress',       // Work is being done
        'completed',         // Publisher completed, waiting for advertiser approval
        'delivered',         // Advertiser approved the delivery
        'revision_requested', // Advertiser requested changes
        'disputed',          // There's a dispute
        'cancelled',         // Order was cancelled
        'rejected'           // Publisher rejected the order
      ],
      default: 'pending',
    },
    
    // Content submission
    submittedContent: {
      content: {
        type: String,
        trim: true,
      },
      publishedUrl: {
        type: String,
        trim: true,
      },
      submittedAt: {
        type: Date,
      },
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    
    // Revision tracking
    revisions: [{
      requestedAt: {
        type: Date,
        default: Date.now,
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: {
        type: String,
        required: true,
        trim: true,
      },
      status: {
        type: String,
        enum: ['pending', 'completed', 'rejected'],
        default: 'pending',
      },
      response: {
        type: String,
        trim: true,
      },
      completedAt: {
        type: Date,
      },
    }],
    
    // Communication
    messages: [{
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      message: {
        type: String,
        required: true,
        trim: true,
      },
      attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
      }],
      sentAt: {
        type: Date,
        default: Date.now,
      },
      readAt: {
        type: Date,
      },
    }],
    
    // Article data for "Choose My Own Article" feature
    articleData: {
      articleTitle: {
        type: String,
        trim: true,
      },
      permalinkSlug: {
        type: String,
        trim: true,
      },
      anchorText: {
        type: String,
        trim: true,
      },
      targetUrl: {
        type: String,
        trim: true,
      },
      postText: {
        type: String,
        trim: true,
      },
      metaTitle: {
        type: String,
        trim: true,
      },
      metaKeywords: {
        type: String,
        trim: true,
      },
      metaDescription: {
        type: String,
        trim: true,
      },
      projectId: {
        type: String,
        trim: true,
      },
      createdAt: {
        type: Date,
      },
      updatedAt: {
        type: Date,
      },
    },
    
    // Quality tracking
    qualityScore: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: {
        type: String,
        trim: true,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reviewedAt: {
        type: Date,
      },
    },
    
    // Payment tracking
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'released', 'refunded'],
      default: 'pending',
    },
    paymentDetails: {
      transactionId: String,
      paidAt: Date,
      releasedAt: Date,
      refundedAt: Date,
      refundReason: String,
    },
    
    // Administrative
    adminNotes: {
      type: String,
      trim: true,
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    flagReason: {
      type: String,
      trim: true,
    },
    
    // Tracking
    publisherResponseTime: {
      type: Number, // in hours
    },
    completionTime: {
      type: Number, // in hours
    },
    
    // Timestamps for status changes
    statusHistory: [{
      status: {
        type: String,
        required: true,
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      reason: {
        type: String,
        trim: true,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
orderSchema.index({ publisherId: 1, status: 1 });
orderSchema.index({ advertiserId: 1, status: 1 });
orderSchema.index({ websiteId: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ deadline: 1, status: 1 });

// Add a pre-validate hook to debug validation issues
orderSchema.pre('validate', function(next) {
  console.log('Pre-validate hook called for order:', this.orderId);
  console.log('Order data:', {
    orderId: this.orderId,
    publisherId: this.publisherId,
    advertiserId: this.advertiserId,
    websiteId: this.websiteId,
    title: this.title,
    description: this.description,
    contentRequirements: this.contentRequirements,
    basePrice: this.basePrice,
    totalPrice: this.totalPrice,
    platformCommission: this.platformCommission,
    publisherEarnings: this.publisherEarnings,
    deadline: this.deadline,
    status: this.status
  });
  
  // Ensure orderId is set
  if (!this.orderId) {
    console.log('orderId is missing, generating one');
    this.orderId = `ORD-${Date.now()}-0001`;
  }
  
  next();
});

// Pre-save middleware to generate orderId
orderSchema.pre('save', async function(next) {
  console.log('Pre-save middleware called for order, isNew:', this.isNew, 'orderId exists:', !!this.orderId);
  if (!this.orderId) {
    console.log('Generating new orderId');
    try {
      // Generate a simple orderId without database query to avoid async issues
      this.orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Generated orderId:', this.orderId);
    } catch (error) {
      console.error('Error generating orderId in pre-save:', error);
      // Generate a fallback ID
      this.orderId = `ORD-${Date.now()}-0001`;
      console.log('Generated fallback orderId:', this.orderId);
    }
  } else {
    console.log('Using existing orderId:', this.orderId);
  }
  
  // Ensure required fields are set
  if (this.contentRequirements && !this.contentRequirements.targetUrl) {
    this.contentRequirements.targetUrl = 'https://example.com';
    console.log('Set default targetUrl');
  }
  
  if (this.contentRequirements && !this.contentRequirements.anchorText) {
    this.contentRequirements.anchorText = 'Example Anchor Text';
    console.log('Set default anchorText');
  }
  
  // Calculate publisher earnings (total - commission)
  if (this.totalPrice && this.platformCommission) {
    this.publisherEarnings = this.totalPrice - this.platformCommission;
    console.log('Calculated publisherEarnings:', this.publisherEarnings);
  }
  
  next();
});

// Add status to history when status changes
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this._userId, // This should be set by the controller
    });
  }
  next();
});

// Post-save hook to create quality check when order is completed
orderSchema.post('save', async function(doc, next) {
  // Only create quality check when order status changes to 'completed'
  if (this.status === 'completed' && this.isModified('status')) {
    try {
      // Import QualityAssuranceService here to avoid circular dependencies
      const { default: QualityAssuranceService } = await import('../services/QualityService.js');
      
      // Create quality check for this order
      await QualityAssuranceService.createQualityCheck(doc._id);
    } catch (error) {
      console.error('Failed to create quality check for order:', error);
    }
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);

export default Order;