const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// @desc    Register new user
// @route   POST /auth/register
router.post("/register", authController.register);

// @desc    Login user
// @route   POST /auth/login
router.post("/login", authController.login);

// @desc    Logout user
// @route   POST /auth/logout
router.post("/logout", (req, res) => {
    try {
        // Clear the session
        req.session.destroy();
        // Clear the token cookie
        res.clearCookie('token');
        res.redirect('/login');
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// @desc    Get current user
// @route   GET /auth/me
router.get("/me", authMiddleware, authController.getCurrentUser);

module.exports = router;
