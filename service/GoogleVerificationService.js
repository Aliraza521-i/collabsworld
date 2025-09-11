import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class GoogleVerificationService {
  constructor() {
    // Google OAuth configuration - Add these to your .env file
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback';
    
    // Initialize OAuth2 client with explicit redirect URI
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  // Generate verification data for different methods
  generateVerificationData(method, domain) {
    const timestamp = Date.now();
    const code = `verification-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    
    switch (method) {
      case 'google_analytics':
        return {
          code,
          instructions: 'Add this tracking code to your Google Analytics property',
          nextStep: 'google_auth',
          fileContent: null
        };
        
      case 'google_search_console':
        return {
          code,
          instructions: 'Verify this domain in Google Search Console',
          nextStep: 'google_auth',
          fileContent: null
        };
        
      case 'html_file':
        const fileName = `${code}.html`;
        const fileContent = `<!DOCTYPE html>
<html>
<head>
    <title>Website Verification</title>
    <meta name="verification-code" content="${code}">
</head>
<body>
    <h1>Website Verification</h1>
    <p>Verification Code: ${code}</p>
    <p>This file verifies ownership of ${domain}</p>
</body>
</html>`;
        
        return {
          code,
          instructions: `Upload this file to your website root: ${domain}/${fileName}`,
          nextStep: 'verify_file',
          fileContent,
          fileName
        };
        
      case 'another_method':
        return {
          code,
          instructions: 'Provide a reason for using an alternative verification method',
          nextStep: 'provide_reason',
          fileContent: null
        };
        
      default:
        throw new Error('Invalid verification method');
    }
  }

  // Generate Google OAuth URL
  getGoogleAuthUrl(websiteId, method) {
    const scopes = [];
    
    if (method === 'google_analytics') {
      // Updated scopes for Google Analytics Reporting API v4 and Management API
      scopes.push(
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/analytics'
      );
    }
    
    if (method === 'google_search_console') {
      // Updated scopes for Google Search Console
      scopes.push(
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/webmasters'
      );
    }

    const state = JSON.stringify({ websiteId, method });
    
    // Log the parameters being used
    // console.log('=== Generating Google Auth URL ===');
    // console.log('- Method:', method);
    // console.log('- Website ID:', websiteId);
    // console.log('- Scopes:', scopes);
    // console.log('- State:', state);
    // console.log('- Redirect URI in OAuth2 client:', this.oauth2Client.redirectUri);
    
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent'
    });

    // console.log('- Generated Auth URL:', authUrl);
    // console.log('==================================');
    return authUrl;
  }

  // Handle OAuth callback
  async handleOAuthCallback(code) {
    try {
      // console.log('=== Exchanging OAuth Code for Tokens ===');
      // console.log('- Received code:', code);
      // console.log('- Using redirect URI:', this.redirectUri);
      
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // console.log('- Successfully obtained tokens');
      // console.log('========================================');
      return tokens;
    } catch (error) {
      // console.error('=== OAuth Callback Error ===');
      // console.error('- Error:', error);
      // console.error('- Code:', code);
      // console.error('- Redirect URI:', this.redirectUri);
      // console.error('==============================');
      throw new Error(`OAuth callback failed: ${error.message}`);
    }
  }

  // Verify Google Analytics
  async verifyGoogleAnalytics(domain, verificationCode, tokens) {
    try {
      this.oauth2Client.setCredentials(tokens);
      
      // Use the Analytics Management API v3
      const analytics = google.analytics({ version: 'v3', auth: this.oauth2Client });
      
      try {
        // Get analytics accounts
        const accountsResponse = await analytics.management.accounts.list();
        const accounts = accountsResponse.data.items || [];
        
        // console.log(`=== Google Analytics Verification ===`);
        // console.log(`Domain to verify: ${domain}`);
        // console.log(`Found ${accounts.length} Google Analytics accounts`);
        
        // Check each account for the domain
        for (const account of accounts) {
          try {
            // console.log(`Checking account: ${account.name} (${account.id})`);
            
            // Get web properties for this account
            const propertiesResponse = await analytics.management.webproperties.list({
              accountId: account.id
            });
            
            const properties = propertiesResponse.data.items || [];
            // console.log(`Found ${properties.length} properties in account ${account.id}`);
            
            // Check each property
            for (const property of properties) {
              const websiteUrl = property.websiteUrl;
              // console.log(`Checking property: ${property.name} (${property.id}) with URL: ${websiteUrl}`);
              
              // Normalize both URLs for comparison
              const normalizedDomain = this.normalizeUrl(domain);
              const normalizedWebsiteUrl = this.normalizeUrl(websiteUrl);
              
              // console.log(`Comparing normalized URLs:`);
              // console.log(`  Domain to verify: ${normalizedDomain}`);
              // console.log(`  Property URL:     ${normalizedWebsiteUrl}`);
              
              // Check if domain matches (exact match or substring)
              if (this.urlsMatch(normalizedDomain, normalizedWebsiteUrl)) {
                // console.log('✅ Domain match found!');
                return {
                  verified: true,
                  details: {
                    accountId: account.id,
                    propertyId: property.id,
                    websiteUrl: websiteUrl,
                    accountName: account.name,
                    propertyName: property.name
                  }
                };
              }
            }
          } catch (propertyError) {
            // Continue to next account if there's an error with this one
            // console.log(`Error checking properties for account ${account.id}:`, propertyError.message);
            continue;
          }
        }
        
        // If we get here, no matching domain was found
        // console.log('❌ No matching domain found in Google Analytics properties');
        return {
          verified: false,
          error: 'Domain not found in your Google Analytics properties. Please ensure the website is properly set up in Google Analytics with the exact domain name you entered.'
        };
        
      } catch (accountsError) {
        // console.log('Error fetching accounts:', accountsError.message);
        
        // Check if it's an API not enabled error
        if (accountsError.message && accountsError.message.includes('API has not been used')) {
          return {
            verified: false,
            error: 'Google Analytics API has not been enabled in your Google Cloud project. Please enable it by visiting https://console.developers.google.com/apis/api/analytics.googleapis.com/overview?project=305901888028 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.'
          };
        }
        
        return {
          verified: false,
          error: `Failed to access Google Analytics accounts: ${accountsError.message}`
        };
      }
      
    } catch (error) {
      console.error('Google Analytics verification error:', error);
      
      // Check if it's an API not enabled error
      if (error.message && error.message.includes('API has not been used')) {
        return {
          verified: false,
          error: 'Google Analytics API has not been enabled in your Google Cloud project. Please enable it by visiting https://console.developers.google.com/apis/api/analytics.googleapis.com/overview?project=305901888028 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.'
        };
      }
      
      return {
        verified: false,
        error: `Google Analytics verification failed: ${error.message}`
      };
    }
  }

  // Helper function to normalize URLs for comparison
  normalizeUrl(url) {
    if (!url) return '';
    
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')  // Remove protocol
      .replace(/^www\./, '')        // Remove www
      .replace(/\/$/, '');          // Remove trailing slash
  }

  // Helper function to check if URLs match
  urlsMatch(domain1, domain2) {
    // Exact match
    if (domain1 === domain2) return true;
    
    // Check if one contains the other
    if (domain1.includes(domain2) || domain2.includes(domain1)) return true;
    
    // Handle common variations
    const variations = [
      domain1,
      `www.${domain1}`,
      `http://${domain1}`,
      `https://${domain1}`,
      `http://www.${domain1}`,
      `https://www.${domain1}`
    ];
    
    return variations.includes(domain2);
  }

  // Verify Google Search Console
  async verifySearchConsole(domain, tokens) {
    try {
      // console.log('=== Google Search Console Verification ===');
      // console.log('Domain to verify:', domain);
      
      this.oauth2Client.setCredentials(tokens);
      const searchconsole = google.searchconsole({ version: 'v1', auth: this.oauth2Client });
      
      // Get verified sites
      // console.log('Fetching verified sites from Search Console...');
      const sites = await searchconsole.sites.list();
      // console.log('Sites response:', sites.data);
      
      if (!sites.data.siteEntry || sites.data.siteEntry.length === 0) {
        // console.log('No sites found in Search Console');
        return {
          verified: false,
          error: 'No verified sites found in your Google Search Console. Please verify your website in Google Search Console first.'
        };
      }
      
      // Normalize the domain for comparison
      const normalizedDomain = this.normalizeUrl(domain);
      // console.log('Normalized domain:', normalizedDomain);
      
      // Check all possible domain variations
      const domainVariations = [
        normalizedDomain,
        `www.${normalizedDomain}`,
        `http://${normalizedDomain}`,
        `https://${normalizedDomain}`,
        `http://www.${normalizedDomain}`,
        `https://www.${normalizedDomain}`,
        `${normalizedDomain}/`,
        `www.${normalizedDomain}/`,
        `http://${normalizedDomain}/`,
        `https://${normalizedDomain}/`,
        `http://www.${normalizedDomain}/`,
        `https://www.${normalizedDomain}/`
      ];
      
      // console.log('Checking domain variations:', domainVariations);
      
      // Check if any domain variation is verified
      for (const site of sites.data.siteEntry) {
        // console.log(`Checking site: ${site.siteUrl} with permission: ${site.permissionLevel}`);
        
        // Check if this site matches any of our domain variations
        const siteUrl = this.normalizeUrl(site.siteUrl);
        // console.log(`Normalized site URL: ${siteUrl}`);
        
        if (domainVariations.includes(siteUrl) && site.permissionLevel === 'siteOwner') {
          // console.log('✅ Domain match found in Search Console!');
          return {
            verified: true,
            details: {
              siteUrl: site.siteUrl,
              permissionLevel: site.permissionLevel
            }
          };
        }
        
        // Also check if the site URL contains our domain
        if (siteUrl.includes(normalizedDomain) && site.permissionLevel === 'siteOwner') {
          // console.log('✅ Domain substring match found in Search Console!');
          return {
            verified: true,
            details: {
              siteUrl: site.siteUrl,
              permissionLevel: site.permissionLevel
            }
          };
        }
      }
      
      // console.log('❌ No matching domain found in Search Console');
      return {
        verified: false,
        error: 'Domain not found or not verified in Google Search Console. Please ensure the website is properly verified in Google Search Console with the exact domain name you entered.'
      };
      
    } catch (error) {
      console.error('Google Search Console verification error:', error);
      
      // Check if it's an API not enabled error
      if (error.message && error.message.includes('API has not been used')) {
        return {
          verified: false,
          error: 'Google Search Console API has not been enabled in your Google Cloud project. Please enable it by visiting https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=305901888028 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.'
        };
      }
      
      return {
        verified: false,
        error: `Google Search Console verification failed: ${error.message}`
      };
    }
  }

  // Verify HTML file
  async verifyHtmlFile(domain, verificationCode) {
    try {
      // Clean domain URL
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const fileName = `${verificationCode}.html`;
      const fileUrl = `http://${cleanDomain}/${fileName}`;
      const httpsUrl = `https://${cleanDomain}/${fileName}`;
      
      // Try HTTPS first, then HTTP
      let response;
      try {
        response = await axios.get(httpsUrl, { timeout: 10000 });
      } catch (httpsError) {
        response = await axios.get(fileUrl, { timeout: 10000 });
      }
      
      // Check if file contains verification code
      if (response.data.includes(verificationCode)) {
        return {
          verified: true,
          details: {
            fileUrl: response.config.url,
            verificationCode
          }
        };
      }
      
      return {
        verified: false,
        error: 'Verification code not found in the uploaded file'
      };
    } catch (error) {
      return {
        verified: false,
        error: `HTML file verification failed: ${error.message}`
      };
    }
  }
}

export default new GoogleVerificationService();