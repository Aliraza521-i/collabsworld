import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    // Basic project information
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
    },
    website: {
      type: String,
      required: [true, 'Website URL is required'],
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    
    // Categories
    categories: [{
      type: String,
      trim: true,
    }],
    
    // Language
    language: {
      type: String,
      default: 'English',
      trim: true,
    },
    
    // Budget information
    budget: {
      type: Number,
      required: [true, 'Budget is required'],
      min: 0,
    },
    minPostBudget: {
      type: Number,
      min: 0,
    },
    maxPostBudget: {
      type: Number,
      min: 0,
    },
    postsRequired: {
      type: Number,
      required: [true, 'Number of posts required is required'],
      min: 1,
    },
    
    // Description
    description: {
      type: String,
      trim: true,
    },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'completed', 'pending', 'cancelled'],
      default: 'active',
    },
    
    // Statistics
    stats: {
      finishedPosts: {
        type: Number,
        default: 0,
        min: 0,
      },
      activePosts: {
        type: Number,
        default: 0,
        min: 0,
      },
      pendingReviews: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalOrders: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Add virtual for mapping _id to id
projectSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Project = mongoose.model('Project', projectSchema);

export default Project;