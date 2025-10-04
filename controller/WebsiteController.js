import Website from "../model/Website.js";
import axios from "axios";
import GoogleVerificationService from "../service/GoogleVerificationService.js";

// Check if website exists in database
export const checkWebsiteExists = async (req, res) => {
  const { domain } = req.params;
  
  // Log the domain being checked for debugging
  console.log('Checking domain:', domain);
  
  try {
    // Ensure consistent domain formatting for comparison
    const normalizedDomain = domain.toLowerCase().trim();
    console.log('Normalized domain for check:', normalizedDomain);
    
    const website = await Website.findOne({ 
      domain: normalizedDomain
    }).populate('userId', 'lastName email');
    
    // Log the result for debugging
    console.log('Found website in check:', website ? website.domain : 'None');
    
    if (website) {
      // Website already exists
      return res.status(200).json({
        ok: false,
        message: "Website already exists in our database",
        available: false
      });
    }
    
    // Website is available
    res.status(200).json({
      ok: true,
      message: "Website is available for registration",
      available: true
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error checking website availability",
      error: error.message
    });
  }
};

// Add new website (step 1)
export const addWebsite = async (req, res) => {
  const {
    domain,
    siteDescription = 'Pending description',
    advertisingRequirements = 'Standard requirements',
    publishingSections = 'General content',
    category = 'General',
    keywords = [],
    country = 'US',
    region = '',
    city = '',
    additionalCountries = [],
    mainLanguage = 'English',
    additionalLanguages = [],
    publishingPrice = 100,
    copywritingPrice = 50,
    homepageAnnouncementPrice = 0,
    linkType = 'dofollow',
    numberOfLinks = 1,
    discountPercentage = 0,
    acceptedSensitiveCategories = [],
    sensitiveContentExtraCharge = 0,
    articleEditingPercentage = 10,
    publishingFormats = ['article'],
    hideDomain = false,
    status = 'draft',
    verificationStatus = 'pending'
  } = req.body;
  
  try {
    // Log the domain being added for debugging
    console.log('Adding domain:', domain);
    console.log('Full request body:', req.body);
    
    // Ensure consistent domain formatting
    const normalizedDomain = domain.toLowerCase().trim();
    console.log('Normalized domain for add:', normalizedDomain);
    
    // Check if website already exists
    const existingWebsite = await Website.findOne({ 
      domain: normalizedDomain
    });
    
    // Log the result for debugging
    console.log('Existing website check in add:', existingWebsite ? existingWebsite.domain : 'None');
    
    if (existingWebsite) {
      console.log('Website already exists in add function, but allowing proceed');
      // Instead of returning error, we'll return the existing website with a flag
      return res.status(200).json({
        ok: true,
        message: "Website already exists. Proceeding to verification.",
        data: existingWebsite,
        existed: true,
        nextStep: "verification"
      });
    }
    
    // Create new website entry
    const websiteData = {
      domain: normalizedDomain,
      userId: req.user.id, // From JWT token
      siteDescription,
      advertisingRequirements,
      publishingSections,
      category,
      keywords: Array.isArray(keywords) ? keywords : [keywords].filter(Boolean),
      country,
      region,
      city,
      additionalCountries: Array.isArray(additionalCountries) ? additionalCountries : [],
      mainLanguage,
      additionalLanguages: Array.isArray(additionalLanguages) ? additionalLanguages : [],
      publishingPrice: parseFloat(publishingPrice),
      copywritingPrice: parseFloat(copywritingPrice),
      homepageAnnouncementPrice: parseFloat(homepageAnnouncementPrice) || 0,
      linkType: linkType || 'dofollow',
      numberOfLinks: parseInt(numberOfLinks) || 1,
      discountPercentage: parseFloat(discountPercentage) || 0,
      acceptedSensitiveCategories: Array.isArray(acceptedSensitiveCategories) ? acceptedSensitiveCategories : [],
      sensitiveContentExtraCharge: parseFloat(sensitiveContentExtraCharge) || 0,
      articleEditingPercentage: parseFloat(articleEditingPercentage) || 10,
      publishingFormats: Array.isArray(publishingFormats) ? publishingFormats : ['article'],
      hideDomain: Boolean(hideDomain),
      status,
      verificationStatus
    };
    
    console.log('Creating website with data:', websiteData);
    
    const website = new Website(websiteData);
    
    // Validate before saving
    const validationError = website.validateSync();
    if (validationError) {
      console.error('Validation error:', validationError.message);
      console.error('Validation errors:', validationError.errors);
      return res.status(400).json({
        ok: false,
        message: "Validation failed",
        error: validationError.message,
        details: Object.keys(validationError.errors).reduce((acc, key) => {
          acc[key] = validationError.errors[key].message;
          return acc;
        }, {})
      });
    }
    
    const savedWebsite = await website.save();
    
    console.log('Website saved successfully:', savedWebsite.domain);
    
    res.status(201).json({
      ok: true,
      message: "Website added successfully. Please proceed to verification.",
      data: savedWebsite,
      existed: false,
      nextStep: "verification"
    });
  } catch (error) {
    console.error('Error adding website:', error);
    if (error.name === 'ValidationError') {
      console.error('Mongoose validation error:', error.message);
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        ok: false,
        message: "Validation failed",
        error: error.message,
        details: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      console.error('Duplicate key error:', error.message);
      // Instead of returning error, we'll find the existing website and return it
      const normalizedDomain = req.body.domain.toLowerCase().trim();
      const existingWebsite = await Website.findOne({ domain: normalizedDomain });
      if (existingWebsite) {
        return res.status(200).json({
          ok: true,
          message: "Website already exists. Proceeding to verification.",
          data: existingWebsite,
          existed: true,
          nextStep: "verification"
        });
      }
    }
    res.status(500).json({
      ok: false,
      message: "Failed to add website",
      error: error.message
    });
  }
};

