const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

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
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user', details: error.message });
    }
});

// @desc    Delete user and all associated records
// @route   DELETE /auth/delete
router.delete("/delete", authMiddleware, async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Delete user and all associated data
        await user.safeDelete();

        // Clear session and cookies
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.clearCookie('connect.sid');
            res.json({ message: 'Account deleted successfully' });
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Error deleting account' });
    }
});

module.exports = router;
