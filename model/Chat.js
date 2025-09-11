import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    senderRole: {
      type: String,
      enum: ['publisher', 'advertiser', 'admin', 'user'],
      default: 'user',
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'file', 'image', 'system'],
      default: 'text',
    },
    attachments: [{
      fileName: String,
      originalName: String,
      fileUrl: String,
      fileType: String,
      fileSize: Number,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    readBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    }],
    editedAt: Date,
    deletedAt: Date,
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    flags: {
      containsPersonalDetails: {
        type: Boolean,
        default: false,
      }
    }
  },
  {
    timestamps: true,
  }
);

const chatSchema = new mongoose.Schema(
  {
    // Chat identification
    chatId: {
      type: String,
      unique: true,
      required: true,
    },
    
    // Chat type and participants
    chatType: {
      type: String,
      enum: ['order', 'support', 'general'],
      required: [true, 'Chat type is required'],
    },
    
    participants: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      role: {
        type: String,
        enum: ['publisher', 'advertiser', 'admin'],
        required: true,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
      leftAt: Date,
      isActive: {
        type: Boolean,
        default: true,
      },
      notifications: {
        enabled: {
          type: Boolean,
          default: true,
        },
        lastReadAt: Date,
      },
    }],
    
    // Related entities
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
    },
    
    // Messages
    messages: [messageSchema],
    
    // Chat metadata
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    
    // Chat status
    status: {
      type: String,
      enum: ['active', 'archived', 'closed'],
      default: 'active',
    },
    
    // Priority and flags
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    flags: {
      hasUnreadMessages: {
        type: Boolean,
        default: false,
      },
      isSupport: {
        type: Boolean,
        default: false,
      },
      requiresAttention: {
        type: Boolean,
        default: false,
      },
    },
    
    // Statistics
    stats: {
      totalMessages: {
        type: Number,
        default: 0,
      },
      lastMessageAt: Date,
      lastActivityAt: Date,
      averageResponseTime: Number, // in minutes
    },
    
    // Settings
    settings: {
      autoArchiveAfter: {
        type: Number,
        default: 30, // days
      },
      allowFileUploads: {
        type: Boolean,
        default: true,
      },
      maxFileSize: {
        type: Number,
        default: 10485760, // 10MB
      },
      allowedFileTypes: [{
        type: String,
        default: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
      }],
    },
    
    // Auto-responses and templates
    autoResponses: [{
      trigger: String,
      response: String,
      enabled: {
        type: Boolean,
        default: false,
      },
    }],
    
    // Moderation
    moderation: {
      isModerated: {
        type: Boolean,
        default: false,
      },
      moderatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      moderationReason: String,
      moderatedAt: Date,
    },
    
    // Encryption
    encryption: {
      isEncrypted: {
        type: Boolean,
        default: false,
      },
      encryptionKey: String,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to generate chat ID
chatSchema.pre('save', async function(next) {
  if (!this.chatId) {
    const count = await mongoose.model('Chat').countDocuments();
    this.chatId = `CHAT-${Date.now()}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // Update stats
  if (this.messages && this.messages.length > 0) {
    this.stats.totalMessages = this.messages.length;
    this.stats.lastMessageAt = this.messages[this.messages.length - 1].createdAt;
    this.stats.lastActivityAt = new Date();
  }
  
  next();
});

// Indexes for performance
chatSchema.index({ 'participants.userId': 1, status: 1 });
chatSchema.index({ chatType: 1, status: 1 });
chatSchema.index({ 'stats.lastActivityAt': -1 });
chatSchema.index({ 'flags.hasUnreadMessages': 1 });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;








