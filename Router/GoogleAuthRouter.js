import express from "express";
import {
  handleGoogleCallback,
  getGoogleAuthUrl,
  verifyWithGoogleTokens
} from "../controller/GoogleAuthController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Public route for OAuth callback
router.get("/google/callback", handleGoogleCallback);

// Protected routes (require authentication)
router.use(authenticateToken);

// Get Google Auth URL for verification
router.get("/google/auth-url/:websiteId", getGoogleAuthUrl);

// Verify with Google tokens after OAuth
router.post("/google/verify/:websiteId", verifyWithGoogleTokens);

export default router;