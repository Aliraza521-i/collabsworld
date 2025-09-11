import User from "../model/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import generateToken from "../service/Token.js";

export const registerUser = async (req, res) => {
  const { firstName, lastName, email, password,  phoneNumber, role } =
    req.body;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ ok: false, message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    
      phoneNumber,
      role,
    });

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const savedUser = await user.save();

    res.status(201).json({
      ok: true,
      message: "User registered succcessfully",
      token,
      data: savedUser,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

export const LoginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Special admin user with email "colabworld@gmail.com" and password "123456"
    if (email === "colabworld@gmail.com" && password === "123456") {
      // Create a mock admin user object
      const adminUser = {
        email: "colabworld@gmail.com",
        role: "admin",
        firstName: "Admin",
        lastName: "User"
      };
      
      const token = jwt.sign(
        { 
          email: adminUser.email, 
          role: adminUser.role,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName
        }, 
        process.env.JWT_SECRET, 
        {
          expiresIn: "1d",
        }
      );

      return res.status(200).json({
        ok: true,
        message: "Admin login successful",
        token,
        role: "admin",
        data: adminUser
      });
    }
    
    // Also keep the existing special admin user
    if (email === "admin@gmail.com" && password === "123456") {
      const token = jwt.sign({ email, role: "admin" }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      return res.status(200).json({
        ok: true,
        message: "Admin login successful",
        token,
        role: "admin",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ ok: false, message: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ ok: false, message: "Incorrect password" });
    }

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      ok: true,
      message: "Login successful",
      token,
      role: user.role,
      data: user,
    });
  } catch (error) {
    res
      .status(500)
      .json({ ok: false, message: "Login failed", error: error.message });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }
    res.status(200).json({ ok: true, data: user });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error", error: error.message });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // Update fields if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    const updatedUser = await user.save();
    
    res.status(200).json({ 
      ok: true, 
      message: "Profile updated successfully", 
      data: updatedUser 
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error", error: error.message });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { newRole } = req.body;
    const userId = req.user.id;
    
    // Validate role
    if (!['publisher', 'advertiser', 'admin'].includes(newRole)) {
      return res.status(400).json({ 
        ok: false, 
        message: "Invalid role specified" 
      });
    }
    
    // Update user role in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true, select: '-password' }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ 
        ok: false, 
        message: "User not found" 
      });
    }
    
    // Generate new token with updated role
    const newToken = generateToken(updatedUser);
    
    res.status(200).json({ 
      ok: true, 
      message: "Role updated successfully", 
      token: newToken,
      data: updatedUser 
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      message: "Failed to update role", 
      error: error.message 
    });
  }
};