const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // Check for session-based authentication
    if (req.session.user) {
      req.user = req.session.user;
      return next();
    }

    // Check for JWT token
    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.redirect('/login');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.redirect('/login');
    }

    // Add user to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.redirect('/login');
  }
}; 