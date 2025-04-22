const express = require('express');
const router = express.Router();

// Home route
router.get("/", (req, res) => {
    console.log('Handling root route');
    try {
        // If user is already logged in, redirect to dashboard
        if (req.session.userId) {
            return res.redirect('/dashboard');
        }

        // Otherwise render the landing page
        res.render('index', {
            title: 'Welcome to JobLink',
            user: null
        });
    } catch (err) {
        console.error('Error rendering index:', err);
        res.status(500).send('Error rendering page');
    }
});

// Login page
router.get("/login", (req, res) => {
    console.log('Handling login route');
    try {
        // If user is already logged in, redirect to dashboard
        if (req.session.userId) {
            return res.redirect('/dashboard');
        }
        res.render("login", { error: null });
    } catch (err) {
        console.error('Error rendering login:', err);
        res.status(500).send('Error rendering login page');
    }
});

// Register page
router.get("/register", (req, res) => {
    console.log('Handling register route');
    try {
        // If user is already logged in, redirect to dashboard
        if (req.session.userId) {
            return res.redirect('/dashboard');
        }
        res.render("register", { error: null });
    } catch (err) {
        console.error('Error rendering register:', err);
        res.status(500).send('Error rendering register page');
    }
});

module.exports = router; 