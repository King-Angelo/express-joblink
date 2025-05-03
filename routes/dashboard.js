const express = require('express');
const router = express.Router();
const User = require('../models/User');
const JobAlert = require('../models/JobAlert');
const JobApplication = require('../models/JobApplication');
const { authMiddleware } = require('../middleware/authMiddleware');
const Job = require('../models/Job');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Dashboard route
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Get unread job alerts
        const unreadAlerts = await JobAlert.find({
            userId: req.session.userId,
            isRead: false
        }).sort({ postedDate: -1 });

        // Get recent job alerts (both read and unread)
        const recentAlerts = await JobAlert.find({
            userId: req.session.userId
        }).sort({ postedDate: -1 }).limit(5);

        // Fetch active jobs
        const jobs = await Job.find({ isActive: true })
            .sort({ postedDate: -1 })
            .limit(5);

        res.render('dashboard', {
            user,
            newJobs: unreadAlerts.length,
            recentAlerts,
            jobs,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
});

// Mark job alert as read
router.post('/alerts/:alertId/read', isAuthenticated, async (req, res) => {
    try {
        await JobAlert.findByIdAndUpdate(req.params.alertId, { isRead: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking alert as read:', error);
        res.status(500).json({ success: false, error: 'Error marking alert as read' });
    }
});

// Get all job alerts
router.get('/alerts', isAuthenticated, async (req, res) => {
    try {
        const alerts = await JobAlert.find({
            userId: req.session.userId
        }).sort({ postedDate: -1 });

        res.render('alerts', {
            alerts,
            user: await User.findById(req.session.userId)
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).render('error', { message: 'Error loading job alerts' });
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
router.get("/applications", isAuthenticated, async (req, res) => {
    try {
        const applications = await JobApplication.find({
            userId: req.session.userId
        }).sort({ appliedDate: -1 });

        res.render("applications", {
            applications,
            user: await User.findById(req.session.userId)
        });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).render('error', { message: 'Error loading job applications' });
    }
});

// Update application status
router.post("/applications/:id/status", isAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        const application = await JobApplication.findOneAndUpdate(
            { _id: req.params.id, userId: req.session.userId },
            { status },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }

        res.json({ success: true, application });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ success: false, error: 'Error updating application status' });
    }
});

// Add notes to application
router.post("/applications/:id/notes", isAuthenticated, async (req, res) => {
    try {
        const { notes } = req.body;
        const application = await JobApplication.findOneAndUpdate(
            { _id: req.params.id, userId: req.session.userId },
            { notes },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }

        res.json({ success: true, application });
    } catch (error) {
        console.error('Error updating application notes:', error);
        res.status(500).json({ success: false, error: 'Error updating application notes' });
    }
});

// Update next steps
router.post("/applications/:id/next-steps", isAuthenticated, async (req, res) => {
    try {
        const { nextSteps, interviewDate } = req.body;
        const application = await JobApplication.findOneAndUpdate(
            { _id: req.params.id, userId: req.session.userId },
            { nextSteps, interviewDate },
            { new: true }
        );

        if (!application) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }

        res.json({ success: true, application });
    } catch (error) {
        console.error('Error updating next steps:', error);
        res.status(500).json({ success: false, error: 'Error updating next steps' });
    }
});

// Create sample application (temporary route for testing)
router.get('/create-sample-application', isAuthenticated, async (req, res) => {
    try {
        const sampleApplication = new JobApplication({
            userId: req.session.userId,
            jobTitle: "Senior Software Engineer",
            company: "Tech Innovators Inc.",
            location: "San Francisco, CA",
            status: "Pending",
            appliedDate: new Date(),
            salary: "$120,000 - $150,000",
            notes: "Initial application submitted. Following up in a week.",
            nextSteps: "Prepare for technical interview"
        });

        await sampleApplication.save();
        res.redirect('/dashboard/applications');
    } catch (error) {
        console.error('Error creating sample application:', error);
        res.status(500).render('error', { message: 'Error creating sample application' });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    try {
        // Get the current user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect("/login");
        }

        // Fetch active jobs
        const jobs = await Job.find({ isActive: true })
            .sort({ postedDate: -1 })
            .limit(5); // Show 5 most recent jobs

        res.render("dashboard", {
            user,
            jobs,
            isAuthenticated: true
        });
    } catch (error) {
        console.error("Error loading dashboard:", error);
        res.status(500).render("error", {
            message: "Error loading dashboard",
            error: error.message
        });
    }
});

module.exports = router; 