// Initiate website verification (step 2)
export const initiateVerification = async (req, res) => {
  const { websiteId } = req.params;
  const { verificationMethod } = req.body;
  
  try {
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.id
    });
    
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    if (website.verificationStatus === 'verified') {
      return res.status(400).json({
        ok: false,
        message: "Website is already verified"
      });
    }
    
    // Generate verification data using Google service
    const verificationData = GoogleVerificationService.generateVerificationData(
      verificationMethod, 
      website.domain
    );
    
    // Update website with verification details
    website.verificationMethod = verificationMethod;
    website.lastVerificationAttempt = new Date();
    website.verificationAttempts += 1;
    
    // Set the appropriate verification code field
    if (verificationMethod === 'google_analytics') {
      website.googleAnalyticsCode = verificationData.code;
    } else if (verificationMethod === 'google_search_console') {
      website.googleSearchConsoleCode = verificationData.code;
    } else if (verificationMethod === 'html_file') {
      website.htmlVerificationCode = verificationData.code;
    } else if (verificationMethod === 'another_method') {
      // For another_method, we don't need a verification code
      // Just set the method
    }
    
    await website.save();
    
    // For Google methods, provide OAuth URL
    let responseData = {
      verificationMethod,
      verificationCode: verificationData.code,
      instructions: verificationData.instructions,
      nextStep: verificationData.nextStep,
      websiteId: website._id
    };
    
    // Add OAuth URL for Google methods
    if (verificationMethod === 'google_analytics' || verificationMethod === 'google_search_console') {
      responseData.googleAuthUrl = GoogleVerificationService.getGoogleAuthUrl(websiteId, verificationMethod);
      responseData.authRequired = true;
    }
    
    // Add file content for HTML method
    if (verificationMethod === 'html_file') {
      responseData.fileContent = verificationData.fileContent;
      responseData.authRequired = false;
    }
    
    res.status(200).json({
      ok: true,
      message: "Verification initiated successfully",
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to initiate verification",
      error: error.message
    });
  }
};

