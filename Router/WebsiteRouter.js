import express from "express";
import {
  checkWebsiteExists,
  addWebsite,
  initiateVerification,
  verifyWebsite,
  getWebsite,
  getUserWebsites,
  updateWebsite,
  deleteWebsite
} from "../controller/WebsiteController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Public route to check if website exists
router.get("/check/:domain", checkWebsiteExists);

// Protected routes (require authentication)
router.use(authenticateToken);

// Website CRUD operations
router.post("/", addWebsite);                           // Add new website
router.get("/", getUserWebsites);                       // Get all user's websites
router.get("/:websiteId", getWebsite);                  // Get specific website
router.put("/:websiteId", updateWebsite);               // Update website
router.delete("/:websiteId", deleteWebsite);            // Delete website

// Website verification flow
router.post("/:websiteId/verify/initiate", initiateVerification);  // Step 2: Initiate verification
router.post("/:websiteId/verify", verifyWebsite);                   // Step 3: Verify ownership

export default router;