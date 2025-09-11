import express from "express";
import { LoginUser, registerUser, getUserProfile, updateUserProfile, updateUserRole } from "../controller/UserController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", LoginUser);
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, updateUserProfile);
router.put("/role", authenticateToken, updateUserRole);

export default router;