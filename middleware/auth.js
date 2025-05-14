const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated via session
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

module.exports = {
    isAuthenticated
}; 