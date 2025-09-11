import mongoose from 'mongoose';

const QualityCheckSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  websiteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Website',
    required: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'passed', 'failed', 'needs_revision', 'under_review'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  automatedChecks: {
    plagiarism: {
      checked: {
        type: Boolean,
        default: false
      },
      score: {
        type: Number,
        min: 0,
        max: 100
      },
      sources: [{
        url: String,
        similarity: Number
      }],
      passed: Boolean
    },
    grammar: {
      checked: {
        type: Boolean,
        default: false
      },
      errors: Number,
      warnings: Number,
      score: {
        type: Number,
        min: 0,
        max: 100
      },
      passed: Boolean
    },
    seo: {
      checked: {
        type: Boolean,
        default: false
      },
      keywords: [{
        keyword: String,
        density: Number,
        found: Boolean
      }],
      metaTitle: {
        length: Number,
        hasKeyword: Boolean
      },
      metaDescription: {
        length: Number,
        hasKeyword: Boolean
      },
      headings: {
        h1Count: Number,
        h2Count: Number,
        structureScore: Number
      },
      readability: {
        score: Number,
        gradeLevel: String
      },
      passed: Boolean
    },
    links: {
      checked: {
        type: Boolean,
        default: false
      },
      internalLinks: Number,
      externalLinks: Number,
      brokenLinks: [{
        url: String,
        statusCode: Number
      }],
      dofollowRatio: Number,
      passed: Boolean
    },
    contentQuality: {
      checked: {
        type: Boolean,
        default: false
      },
      wordCount: Number,
      uniqueWords: Number,
      sentenceVariety: Number,
      paragraphStructure: Number,
      passed: Boolean
    }
  },
  manualReview: {
    requested: {
      type: Boolean,
      default: false
    },
    reviewerAssigned: {
      type: Boolean,
      default: false
    },
    reviewStartedAt: {
      type: Date
    },
    reviewCompletedAt: {
      type: Date
    },
    comments: [{
      reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      text: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }],
    revisionsRequested: {
      type: Boolean,
      default: false
    },
    revisionCount: {
      type: Number,
      default: 0
    },
    finalVerdict: {
      type: String,
      enum: ['approved', 'rejected', 'needs_revision']
    },
    finalComments: String
  },
  revisionHistory: [{
    revisionNumber: Number,
    submittedAt: Date,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: String,
    status: {
      type: String,
      enum: ['submitted', 'in_review', 'approved', 'rejected']
    }
  }],
  deadline: {
    type: Date
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for performance
QualityCheckSchema.index({ websiteId: 1 });
QualityCheckSchema.index({ status: 1 });
QualityCheckSchema.index({ priority: 1 });
QualityCheckSchema.index({ assignedTo: 1 });
QualityCheckSchema.index({ 'automatedChecks.plagiarism.score': 1 });
QualityCheckSchema.index({ 'automatedChecks.grammar.score': 1 });
QualityCheckSchema.index({ 'automatedChecks.seo.readability.score': 1 });
QualityCheckSchema.index({ createdAt: -1 });

// Pre-save middleware
QualityCheckSchema.pre('save', function(next) {
  // Set deadline if not already set (24 hours from creation)
  if (!this.deadline && this.isNew) {
    this.deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  // Update revision count
  if (this.isModified('manualReview.revisionsRequested') && this.manualReview.revisionsRequested) {
    this.manualReview.revisionCount = (this.manualReview.revisionCount || 0) + 1;
  }
  
  next();
});

// Instance methods
QualityCheckSchema.methods.assignReviewer = function(reviewerId) {
  this.reviewerId = reviewerId;
  this.manualReview.reviewerAssigned = true;
  this.status = 'in_progress';
  this.manualReview.reviewStartedAt = new Date();
  return this.save();
};

QualityCheckSchema.methods.startReview = function() {
  this.status = 'in_progress';
  this.manualReview.reviewStartedAt = new Date();
  return this.save();
};

QualityCheckSchema.methods.completeReview = function(verdict, comments) {
  this.manualReview.finalVerdict = verdict;
  this.manualReview.finalComments = comments;
  this.manualReview.reviewCompletedAt = new Date();
  
  switch (verdict) {
    case 'approved':
      this.status = 'passed';
      break;
    case 'rejected':
      this.status = 'failed';
      break;
    case 'needs_revision':
      this.status = 'needs_revision';
      this.manualReview.revisionsRequested = true;
      break;
  }
  
  return this.save();
};

QualityCheckSchema.methods.addComment = function(reviewerId, text) {
  this.manualReview.comments.push({
    reviewerId,
    text,
    createdAt: new Date()
  });
  return this.save();
};

QualityCheckSchema.methods.submitRevision = function(userId, changes) {
  const revisionNumber = (this.revisionHistory.length || 0) + 1;
  
  this.revisionHistory.push({
    revisionNumber,
    submittedAt: new Date(),
    submittedBy: userId,
    changes,
    status: 'submitted'
  });
  
  this.status = 'in_progress';
  return this.save();
};

// Static methods
QualityCheckSchema.statics.getByStatus = function(status, limit = 50) {
  return this.find({ status })
    .populate('orderId websiteId reviewerId assignedTo')
    .sort({ createdAt: -1 })
    .limit(limit);
};

QualityCheckSchema.statics.getByPriority = function(priority, limit = 50) {
  return this.find({ priority })
    .populate('orderId websiteId reviewerId assignedTo')
    .sort({ createdAt: -1 })
    .limit(limit);
};

QualityCheckSchema.statics.getOverdue = function() {
  const now = new Date();
  return this.find({ 
    deadline: { $lt: now },
    status: { $in: ['pending', 'in_progress'] }
  })
  .populate('orderId websiteId assignedTo')
  .sort({ deadline: 1 });
};

QualityCheckSchema.statics.getByReviewer = function(reviewerId, status = null) {
  const query = { reviewerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('orderId websiteId')
    .sort({ createdAt: -1 });
};

// Quality Reviewer Schema
const QualityReviewerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  specialization: {
    type: String,
    enum: ['content', 'seo', 'technical', 'general'],
    default: 'general'
  },
  experienceLevel: {
    type: String,
    enum: ['junior', 'mid', 'senior', 'expert'],
    default: 'mid'
  },
  availability: {
    status: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'available'
    },
    lastActive: {
      type: Date
    }
  },
  performance: {
    totalReviews: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      min: 0,
      max: 100
    },
    onTimeReviews: {
      type: Number,
      default: 0
    },
    revisionRequests: {
      type: Number,
      default: 0
    }
  },
  assignedChecks: [{
    qualityCheckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QualityCheck'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    deadline: Date
  }],
  preferences: {
    maxAssignments: {
      type: Number,
      default: 10
    },
    preferredCategories: [{
      type: String
    }],
    notificationSettings: {
      newAssignment: {
        type: Boolean,
        default: true
      },
      deadlineReminder: {
        type: Boolean,
        default: true
      },
      reviewCompleted: {
        type: Boolean,
        default: true
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
QualityReviewerSchema.index({ specialization: 1 });
QualityReviewerSchema.index({ 'availability.status': 1 });
QualityReviewerSchema.index({ 'performance.averageScore': -1 });

// Instance methods
QualityReviewerSchema.methods.assignCheck = function(qualityCheckId, deadline) {
  this.assignedChecks.push({
    qualityCheckId,
    assignedAt: new Date(),
    deadline
  });
  
  // Update availability if at capacity
  if (this.assignedChecks.length >= this.preferences.maxAssignments) {
    this.availability.status = 'busy';
  }
  
  return this.save();
};

QualityReviewerSchema.methods.completeCheck = function(qualityCheckId) {
  this.assignedChecks = this.assignedChecks.filter(
    assignment => assignment.qualityCheckId.toString() !== qualityCheckId.toString()
  );
  
  // Update availability if no longer at capacity
  if (this.assignedChecks.length < this.preferences.maxAssignments) {
    this.availability.status = 'available';
  }
  
  return this.save();
};

QualityReviewerSchema.methods.updatePerformance = function(score, onTime = true, revisionRequested = false) {
  const total = this.performance.totalReviews;
  const currentAvg = this.performance.averageScore || 0;
  
  this.performance.totalReviews = total + 1;
  this.performance.averageScore = ((currentAvg * total) + score) / (total + 1);
  
  if (onTime) {
    this.performance.onTimeReviews = (this.performance.onTimeReviews || 0) + 1;
  }
  
  if (revisionRequested) {
    this.performance.revisionRequests = (this.performance.revisionRequests || 0) + 1;
  }
  
  return this.save();
};

// Quality Template Schema
const QualityTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['content', 'seo', 'technical', 'general'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  checks: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    type: {
      type: String,
      enum: ['automated', 'manual'],
      required: true
    },
    weight: {
      type: Number,
      min: 1,
      max: 100,
      default: 1
    },
    criteria: {
      type: mongoose.Schema.Types.Mixed
    },
    passThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 70
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
QualityTemplateSchema.index({ name: 1 });
QualityTemplateSchema.index({ category: 1 });
QualityTemplateSchema.index({ isActive: 1 });

const QualityCheck = mongoose.model('QualityCheck', QualityCheckSchema);
const QualityReviewer = mongoose.model('QualityReviewer', QualityReviewerSchema);
const QualityTemplate = mongoose.model('QualityTemplate', QualityTemplateSchema);

export { QualityCheck, QualityReviewer, QualityTemplate };
export default QualityCheck;