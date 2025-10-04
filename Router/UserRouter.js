import express from "express";
import { LoginUser, registerUser, getUserProfile, updateUserProfile, updateUserRole, uploadProfileImage } from "../controller/UserController.js";
import { authenticateToken } from "../middleware/auth.js";
import { uploadMiddleware } from "../middleware/upload.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", LoginUser);
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, uploadMiddleware.single('profileImage'), updateUserProfile);
router.put("/role", authenticateToken, updateUserRole);
router.post("/profile/image", authenticateToken, uploadMiddleware.single('profileImage'), uploadProfileImage);

export default router;