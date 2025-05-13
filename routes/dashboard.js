const express = require('express');
const router = express.Router();
const User = require('../models/User');
const JobAlert = require('../models/JobAlert');
const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');
const Employer = require('../models/Employer');

// Middleware to check if user is authenticated and has the correct user type
const checkUserType = (allowedTypes) => {
    return (req, res, next) => {
        if (!req.session.userId || !req.session.userType) {
        return res.redirect('/login');
    }
        
        if (!allowedTypes.includes(req.session.userType)) {
            return res.redirect(`/${req.session.userType}/dashboard`);
        }
        
    next();
    };
};

// Jobseeker Dashboard
router.get('/', checkUserType(['jobseeker']), async (req, res) => {
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

        // Fetch agencies and employers
        const agencies = await User.find({
            userType: { $in: ['agency', 'employer'] },
            deletedAt: { $exists: false },
            'agencyProfile.agencyName': { $exists: true, $ne: '' }
        })
        .select('agencyProfile.agencyName email description location website userType')
        .sort({ 'agencyProfile.agencyName': 1 });

        // Transform the data to match the view's expectations
        const transformedAgencies = agencies.map(agency => ({
            _id: agency._id,
            companyName: agency.agencyProfile.agencyName,
            email: agency.email,
            description: agency.description || 'No description available',
            location: agency.location || 'Location not specified',
            website: agency.website,
            userType: agency.userType
        }));

        res.render('dashboard', {
            user,
            firstName: user.firstName,
            newJobs: unreadAlerts.length,
            recentAlerts,
            jobs,
            agencies: transformedAgencies,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading dashboard' });
    }
});

// Agency Dashboard
router.get('/agency', checkUserType(['agency']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        res.render('agency/dashboard', {
            user,
            agencyName: user.agencyProfile?.agencyName
        });
    } catch (error) {
        console.error('Agency dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading agency dashboard' });
    }
});

// Employer Dashboard
router.get('/employer', checkUserType(['employer']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        res.render('employer/dashboard', {
            user,
            firstName: user.firstName
        });
    } catch (error) {
        console.error('Employer dashboard error:', error);
        res.status(500).render('error', { message: 'Error loading employer dashboard' });
    }
});

// Employer Company Profile
router.get('/employer/profile', checkUserType(['employer']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Get or create employer profile
        let employer = await Employer.findOne({ user: req.session.userId });
        if (!employer) {
            employer = new Employer({
                user: req.session.userId,
                companyName: user.title || 'Unnamed Company',
                companyDescription: user.description || '',
                industry: '',
                companySize: '1-10',
                location: user.location || '',
                contactEmail: user.email,
                contactPhone: user.phone || ''
            });
            await employer.save();
        }

        res.render('employer/profile', {
            user,
            employer,
            success: req.query.success
        });
    } catch (error) {
        console.error('Error loading employer profile:', error);
        res.status(500).render('error', { message: 'Error loading employer profile' });
    }
});

// Update Employer Company Profile
router.post('/employer/profile', checkUserType(['employer']), async (req, res) => {
    try {
        const {
            companyName,
            companyDescription,
            industry,
            companySize,
            location,
            contactEmail,
            contactPhone,
            website
        } = req.body;

        // Update or create employer profile
        const employer = await Employer.findOneAndUpdate(
            { user: req.session.userId },
            {
                companyName,
                companyDescription,
                industry,
                companySize,
                location,
                contactEmail,
                contactPhone,
                website
            },
            { new: true, upsert: true }
        );

        // Update user profile with basic info
        await User.findByIdAndUpdate(req.session.userId, {
            title: companyName,
            description: companyDescription,
            location: location,
            email: contactEmail,
            phone: contactPhone
        });

        res.redirect('/dashboard/employer/profile?success=true');
    } catch (error) {
        console.error('Error updating employer profile:', error);
        res.status(500).render('error', { message: 'Error updating employer profile' });
    }
});

// Job Alerts
router.get('/alerts', checkUserType(['jobseeker']), async (req, res) => {
    try {
        const alerts = await JobAlert.find({
            userId: req.session.userId
        }).sort({ postedDate: -1 });

        const user = await User.findById(req.session.userId);
        res.render('alerts', { alerts, user });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).render('error', { message: 'Error loading job alerts' });
    }
});

// Applications
router.get('/applications', checkUserType(['jobseeker']), async (req, res) => {
    try {
        const applications = await JobApplication.find({
            userId: req.session.userId
        }).sort({ appliedDate: -1 });

        const user = await User.findById(req.session.userId);
        res.render('applications', { applications, user });
    } catch (error) {
        console.error('Error fetching applications:', error);
        res.status(500).render('error', { message: 'Error loading job applications' });
    }
});

// Mark job alert as read
router.post('/alerts/:alertId/read', checkUserType(['jobseeker']), async (req, res) => {
    try {
        await JobAlert.findByIdAndUpdate(req.params.alertId, { isRead: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking alert as read:', error);
        res.status(500).json({ success: false, error: 'Error marking alert as read' });
    }
});

// Update application status
router.post('/applications/:id/status', checkUserType(['jobseeker']), async (req, res) => {
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

// Company Reviews
router.get("/company-reviews", checkUserType(['jobseeker']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        const reviews = [
            { companyName: "Tech Innovations Inc.", rating: 4, reviewText: "Great place to work!", date: new Date() },
            { companyName: "Global Solutions Ltd.", rating: 3, reviewText: "Decent work-life balance.", date: new Date() },
        ];
        res.render("company-reviews/_partial", { reviews, user });
    } catch (error) {
        console.error('Error loading company reviews:', error);
        res.status(500).render('error', { message: 'Error loading company reviews' });
    }
});

// Edit Profile
router.get("/profile/edit", checkUserType(['jobseeker']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }
        res.render("profile/edit", { user });
    } catch (error) {
        console.error('Error loading profile edit page:', error);
        res.status(500).render('error', { message: 'Error loading profile edit page' });
    }
});

// Saved Jobs
router.get("/saved-jobs", checkUserType(['jobseeker']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        const savedJobs = [
            { id: "1", title: "Software Engineer", company: "Awesome Co.", location: "Remote" },
            { id: "2", title: "Data Scientist", company: "Analytics Pro", location: "New York" },
        ];
        res.render("saved-jobs/index", { savedJobs, user });
    } catch (error) {
        console.error('Error loading saved jobs:', error);
        res.status(500).render('error', { message: 'Error loading saved jobs' });
    }
});

// Add notes to application
router.post("/applications/:id/notes", checkUserType(['jobseeker']), async (req, res) => {
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
router.post("/applications/:id/next-steps", checkUserType(['jobseeker']), async (req, res) => {
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
router.get('/create-sample-application', checkUserType(['jobseeker']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

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

router.get("/", checkUserType(['jobseeker']), async (req, res) => {
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