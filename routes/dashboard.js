const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

// Dashboard main route
router.get("/", authMiddleware, async (req, res) => {
    console.log('Handling dashboard route');
    console.log('Session:', req.session);
    
    try {
        // Get user data
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            console.log('No user found, destroying session');
            req.session.destroy();
            return res.redirect('/login');
        }

        // Render dashboard with user data
        const dashboardData = {
            user: user,
            newJobs: 5,
            savedJobs: 3,
            recentActivity: [
                "Applied to Software Engineer position at Tech Corp",
                "Viewed Frontend Developer role at WebDev Inc.",
                "Updated your resume"
            ],
            chartData: {
                labels: ["January", "February", "March"],
                values: [10, 20, 30]
            }
        };

        console.log('Rendering dashboard for user:', user.email);
        res.render("dashboard", dashboardData);
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).render("error", { error: "Failed to load dashboard" });
    }
});

// Company Reviews
router.get("/company-reviews", authMiddleware, async (req, res) => {
    const reviews = [
        { companyName: "Tech Innovations Inc.", rating: 4, reviewText: "Great place to work!", date: new Date() },
        { companyName: "Global Solutions Ltd.", rating: 3, reviewText: "Decent work-life balance.", date: new Date() },
    ];
    res.render("company-reviews/_partial", { reviews });
});

// Edit Profile
router.get("/profile/edit", authMiddleware, (req, res) => {
    res.render("profile/edit", { user: req.user });
});

// Saved Jobs
router.get("/saved-jobs", authMiddleware, async (req, res) => {
    const savedJobs = [
        { id: "1", title: "Software Engineer", company: "Awesome Co.", location: "Remote" },
        { id: "2", title: "Data Scientist", company: "Analytics Pro", location: "New York" },
    ];
    res.render("saved-jobs/index", { savedJobs });
});

// Applied Jobs
router.get("/applied-jobs", authMiddleware, async (req, res) => {
    const applications = [
        { jobTitle: "Frontend Developer", companyName: "Web Wizards", appliedDate: new Date(), status: "Pending" },
        { jobTitle: "Backend Engineer", companyName: "Server Side Inc.", appliedDate: new Date(), status: "Reviewed" },
    ];
    res.render("applied-jobs/index", { applications });
});

module.exports = router; 