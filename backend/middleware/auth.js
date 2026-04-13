const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT secret — MUST be set in .env, no hardcoded fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('⚠️  CRITICAL: JWT_SECRET not set in .env — auth will reject all tokens until set');
}

const auth = async (req, res, next) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ status: 'error', message: 'Server auth not configured. Set JWT_SECRET in .env.' });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid token or user not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Token expired.' 
      });
    }
    
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error during authentication.' 
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

const adminAuth = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Access denied. Admin privileges required.' 
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error during admin authentication.' 
    });
  }
};

module.exports = { auth, optionalAuth, adminAuth };