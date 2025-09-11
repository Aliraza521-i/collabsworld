import express from "express";
import {
  createChat,
  getUserChats,
  sendMessage,
  getChatMessages,
  updateChatSettings,
  searchMessages,
  getChatAnalytics,
  archiveChat
} from "../controller/ChatController.js";
import { authenticateToken, requireRole as authorize } from "../middleware/auth.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { chatValidation } from "../middleware/validation.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Chat Management Routes
router.post("/", chatValidation.createChat, createChat);
router.get("/", getUserChats);
router.get("/:chatId", getChatMessages);
router.put("/:chatId/archive", archiveChat);

// Chat Settings
router.put("/:chatId/settings", updateChatSettings);

// Message Operations
router.get("/:chatId/messages", getChatMessages);
router.post("/:chatId/messages", chatValidation.sendMessage, sendMessage);

// Search and Analytics
router.get("/:chatId/search", searchMessages);
router.get("/:chatId/analytics", getChatAnalytics);

export default router;