import jwt from 'jsonwebtoken';
import User from '../model/User.js';

// Middleware to authenticate JWT token
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from cookies or Authorization header
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // More detailed logging for debugging
    if (!token) {
      console.log('Token missing - URL:', req.originalUrl, 'Method:', req.method, 'Headers:', req.headers);
      return res.status(401).json({
        ok: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Special case for our admin user (colabworld@gmail.com)
    // This user doesn't exist in the database but should still have access
    if (decoded.email === 'colabworld@gmail.com' && decoded.role === 'admin') {
      // Create a mock user object
      const mockUser = {
        _id: 'special-admin-id', // Mock ID for this special user
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName || 'Admin',
        lastName: decoded.lastName || 'User'
      };
      
      // Attach mock user to request object
      req.user = mockUser;
      return next();
    }
    
    // Also handle the existing special admin user
    if (decoded.email === 'admin@gmail.com' && decoded.role === 'admin') {
      // Create a mock user object
      const mockUser = {
        _id: 'special-admin-id-2', // Mock ID for this special user
        email: decoded.email,
        role: decoded.role,
        firstName: 'Admin',
        lastName: 'User'
      };
      
      // Attach mock user to request object
      req.user = mockUser;
      return next();
    }
    
    // Get user from database for regular users
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'Invalid token. User not found.'
      });
    }
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        ok: false,
        message: 'Invalid token.'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        ok: false,
        message: 'Token expired.'
      });
    } else {
      return res.status(500).json({
        ok: false,
        message: 'Token verification failed.',
        error: error.message
      });
    }
  }
};

// Middleware to check if user has required role(s)
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        message: 'Authentication required.'
      });
    }
    
    // Convert single role to array for consistency
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. User role: ${req.user.role}`
      });
    }
    
    next();
  };
};

// Helper functions for specific roles
export const requirePublisher = requireRole(['publisher']);
export const requireAdvertiser = requireRole(['advertiser']);
export const requireAdmin = requireRole(['admin']);