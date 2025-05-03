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

// Contact page
router.get("/contact", (req, res) => {
    console.log('Handling contact route');
    try {
        res.render("contact", {
            title: 'Contact Us - JobLink',
            isAuthenticated: !!req.session.userId
        });
    } catch (err) {
        console.error('Error rendering contact:', err);
        res.status(500).send('Error rendering contact page');
    }
});

// Handle contact form submission
router.post("/contact", async (req, res) => {
    console.log('Processing contact form submission:', req.body);
    try {
        const { name, email, subject, message } = req.body;
        
        // Here you would typically send an email or save to database
        // For now, we'll just redirect back with a success message
        req.flash('success', 'Thank you for your message. We will get back to you soon!');
        res.redirect('/contact');
    } catch (err) {
        console.error('Error processing contact form:', err);
        req.flash('error', 'There was an error sending your message. Please try again.');
        res.redirect('/contact');
    }
});

module.exports = router; 