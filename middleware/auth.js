const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token - user not found'
            });
        }
        
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated'
            });
        }
        
        // Add user to request object
        req.user = user;
        next();
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Middleware to check if user has specific permission
const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        // Admin has all permissions
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Check specific permission
        if (req.user.permissions && req.user.permissions[permission]) {
            return next();
        }
        
        return res.status(403).json({
            success: false,
            message: `Permission denied: ${permission} access required`
        });
    };
};

// Middleware to check if user has specific role
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        const userRoles = Array.isArray(roles) ? roles : [roles];
        
        if (userRoles.includes(req.user.role)) {
            return next();
        }
        
        return res.status(403).json({
            success: false,
            message: `Access denied: ${userRoles.join(' or ')} role required`
        });
    };
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    
    next();
};

// Middleware to check if user can access resource
const canAccessResource = (resourceType) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        // Admin can access everything
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Check if user is assigned to the resource
        const resourceId = req.params.id || req.body.id;
        if (!resourceId) {
            return next();
        }
        
        try {
            let resource;
            
            switch (resourceType) {
                case 'customer':
                    resource = await require('../models/Customer').findById(resourceId);
                    break;
                case 'order':
                    resource = await require('../models/Order').findById(resourceId);
                    break;
                case 'inquiry':
                    resource = await require('../models/Inquiry').findById(resourceId);
                    break;
                default:
                    return next();
            }
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }
            
            // Check if user is assigned to this resource
            if (resource.assignedTo && resource.assignedTo.toString() === req.user._id.toString()) {
                return next();
            }
            
            // Check if user created this resource
            if (resource.createdBy && resource.createdBy.toString() === req.user._id.toString()) {
                return next();
            }
            
            // Check permissions
            if (req.user.permissions && req.user.permissions[resourceType]) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                message: `Access denied to ${resourceType}`
            });
            
        } catch (error) {
            console.error('Resource access check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error checking resource access'
            });
        }
    };
};

// Middleware to log user activity
const logActivity = (action) => {
    return (req, res, next) => {
        // Log user activity (you can implement this with a logging service)
        if (req.user) {
            console.log(`[${new Date().toISOString()}] User ${req.user.username} (${req.user._id}) performed ${action}`);
        }
        next();
    };
};

// Middleware to rate limit specific actions
const rateLimitAction = (action, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();
    
    return (req, res, next) => {
        const key = `${req.user?._id || req.ip}-${action}`;
        const now = Date.now();
        const userAttempts = attempts.get(key) || [];
        
        // Remove old attempts outside the window
        const validAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
        
        if (validAttempts.length >= maxAttempts) {
            return res.status(429).json({
                success: false,
                message: `Too many ${action} attempts. Please try again later.`
            });
        }
        
        validAttempts.push(now);
        attempts.set(key, validAttempts);
        
        next();
    };
};

module.exports = {
    authenticateToken,
    checkPermission,
    checkRole,
    requireAdmin,
    canAccessResource,
    logActivity,
    rateLimitAction
};
