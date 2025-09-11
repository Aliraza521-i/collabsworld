import express from "express";
import {
  getPublisherDashboard,
  getPublisherOrders,
  approveOrder,
  rejectOrder,
  submitOrder,
  createOrder,
  getOrderDetails,
  addOrderMessage,
  createOrderChat
} from "../controller/OrderController.js";
import { authenticateToken, requirePublisher, requireAdvertiser } from "../middleware/auth.js";

const router = express.Router();

// Publisher Dashboard Data (publicly accessible)
router.get("/dashboard", getPublisherDashboard);

// All other routes require authentication
router.use(authenticateToken);

// Publisher Order Management
router.get("/publisher", requirePublisher, getPublisherOrders);
router.put("/:orderId/approve", requirePublisher, approveOrder);
router.put("/:orderId/reject", requirePublisher, rejectOrder);
router.put("/:orderId/submit", requirePublisher, submitOrder);

// Advertiser Order Management
router.post("/", requireAdvertiser, createOrder);

// Shared endpoints (both publisher and advertiser)
router.get("/:orderId", getOrderDetails);
router.post("/:orderId/messages", addOrderMessage);
router.post("/:orderId/chat", createOrderChat);

export default router;