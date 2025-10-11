import httpStatus from 'http-status';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js'

/**
 * Middleware for role-based authentication and authorization
 * @param {Array} allowedRoles - Array of roles that are allowed to access the route
 * @param {Object} options - Additional options
 * @param {Array} options.userAllowedMethods - Array of HTTP methods that users are allowed to access (only applicable if role is 'user')
 * @returns {Function} Express middleware function
 */
const auth = (allowedRoles = [], options = {}) => {
  const { userAllowedMethods = [] } = options;
  
  return async (req, res, next) => {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        throw res.status(401).json(
          {
            code: 401,
            success: false,
            message: "Authentication Token is Required",
            data: null
          }
        );
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Determine if it's a user or admin token
      let user = null;
      let isAdmin = false;
      
      // First try to find in Admin table
      user = await Admin.findByPk(decoded.sub);
      if (user) {
        isAdmin = true;
      } else {
        // If not an admin, try to find in User table
        user = await User.findByPk(decoded.sub);
      }
      
      if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'User not found');
      }

      // Check if user is authorized for the route
      if (allowedRoles.length > 0) {
        // Admins have access to all routes
        if (!isAdmin) {
          // For non-admin users, check if their role is in the allowed roles
          const userRole = user.role || 'user';
          if (!allowedRoles.includes(userRole)) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
          }
          
          // Check if the HTTP method is allowed for users
          if (userAllowedMethods.length > 0 && !userAllowedMethods.includes(req.method)) {
            throw new ApiError(httpStatus.FORBIDDEN, 'This HTTP method is not allowed for your role');
          }
        }
      }

      // Add user and role information to request object
      req.user = user;
      req.isAdmin = isAdmin;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        next(new ApiError(httpStatus.UNAUTHORIZED, 'Token expired'));
      } else if (error.name === 'JsonWebTokenError') {
        next(new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token'));
      } else {
        next(error);
      }
    }
  };
};

export default auth;