// Verify website ownership (step 3)
export const verifyWebsite = async (req, res) => {
  const { websiteId } = req.params;
  const { googleTokens } = req.body; // OAuth tokens from Google
  
  try {
    // First, find the website without checking userId to see if it exists
    const website = await Website.findById(websiteId);
    
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found"
      });
    }
    
    // Check if website is already verified by another user
    if (website.verificationStatus === 'verified' && website.userId.toString() !== req.user.id) {
      // Transfer ownership to the current user
      website.userId = req.user.id;
      await website.save();
      
      return res.status(200).json({
        ok: true,
        message: "Website ownership transferred successfully! The website was already verified by another user, but ownership has been transferred to you.",
        data: {
          verificationStatus: website.verificationStatus,
          status: website.status,
          verificationAttempts: website.verificationAttempts,
          nextStep: 'admin_review',
          ownershipTransferred: true
        }
      });
    }
    
    // Check if the current user owns this website
    if (website.userId.toString() !== req.user.id) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    if (website.verificationStatus === 'verified') {
      return res.status(400).json({
        ok: false,
        message: "Website is already verified"
      });
    }
    
    let verificationResult;
    
    // Use appropriate verification method
    switch (website.verificationMethod) {
      case 'google_analytics':
        if (!googleTokens) {
          return res.status(400).json({
            ok: false,
            message: "Google OAuth tokens required for Analytics verification"
          });
        }
        verificationResult = await GoogleVerificationService.verifyGoogleAnalytics(
          website.domain,
          website.googleAnalyticsCode,
          googleTokens
        );
        break;
        
      case 'google_search_console':
        if (!googleTokens) {
          return res.status(400).json({
            ok: false,
            message: "Google OAuth tokens required for Search Console verification"
          });
        }
        verificationResult = await GoogleVerificationService.verifySearchConsole(
          website.domain,
          googleTokens
        );
        break;
        
      case 'html_file':
        verificationResult = await GoogleVerificationService.verifyHtmlFile(
          website.domain,
          website.htmlVerificationCode
        );
        break;
        
      case 'another_method':
        // For the 'another_method', we automatically consider it verified
        // since the user has provided a reason
        verificationResult = { 
          verified: true,
          details: {
            method: 'another_method',
            note: 'Verification via alternative method'
          }
        };
        break;
        
      default:
        return res.status(400).json({
          ok: false,
          message: "Invalid verification method"
        });
    }
    
    // Update verification status based on result
    if (verificationResult.verified) {
      website.verificationStatus = 'verified';
      website.verifiedAt = new Date();
      website.status = 'submitted'; // Move to next stage for admin review
    } else {
      website.verificationStatus = 'failed';
      website.verificationAttempts += 1;
      
      // Allow up to 3 attempts
      if (website.verificationAttempts >= 3) {
        website.status = 'rejected';
      }
    }
    
    website.lastVerificationAttempt = new Date();
    await website.save();
    
    const responseMessage = verificationResult.verified 
      ? "Website verified successfully! Your website will now be reviewed by our team."
      : verificationResult.error || "Verification failed";
    
    res.status(200).json({
      ok: verificationResult.verified,
      message: responseMessage,
      data: {
        verificationStatus: website.verificationStatus,
        status: website.status,
        verificationAttempts: website.verificationAttempts,
        verificationDetails: verificationResult.details,
        nextStep: verificationResult.verified ? 'admin_review' : 'retry_verification'
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Verification process failed",
      error: error.message
    });
  }
};

// Get website details
export const getWebsite = async (req, res) => {
  const { websiteId } = req.params;
  
  try {
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.id
    }).populate('userId', 'firstName lastName email');
    
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    // Add allCategories field for consistent display
    const websiteData = website.toObject();
    // Parse categories from the category field if they are stored as a comma-separated string
    websiteData.allCategories = websiteData.category 
      ? websiteData.category.split(', ').map(cat => cat.trim()) 
      : [];
    // Ensure additionalCategories is always an empty array
    websiteData.additionalCategories = [];
    
    res.status(200).json({
      ok: true,
      data: websiteData
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch website details",
      error: error.message
    });
  }
};

