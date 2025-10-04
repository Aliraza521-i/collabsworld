// models/Website.js
import mongoose from 'mongoose';

const websiteSchema = new mongoose.Schema(
  {
    // Basic website information
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    
    // Verification fields
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
    },
    
    // Verification methods
    googleAnalyticsCode: {
      type: String,
      trim: true,
    },
    googleSearchConsoleCode: {
      type: String,
      trim: true,
    },
    htmlVerificationCode: {
      type: String,
      trim: true,
    },
    
    // Verification method used
    verificationMethod: {
      type: String,
      enum: ['google_analytics', 'google_search_console', 'html_file', 'another_method'],
    },
    
    // Verification timestamps
    verifiedAt: {
      type: Date,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
    },
    lastVerificationAttempt: {
      type: Date,
    },
    
    // Fields for disabling verification methods
    disableGoogleAnalytics: {
      type: Boolean,
      default: false,
    },
    disableGoogleSearchConsole: {
      type: Boolean,
      default: false,
    },
    disableHtmlFile: {
      type: Boolean,
      default: false,
    },
    
    // Website details
    siteDescription: {
      type: String,
      required: [true, 'Site description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    keywords: [{
      type: String,
      trim: true,
    }],
    
    // Location information
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    additionalCountries: [{
      type: String,
      trim: true,
    }],
    
    // Language information
    mainLanguage: {
      type: String,
      required: [true, 'Main language is required'],
      trim: true,
    },
    additionalLanguages: [{
      type: String,
      trim: true,
    }],
    
    // Publishing requirements
    advertisingRequirements: {
      type: String,
      required: [true, 'Advertising requirements are required'],
      trim: true,
    },
    publishingSections: {
      type: String,
      required: [true, 'Publishing sections are required'],
      trim: true,
    },
    
    // Pricing information
    publishingPrice: {
      type: Number,
      required: [true, 'Publishing price is required'],
      min: 0,
    },
    copywritingPrice: {
      type: Number,
      required: [true, 'Copywriting price is required'],
      min: 0,
    },
    homepageAnnouncementPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Link information
    linkType: {
      type: String,
      enum: ['dofollow', 'nofollow'],
      default: 'dofollow',
    },
    numberOfLinks: {
      type: Number,
      default: 1,
      min: 1,
    },
    
    // Discount information
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    // Sensitive content categories
    acceptedSensitiveCategories: [{
      type: String,
      enum: ['dating_websites', 'forex_brokers', 'lending_microloans', 'legal_betting_casino'],
    }],
    sensitiveContentExtraCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Article editing
    articleEditingPercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    
    // Publishing formats
    publishingFormats: [{
      type: String,
      enum: ['article'],
      default: 'article',
    }],
    
    // Website metrics
    metrics: {
      da: {  // Domain Authority
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      dr: {  // Domain Rating
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      monthlyTraffic: {
        type: Number,
        default: 0,
        min: 0,
      },
      domainAuthority: {  // Alternative field name for DA
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      // Ahrefs metrics
      ahrefsDomainRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      urlRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      ahrefsTraffic: {
        type: Number,
        default: 0,
        min: 0,
      },
      // SEMrush metrics
      semrushRank: {
        type: Number,
        default: 0,
        min: 0,
      },
      semrushTraffic: {
        type: Number,
        default: 0,
        min: 0,
      },
      semrushKeywords: {
        type: Number,
        default: 0,
        min: 0,
      },
      // Additional metrics
      pageAuthority: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      referringDomains: {
        type: Number,
        default: 0,
        min: 0,
      },
      externalLinks: {
        type: Number,
        default: 0,
        min: 0,
      },
      mozRank: {
        type: Number,
        default: 0,
        min: 0,
        max: 10,
      },
      organicTraffic: {
        type: Number,
        default: 0,
        min: 0,
      }
    },
    
    // Status and moderation
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'],
      default: 'draft',
    },
    previousStatus: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'],
    },
    reviewNotes: {
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
    
    // Hide domain option
    hideDomain: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Website = mongoose.model('Website', websiteSchema);

export default Website;