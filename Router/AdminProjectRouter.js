import express from "express";
import AdminProjectController from "../controllers/AdminProjectController.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Admin Project Management Routes
router.get("/", AdminProjectController.getAllProjects);
router.get("/:projectId", AdminProjectController.getProjectById);
router.put("/:projectId", AdminProjectController.updateProject);
router.delete("/:projectId", AdminProjectController.deleteProject);
router.put("/:projectId/status", AdminProjectController.updateProjectStatus);
router.get("/:projectId/stats", AdminProjectController.getProjectStats);
router.put("/:projectId/stats", AdminProjectController.updateProjectStats);

export default router;