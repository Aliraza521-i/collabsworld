import GoogleVerificationService from "../service/GoogleVerificationService.js";
import Website from "../model/Website.js";

// Handle Google OAuth callback
export const handleGoogleCallback = async (req, res) => {
  // console.log('=== Google OAuth Callback Received ===');
  // console.log('- Query parameters:', req.query);
  
  const { code, state } = req.query;
  
  try {
    if (!code) {
      // console.log('ERROR: Authorization code not provided');
      return res.status(400).json({ 
        ok: false,
        message: "Authorization code not provided"
      });
    }
    
    // Parse state to get websiteId and method
    const stateData = JSON.parse(state || '{}');
    const { websiteId, method } = stateData;
    
    // console.log('- Parsed state data:', stateData);
    
    if (!websiteId || !method) {
      // console.log('ERROR: Invalid state parameter');
      return res.status(400).json({
        ok: false,
        message: "Invalid state parameter"
      });
    }
    
    // Exchange code for tokens
    // console.log('Exchanging code for tokens...');
    const tokens = await GoogleVerificationService.handleOAuthCallback(code);
    
    // Store tokens temporarily (in production, you might want to encrypt these)
    // For now, we'll return them to the frontend to send back for verification
    
    // Redirect to frontend with success and tokens
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verification-success?websiteId=${websiteId}&method=${method}&tokens=${encodeURIComponent(JSON.stringify(tokens))}`;
    
    // console.log('Redirecting to frontend success URL:', redirectUrl);
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    
    // Redirect to frontend with error
    const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verification-error?error=${encodeURIComponent(error.message)}`;
    // console.log('Redirecting to frontend error URL:', errorUrl);
    res.redirect(errorUrl);
  }
};

// Get Google Auth URL for verification
export const getGoogleAuthUrl = async (req, res) => {
  // console.log('=== Get Google Auth URL Request ===');
  // console.log('- Params:', req.params);
  // console.log('- Query:', req.query);
  
  const { websiteId } = req.params;
  const { method } = req.query;
  
  try {
    // Verify website exists and belongs to user
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.id
    });
    
    if (!website) {
      // console.log('ERROR: Website not found or access denied');
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    // Generate Google Auth URL
    // console.log('Generating Google Auth URL...');
    const authUrl = GoogleVerificationService.getGoogleAuthUrl(websiteId, method);
    
    // console.log('Sending auth URL to frontend:', authUrl);
    
    res.status(200).json({
      ok: true,
      data: {
        authUrl,
        websiteId,
        method
      }
    });
    
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      ok: false,
      message: "Failed to generate auth URL",
      error: error.message
    });
  }
};
  
// Verify with Google tokens (called after OAuth flow)
export const verifyWithGoogleTokens = async (req, res) => {
  // console.log('=== Verify with Google Tokens ===');
  // console.log('- Params:', req.params);
  // console.log('- Body:', req.body);
  
  const { websiteId } = req.params;
  const { tokens, method } = req.body;
  
  try {
    const website = await Website.findOne({
      _id: websiteId,
      userId: req.user.id
    });
    
    if (!website) {
      // console.log('ERROR: Website not found or access denied');
      return res.status(404).json({
        ok: false,
        message: "Website not found or access denied"
      });
    }
    
    // console.log(`Verifying website: ${website.domain} using method: ${method}`);
    
    let verificationResult;
    
    // Perform verification based on method
    if (method === 'google_analytics') {
      // console.log('Starting Google Analytics verification...');
      verificationResult = await GoogleVerificationService.verifyGoogleAnalytics(
        website.domain,
        website.googleAnalyticsCode,
        tokens
      );
    } else if (method === 'google_search_console') {
      // console.log('Starting Google Search Console verification...');
      verificationResult = await GoogleVerificationService.verifySearchConsole(
        website.domain,
        tokens
      );
    } else {
      // console.log('ERROR: Invalid verification method');
      return res.status(400).json({
        ok: false,
        message: "Invalid verification method"
      });
    }
    
    // console.log('Verification result:', verificationResult);
    
    // Update website verification status
    if (verificationResult.verified) {
      // console.log('✅ Website verification successful');
      website.verificationStatus = 'verified';
      website.verifiedAt = new Date();
      website.status = 'submitted';
    } else {
      // console.log('❌ Website verification failed');
      website.verificationStatus = 'failed';
      website.verificationAttempts += 1;
    }
    
    website.lastVerificationAttempt = new Date();
    await website.save();
    
    const response = {
      ok: verificationResult.verified,
      message: verificationResult.verified 
        ? "Website verified successfully!" 
        : verificationResult.error,
      data: {
        verificationStatus: website.verificationStatus,
        status: website.status,
        verificationDetails: verificationResult.details
      }
    };
    
    // console.log('Sending response:', response);
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      ok: false,
      message: "Verification failed",
      error: error.message
    });
  }
};