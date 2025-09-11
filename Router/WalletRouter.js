import express from "express";
import {
  getUserWallet,
  getTransactionHistory,
  addPaymentMethod,
  getWithdrawalHistory,
  updateWithdrawalSettings,
  getEarningsAnalytics
} from "../controller/WalletController.js";
import { authenticateToken, requireRole as authorize } from "../middleware/auth.js";
import { uploadMiddleware } from "../middleware/upload.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Wallet Balance and Summary Routes
router.get("/balance", getUserWallet);
router.get("/transactions", getTransactionHistory);

// Payment Methods Management
router.post("/payment-methods", uploadMiddleware.single('verification_document'), addPaymentMethod);

// Earnings and Withdrawals (Publishers)
router.get("/earnings/analytics", authorize(['publisher']), getEarningsAnalytics);
router.get("/withdrawals", authorize(['publisher']), getWithdrawalHistory);
router.put("/withdrawal-settings", authorize(['publisher']), updateWithdrawalSettings);

export default router;