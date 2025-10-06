import express from "express";
import {
  getAdminDashboard,
  getAllUsers,
  getPendingWebsites,
  getAllWebsites, // Add this import
  reviewWebsite,
  getAllOrders,
  getFinancialOverview,
  getAnalytics,
  manageUserAccount,
  updateWebsiteVerificationSettings,
  getAllChats,
  updateWebsiteMetrics // Add this import
} from "../controller/AdminController.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import User from "../model/User.js";
import { Notification } from "../Models/NotificationModel.js";

const router = express.Router();

// Dashboard Overview (publicly accessible)
router.get("/dashboard", getAdminDashboard);

// All other routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Chat Management
router.get("/chats", getAllChats);

// User Management
router.get("/users", getAllUsers);
router.put("/users/:userId/manage", manageUserAccount);
// Add missing user management routes
router.put("/users/:userId/suspend", (req, res) => {
  req.body = { action: 'suspend', reason: req.body.reason || 'Admin action' };
  return manageUserAccount(req, res);
});
router.put("/users/:userId/activate", (req, res) => {
  req.body = { action: 'activate' };
  return manageUserAccount(req, res);
});
router.put("/users/:userId/verify", (req, res) => {
  req.body = { action: 'verify' };
  return manageUserAccount(req, res);
});
router.delete("/users/:userId", (req, res) => {
  req.body = { action: 'delete' };
  return manageUserAccount(req, res);
});

// Bulk user actions
router.post("/users/bulk-action", async (req, res) => {
  try {
    const { userIds, action } = req.body;
    
    // Validate input
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "User IDs are required"
      });
    }
    
    if (!action || !['suspend', 'activate'].includes(action)) {
      return res.status(400).json({
        ok: false,
        message: "Valid action (suspend/activate) is required"
      });
    }
    
    // Apply action to all users
    const results = [];
    for (const userId of userIds) {
      try {
        // We'll handle each user action individually
        const user = await User.findById(userId);
        if (!user || user.role === 'admin') {
          results.push({ userId, success: false, error: "User not found or cannot be modified" });
          continue;
        }
        
        switch (action) {
          case 'suspend':
            user.isSuspended = true;
            await user.save();
            await Notification.create({
              userId: user._id,
              userRole: user.role,
              type: 'user_suspended',
              title: 'Account Suspended',
              message: `Your account has been suspended. Reason: Bulk action by admin`,
              channels: {
                email: { sent: true },
                inApp: { delivered: true }
              }
            });
            break;
            
          case 'activate':
            user.isSuspended = false;
            await user.save();
            await Notification.create({
              userId: user._id,
              userRole: user.role,
              type: 'user_suspended',
              title: 'Account Activated',
              message: 'Your account has been reactivated.',
              channels: {
                email: { sent: true },
                inApp: { delivered: true }
              }
            });
            break;
        }
        
        results.push({ userId, success: true });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    res.status(200).json({
      ok: true,
      message: `Bulk ${action} action completed`,
      results
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to perform bulk action",
      error: error.message
    });
  }
});

// Website Management
// Add missing website management routes FIRST (more specific)
router.put("/websites/:websiteId/approve", (req, res) => {
  req.body = { action: 'approve' };
  return reviewWebsite(req, res);
});

router.put("/websites/:websiteId/reject", (req, res) => {
  req.body = { action: 'reject', reason: req.body.reason || 'Quality standards not met' };
  return reviewWebsite(req, res);
});

router.put("/websites/:websiteId/pause", (req, res) => {
  req.body = { action: 'request_info', reason: 'Additional information required' };
  return reviewWebsite(req, res);
});

// Add new route to update website SEO metrics
router.put("/websites/:websiteId/metrics", updateWebsiteMetrics);

// Admin delete website route
router.delete("/websites/:websiteId", async (req, res) => {
  try {
    const { websiteId } = req.params;
    
    // Use the existing reviewWebsite function with delete action
    req.body = { action: 'delete' };
    req.params.websiteId = websiteId;
    
    return reviewWebsite(req, res);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Failed to delete website",
      error: error.message
    });
  }
});

// Add new route to get all websites
router.get("/websites", getAllWebsites);

// General review route (should come AFTER specific routes)
router.get("/websites/pending", getPendingWebsites);
router.put("/websites/:websiteId/review", reviewWebsite);
router.put("/websites/:websiteId/verification-settings", updateWebsiteVerificationSettings);

// Order Management
router.get("/orders", getAllOrders);

// Financial Management
router.get("/finance", getFinancialOverview);

// Analytics
router.get("/analytics", getAnalytics);

export default router;