// Get all websites for a user
export const getUserWebsites = async (req, res) => {
  try {
    const { page = 1, limit = 10, statuses, sortBy } = req.query;
    
    const filter = { userId: req.user.id };
    
    // Handle single status filter
    if (statuses) {
      if (statuses === 'in_moderation') {
        // Special case for in_moderation: websites that are verified but waiting for moderation
        filter.verificationStatus = 'verified';
        filter.status = 'submitted';
      } else if (statuses === 'problem_sites') {
        // Problem sites filter - websites that meet specific criteria
        // 1. Websites that were approved but are now rejected
        // 2. Websites with failed verification after multiple attempts
        // 3. Websites verified by another method (indirect verification)
        // 4. Websites that have been removed by admin (status changed from approved to something else)
        filter.$or = [
          // Websites that were approved but are now rejected
          { status: 'rejected', previousStatus: 'approved' },
          // Websites with failed verification after multiple attempts
          { verificationStatus: 'failed', verificationAttempts: { $gte: 3 } },
          // Websites verified by another method
          { verificationMethod: 'another_method' },
          // Websites that have been removed by admin (status changed from approved to something else)
          { status: { $ne: 'approved' }, previousStatus: 'approved' }
        ];
      } else {
        // Regular status filter
        filter.status = statuses;
      }
    }
    
    // Set up sorting
    let sortOptions = { createdAt: -1 }; // Default sort by creation date
    
    if (sortBy === 'problem_sites') {
      // For problem sites, sort by verification attempts (failed ones first) and then by last verification attempt
      sortOptions = { verificationAttempts: -1, lastVerificationAttempt: -1 };
    } else if (sortBy === 'last_event') {
      sortOptions = { updatedAt: -1 };
    } else if (sortBy === 'creation_date') {
      sortOptions = { createdAt: -1 };
    }
    
    const websites = await Website.find(filter)
      .populate('userId', 'firstName lastName email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Website.countDocuments(filter);
    
    res.status(200).json({
      ok: true,
      data: websites,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch websites",
      error: error.message
    });
  }
};

// Update website details
export const updateWebsite = async (req, res) => {
  const { websiteId } = req.params;
  
  try {
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.id
    });
    
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    // Allow updates to approved websites but set status to submitted for re-moderation
    // Don't allow updates to websites under moderation
    if (website.status === 'under_moderation') {
      return res.status(400).json({
        ok: false,
        message: "Cannot update website while under moderation"
      });
    }
    
    // If website is approved, set it back to submitted for re-moderation
    if (website.status === 'approved') {
      website.status = 'submitted';
      website.previousStatus = 'approved';
    }
    
    const allowedUpdates = [
      'siteDescription', 'advertisingRequirements', 'publishingSections',
      'category', 'additionalCategories', 'keywords', 'country', 'region', 'city', 'additionalCountries',
      'mainLanguage', 'additionalLanguages', 'publishingPrice', 'copywritingPrice',
      'homepageAnnouncementPrice', 'linkType', 'numberOfLinks', 'discountPercentage',
      'acceptedSensitiveCategories', 'sensitiveContentExtraCharge', 'articleEditingPercentage',
      'publishingFormats', 'hideDomain'
    ];
    
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Ensure additionalCategories is always an empty array since we're storing all categories in the main category field
    updates.additionalCategories = [];
    
    // Update the website document with new data
    Object.assign(website, updates);
    
    // Validate the updated document
    const validationError = website.validateSync();
    if (validationError) {
      console.error('Validation error:', validationError.message);
      console.error('Validation errors:', validationError.errors);
      return res.status(400).json({
        ok: false,
        message: "Validation failed",
        error: validationError.message,
        details: Object.keys(validationError.errors).reduce((acc, key) => {
          acc[key] = validationError.errors[key].message;
          return acc;
        }, {})
      });
    }
    
    // Save the updated website
    const updatedWebsite = await website.save();
    
    res.status(200).json({
      ok: true,
      message: "Website updated successfully",
      data: updatedWebsite
    });
  } catch (error) {
    console.error('Error updating website:', error);
    if (error.name === 'ValidationError') {
      console.error('Mongoose validation error:', error.message);
      console.error('Validation errors:', error.errors);
      return res.status(400).json({
        ok: false,
        message: "Validation failed",
        error: error.message,
        details: Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {})
      });
    }
    res.status(500).json({
      ok: false,
      message: "Failed to update website",
      error: error.message
    });
  }
};

// Delete website
export const deleteWebsite = async (req, res) => {
  const { websiteId } = req.params;
  
  try {
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.id
    });
    
    if (!website) {
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    await Website.findByIdAndDelete(websiteId);
    
    res.status(200).json({
      ok: true,
      message: "Website deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to delete website",
      error: error.message
    });
  }
};