import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'order_created',
      'order_approved',
      'order_rejected',
      'order_paid',
      'order_submitted',
      'order_completed',
      'order_disputed',
      'payment_received',
      'payment_failed',
      'escrow_released',
      'message_received',
      'illegal_activity_detected',
      'website_approved',
      'website_rejected',
      'support_ticket_created',
      'support_ticket_updated',
      'user_suspended',
      'user_verified',
      'withdrawal_requested',
      'withdrawal_processed',
      'system_maintenance',
      'custom'
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived', 'deleted'],
    default: 'unread'
  },
  channels: {
    email: {
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      },
      deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
        default: 'pending'
      },
      providerResponse: {
        type: String
      }
    },
    sms: {
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      },
      deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed'],
        default: 'pending'
      },
      providerResponse: {
        type: String
      }
    },
    push: {
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      },
      deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed'],
        default: 'pending'
      },
      providerResponse: {
        type: String
      }
    },
    inApp: {
      delivered: {
        type: Boolean,
        default: true
      },
      readAt: {
        type: Date
      }
    }
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    // Store additional context data for the notification
    // For example: { orderId: '...', websiteUrl: '...', amount: 100 }
  },
  actionUrl: {
    type: String,
    // URL to redirect user when they click on notification
  },
  scheduledFor: {
    type: Date,
    // For scheduled notifications
  },
  sentAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  archivedAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for performance
NotificationSchema.index({ type: 1, status: 1 });
NotificationSchema.index({ scheduledFor: 1 }, { sparse: true });
NotificationSchema.index({ 'channels.email.sent': 1, 'channels.email.deliveryStatus': 1 });
NotificationSchema.index({ 'channels.sms.sent': 1, 'channels.sms.deliveryStatus': 1 });
NotificationSchema.index({ 'channels.push.sent': 1, 'channels.push.deliveryStatus': 1 });

// Pre-save middleware
NotificationSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'read' && !this.readAt) {
    this.readAt = new Date();
  }
  
  if (this.isModified('status') && this.status === 'archived' && !this.archivedAt) {
    this.archivedAt = new Date();
  }
  
  next();
});

// Instance methods
NotificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  this.channels.inApp.readAt = new Date();
  return this.save();
};

NotificationSchema.methods.markAsArchived = function() {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

NotificationSchema.methods.isUnread = function() {
  return this.status === 'unread';
};

// Static methods
NotificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, status: 'unread' });
};

NotificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { userId, status: 'unread' },
    { 
      status: 'read', 
      readAt: new Date(),
      'channels.inApp.readAt': new Date()
    }
  );
};

NotificationSchema.statics.getRecentNotifications = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

NotificationSchema.statics.getByType = function(userId, type, limit = 10) {
  return this.find({ userId, type })
    .sort({ createdAt: -1 })
    .limit(limit);
};

NotificationSchema.statics.getUnreadByType = function(userId, type) {
  return this.find({ userId, type, status: 'unread' });
};

NotificationSchema.statics.getPendingScheduled = function() {
  const now = new Date();
  return this.find({ 
    scheduledFor: { $lte: now },
    status: 'unread'
  });
};

// Notification Preferences Schema
const NotificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  email: {
    enabled: {
      type: Boolean,
      default: true
    },
    frequency: {
      type: String,
      enum: ['immediate', 'daily_digest', 'weekly_digest', 'disabled'],
      default: 'immediate'
    }
  },
  sms: {
    enabled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['immediate', 'disabled'],
      default: 'immediate'
    }
  },
  push: {
    enabled: {
      type: Boolean,
      default: true
    },
    frequency: {
      type: String,
      enum: ['immediate', 'disabled'],
      default: 'immediate'
    }
  },
  inApp: {
    enabled: {
      type: Boolean,
      default: true
    },
    showBadge: {
      type: Boolean,
      default: true
    }
  },
  categories: {
    orders: {
      type: Boolean,
      default: true
    },
    payments: {
      type: Boolean,
      default: true
    },
    websites: {
      type: Boolean,
      default: true
    },
    messages: {
      type: Boolean,
      default: true
    },
    support: {
      type: Boolean,
      default: true
    },
    system: {
      type: Boolean,
      default: true
    },
    promotions: {
      type: Boolean,
      default: false
    }
  },
  doNotDisturb: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: String,
      default: '22:00'
    },
    endTime: {
      type: String,
      default: '08:00'
    }
  },
  timezone: {
    type: String,
    default: 'UTC'
  }
}, {
  timestamps: true
});

// Add indexes
NotificationPreferenceSchema.index({ userId: 1 });

// Instance methods
NotificationPreferenceSchema.methods.canSendNotification = function(category, channel) {
  // Check if channel is enabled
  if (!this[channel] || !this[channel].enabled) {
    return false;
  }
  
  // Check if category is enabled
  if (this.categories && this.categories[category] === false) {
    return false;
  }
  
  // Check do not disturb
  if (this.doNotDisturb && this.doNotDisturb.enabled) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Simple time range check (doesn't handle overnight ranges properly)
    if (currentTime >= this.doNotDisturb.startTime && currentTime <= this.doNotDisturb.endTime) {
      return false;
    }
  }
  
  return true;
};

// Notification Template Schema
const NotificationTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  channels: [{
    type: String,
    enum: ['email', 'sms', 'push', 'inApp']
  }],
  variables: [{
    name: String,
    description: String,
    required: Boolean
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
NotificationTemplateSchema.index({ type: 1 });

// Remove the model definition to avoid conflicts
let NotificationModel;
let NotificationPreferenceModel;
let NotificationTemplateModel;

try {
  NotificationModel = mongoose.model('Notification');
} catch (error) {
  NotificationModel = mongoose.model('Notification', NotificationSchema);
}

try {
  NotificationPreferenceModel = mongoose.model('NotificationPreference');
} catch (error) {
  NotificationPreferenceModel = mongoose.model('NotificationPreference', NotificationPreferenceSchema);
}

try {
  NotificationTemplateModel = mongoose.model('NotificationTemplate');
} catch (error) {
  NotificationTemplateModel = mongoose.model('NotificationTemplate', NotificationTemplateSchema);
}

export { NotificationModel as Notification, NotificationPreferenceModel as NotificationPreference, NotificationTemplateModel as NotificationTemplate };
export default NotificationModel;
