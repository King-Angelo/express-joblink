const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authMiddleware } = require('../middleware/authMiddleware');
const Employer = require('../models/Employer');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/employers');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Middleware to check if user is an employer
const isEmployer = async (req, res, next) => {
    try {
        const employer = await Employer.findOne({ user: req.session.userId });
        if (!employer) {
            req.flash('error', 'You need to be an employer to access this page');
            return res.redirect('/dashboard');
        }
        req.employer = employer;
        next();
    } catch (err) {
        console.error('Employer check error:', err);
        res.status(500).send('Server Error');
    }
};

// Employer Dashboard
router.get('/dashboard', authMiddleware, isEmployer, async (req, res) => {
    try {
        const employer = req.employer;
        const user = await User.findById(req.session.userId);
        const jobs = await Job.find({ employer: employer._id });
        const applications = await JobApplication.find({ 
            job: { $in: jobs.map(job => job._id) }
        }).populate('job user');
        
        res.render('employer/dashboard', {
            employer,
            user,
            firstName: user.firstName,
            jobs,
            applications,
            title: 'Employer Dashboard',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Employer dashboard error:', err);
        res.status(500).send('Server Error');
    }
});

// Profile Management
router.get('/profile', authMiddleware, isEmployer, async (req, res) => {
    try {
        const employer = req.employer;
        res.render('employer/profile', {
            employer,
            title: 'Employer Profile',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Profile view error:', err);
        res.status(500).send('Server Error');
    }
});

router.post('/profile', authMiddleware, isEmployer, upload.single('logo'), async (req, res) => {
    try {
        const employer = req.employer;
        const updates = req.body;
        
        if (req.file) {
            updates.logo = '/uploads/employers/' + req.file.filename;
        }
        
        await Employer.findByIdAndUpdate(employer._id, updates);
        req.flash('success', 'Profile updated successfully');
        res.redirect('/employer/profile');
    } catch (err) {
        console.error('Profile update error:', err);
        req.flash('error', 'Error updating profile');
        res.redirect('/employer/profile');
    }
});

// Job Posting
router.get('/jobs', authMiddleware, isEmployer, async (req, res) => {
    try {
        const jobs = await Job.find({ employer: req.employer._id });
        res.render('employer/jobs', {
            jobs,
            title: 'Manage Jobs',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Jobs view error:', err);
        res.status(500).send('Server Error');
    }
});

router.post('/jobs', authMiddleware, isEmployer, async (req, res) => {
    try {
        const jobData = {
            ...req.body,
            employer: req.employer._id
        };
        
        const job = new Job(jobData);
        await job.save();
        
        req.flash('success', 'Job posted successfully');
        res.redirect('/employer/jobs');
    } catch (err) {
        console.error('Job posting error:', err);
        req.flash('error', 'Error posting job');
        res.redirect('/employer/jobs');
    }
});

// Application Management
router.get('/applications', authMiddleware, isEmployer, async (req, res) => {
    try {
        const jobs = await Job.find({ employer: req.employer._id });
        const applications = await JobApplication.find({
            job: { $in: jobs.map(job => job._id) }
        }).populate('job user');
        
        res.render('employer/applications', {
            applications,
            title: 'Manage Applications',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Applications view error:', err);
        res.status(500).send('Server Error');
    }
});

router.post('/applications/:id/status', authMiddleware, isEmployer, async (req, res) => {
    try {
        const { status } = req.body;
        const application = await JobApplication.findById(req.params.id);
        
        if (!application) {
            req.flash('error', 'Application not found');
            return res.redirect('/employer/applications');
        }
        
        application.status = status;
        await application.save();
        
        // Create notification for the applicant
        const notification = new Notification({
            user: application.user,
            type: 'application_status',
            message: `Your application status has been updated to ${status}`,
            relatedTo: application._id
        });
        await notification.save();
        
        req.flash('success', 'Application status updated');
        res.redirect('/employer/applications');
    } catch (err) {
        console.error('Status update error:', err);
        req.flash('error', 'Error updating status');
        res.redirect('/employer/applications');
    }
});

// Notifications
router.get('/notifications', authMiddleware, isEmployer, async (req, res) => {
    try {
        const notifications = await Notification.find({
            user: req.session.userId
        }).sort({ createdAt: -1 });
        
        res.render('employer/notifications', {
            notifications,
            title: 'Notifications',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Notifications view error:', err);
        res.status(500).send('Server Error');
    }
});

// Contact
router.get('/contact', authMiddleware, isEmployer, (req, res) => {
    res.render('employer/contact', {
        title: 'Contact Support',
        isAuthenticated: true
    });
});

router.post('/contact', authMiddleware, isEmployer, async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        // Here you would typically send an email to support
        // For now, we'll just show a success message
        req.flash('success', 'Your message has been sent to support');
        res.redirect('/employer/contact');
    } catch (err) {
        console.error('Contact form error:', err);
        req.flash('error', 'Error sending message');
        res.redirect('/employer/contact');
    }
});

// Employer login page
router.get('/login', (req, res) => {
    res.render('employer/login', { error: null });
});

// Employer login POST
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('employer/login', { error: 'Invalid email or password' });
        }
        const isMatch = await require('bcryptjs').compare(password, user.password);
        if (!isMatch) {
            return res.render('employer/login', { error: 'Invalid email or password' });
        }
        // Check if user is an employer
        const Employer = require('../models/Employer');
        const employer = await Employer.findOne({ user: user._id });
        if (!employer) {
            return res.render('employer/login', { error: 'This account is not registered as an employer.' });
        }
        req.session.userId = user._id;
        await req.session.save();
        res.redirect('/employer/dashboard');
    } catch (err) {
        console.error('Employer login error:', err);
        res.render('employer/login', { error: 'Something went wrong. Please try again.' });
    }
});

// Employer registration page
router.get('/register', (req, res) => {
    res.redirect('/register/employer');
});

// Employer registration POST
router.post('/register', async (req, res) => {
    const { companyName, email, password, companyDescription, industry, companySize, location, contactPhone } = req.body;
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('employer/register', { error: 'Email is already registered.' });
        }
        // Create new user
        const hashedPassword = await require('bcryptjs').hash(password, 10);
        const user = new User({
            name: companyName,
            email,
            password: hashedPassword
        });
        await user.save();
        // Create employer profile
        const employer = new Employer({
            user: user._id,
            companyName,
            companyDescription,
            industry,
            companySize,
            location,
            contactEmail: email,
            contactPhone
        });
        await employer.save();
        // Set session and redirect
        req.session.userId = user._id;
        await req.session.save();
        res.redirect('/employer/dashboard');
    } catch (err) {
        console.error('Employer registration error:', err);
        res.render('employer/register', { error: 'Something went wrong. Please try again.' });
    }
});

module.exports = router; 