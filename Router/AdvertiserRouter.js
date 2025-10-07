import express from "express";
import {
  getAdvertiserDashboard,
  browseWebsites,
  getWebsiteDetails,
  createOrder,
  getAdvertiserOrders,
  reviewSubmittedWork,
  getOrderAnalytics,
  getRecommendedWebsites,
  createBulkOrders,
  getFavoriteWebsites,
  addToFavorites,
  removeFromFavorites,
  createWebsiteChat
} from "../controller/AdvertiserController.js";
import { getOrderDetails } from "../controller/OrderController.js";
import { authenticateToken, requireRole as authorize } from "../middleware/auth.js";
import { uploadMiddleware } from "../middleware/upload.js";
import projectRouter from "./ProjectRouter.js";

const router = express.Router();

// Dashboard route (publicly accessible)
router.get("/dashboard", getAdvertiserDashboard);

// Apply authentication to all other routes
router.use(authenticateToken);
router.use(authorize(['advertiser']));

// Project Management Routes
router.use("/projects", projectRouter);

// Analytics Routes
router.get("/analytics", getOrderAnalytics);

// Website Discovery Routes
router.get("/websites", browseWebsites);
router.get("/websites/search", browseWebsites); // Alias for search
router.get("/websites/recommended", getRecommendedWebsites);

// Favorites Routes (Must be defined BEFORE the :websiteId route to avoid conflicts)
router.get("/websites/favorites", getFavoriteWebsites);
router.post("/websites/:websiteId/favorite", addToFavorites);
router.delete("/websites/:websiteId/favorite", removeFromFavorites);

// Website Details Route (Must be defined AFTER favorites route)
router.get("/websites/:websiteId", getWebsiteDetails);

// Chat Routes
router.post("/websites/chat", createWebsiteChat);

// Order Management Routes
router.post("/orders", uploadMiddleware.fields([
  { name: 'content', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'attachments', maxCount: 5 }
]), createOrder);

// Bulk Order Management Routes
router.post("/orders/bulk", createBulkOrders); // Added bulk order route

router.get("/orders", getAdvertiserOrders);
router.get("/orders/:orderId", getOrderDetails);
router.put("/orders/:orderId/approve", reviewSubmittedWork);
router.post("/orders/:orderId/revision", reviewSubmittedWork);

export default router;