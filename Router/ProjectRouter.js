import express from "express";
import ProjectController from "../controllers/ProjectController.js";
import { authenticateToken, requireAdmin, requireAdvertiser } from "../middleware/auth.js";
import { body } from 'express-validator';

const router = express.Router();

// Validation rules
const createProjectValidation = [
  body('title').notEmpty().withMessage('Project title is required'),
  body('website').isURL().withMessage('Valid website URL is required'),
  body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
  body('budget').isFloat({ min: 0 }).withMessage('Valid budget is required'),
  body('postsRequired').isInt({ min: 1 }).withMessage('Number of posts required must be at least 1')
];

// All routes require authentication
router.use(authenticateToken);

// Advertiser routes - Define these first as they are more specific to the advertiser path
router.post("/", requireAdvertiser, createProjectValidation, ProjectController.createProject);
router.get("/", requireAdvertiser, ProjectController.getAdvertiserProjects);
router.get("/:id", requireAdvertiser, ProjectController.getProjectById);
router.put("/:id", requireAdvertiser, ProjectController.updateProject);
router.delete("/:id", requireAdvertiser, ProjectController.deleteProject);
router.put("/:id/stats", requireAdvertiser, ProjectController.updateProjectStats);

// Admin routes
router.get("/", requireAdmin, ProjectController.getAllProjects);
router.get("/:id", requireAdmin, ProjectController.getProjectById);
router.put("/:id", requireAdmin, ProjectController.updateProject);
router.delete("/:id", requireAdmin, ProjectController.deleteProject);

export default router;