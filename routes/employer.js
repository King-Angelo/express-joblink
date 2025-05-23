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
        if (!req.employer) {
            console.error('No employer found for user:', req.session.userId);
            return res.status(404).render('error', { message: 'Employer profile not found.' });
        }
        // Pagination params
        const jobsPage = parseInt(req.query.jobsPage) || 1;
        const appsPage = parseInt(req.query.appsPage) || 1;
        const jobsLimit = 5;
        const appsLimit = 5;

        // Fetch paginated jobs for this employer
        const jobsCount = await Job.countDocuments({ employer: req.employer._id });
        const jobs = await Job.find({ employer: req.employer._id })
            .sort({ postedDate: -1 })
            .skip((jobsPage - 1) * jobsLimit)
            .limit(jobsLimit);

        // Defensive: handle no jobs
        const jobIds = jobs && jobs.length > 0 ? jobs.map(job => job._id) : [];
        const appsQuery = jobIds.length > 0 ? { job: { $in: jobIds } } : { job: null };
        const appsCount = await JobApplication.countDocuments(appsQuery);
        const applications = await JobApplication.find(appsQuery)
            .populate('jobseeker')
            .sort({ createdAt: -1 })
            .skip((appsPage - 1) * appsLimit)
            .limit(appsLimit);

        res.render('employer/dashboard', {
            user: req.user,
            jobs,
            jobsCount,
            jobsPage,
            jobsTotalPages: Math.ceil(jobsCount / jobsLimit),
            applications,
            appsCount,
            appsPage,
            appsTotalPages: Math.ceil(appsCount / appsLimit),
            title: 'Employer Dashboard',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Employer dashboard error:', err.stack || err);
        res.status(500).render('error', { message: 'Error loading employer dashboard' });
    }
});

// Profile Management
router.get('/profile', authMiddleware, isEmployer, async (req, res) => {
    try {
        const employer = req.employer;
        res.render('employer/profile', {
            employer,
            user: req.user,
            title: 'Employer Profile',
            isAuthenticated: true,
            success: req.query.success || null
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
            employer: req.employer._id,
            isActive: true // Ensure job is active by default
        };

        // Parse requirements and skills as arrays if they are comma-separated strings
        if (typeof jobData.requirements === 'string') {
            jobData.requirements = jobData.requirements.split(',').map(r => r.trim()).filter(Boolean);
        }
        if (typeof jobData.skills === 'string') {
            jobData.skills = jobData.skills.split(',').map(s => s.trim()).filter(Boolean);
        }

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
        // Get query parameters for filtering
        const { status, date } = req.query;

        // Build query object
        const query = {
            agencyId: req.employer._id,
            targetType: 'employer'
        };

        // Add status filter if provided
        if (status) {
            query.status = status;
        }

        // Add date filter if provided
        if (date) {
            const now = new Date();
            switch (date) {
                case 'today':
                    query.createdAt = {
                        $gte: new Date(now.setHours(0, 0, 0, 0))
                    };
                    break;
                case 'week':
                    query.createdAt = {
                        $gte: new Date(now.setDate(now.getDate() - 7))
                    };
                    break;
                case 'month':
                    query.createdAt = {
                        $gte: new Date(now.setMonth(now.getMonth() - 1))
                    };
                    break;
            }
        }

        // Get applications with filters
        const applications = await JobApplication.find(query)
            .populate('jobseeker', 'name email')
            .sort({ createdAt: -1 });

        // Get application statistics
        const stats = {
            total: applications.length,
            pending: applications.filter(app => app.status === 'pending').length,
            reviewing: applications.filter(app => app.status === 'reviewing').length,
            interview: applications.filter(app => app.status === 'interview').length,
            rejected: applications.filter(app => app.status === 'rejected').length,
            hired: applications.filter(app => app.status === 'hired').length
        };

        res.render('employer/applications', {
            applications,
            stats,
            query: req.query, // Pass query parameters to the view
            title: 'Manage Applications',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Applications view error:', err);
        res.status(500).send('Server Error');
    }
});

// Add route for /dashboard/employer/applications
router.get('/dashboard/employer/applications', authMiddleware, isEmployer, async (req, res) => {
    // Redirect to the main applications route
    res.redirect('/employer/applications');
});

router.post('/applications/:id/status', authMiddleware, isEmployer, async (req, res) => {
    try {
        const { status } = req.body;
        const application = await JobApplication.findOne({
            _id: req.params.id,
            agencyId: req.employer._id,
            targetType: 'employer'
        });
        
        if (!application) {
            req.flash('error', 'Application not found');
            return res.redirect('/employer/applications');
        }
        
        application.status = status;
        await application.save();
        
        // Create notification for the applicant
        const notification = new Notification({
            recipient: application.jobseeker,
            sender: req.employer._id,
            type: 'application_status',
            title: 'Application Status Updated',
            message: `Your application status has been updated to ${status}`,
            relatedApplication: application._id
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

// Configure multer for file uploads
const storageApplications = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/applications');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only PDF, DOC, and DOCX files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/msword' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

const uploadApplications = multer({ 
    storage: storageApplications,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Handle jobseeker applications
router.post('/:employerId/apply', authMiddleware, uploadApplications.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    try {
        // Check if user is a jobseeker
        if (req.user.userType !== 'jobseeker') {
            req.flash('error', 'Only jobseekers can apply to employers');
            return res.redirect('back');
        }

        const employerId = req.params.employerId;
        const employer = await Employer.findById(employerId);
        
        if (!employer) {
            req.flash('error', 'Employer not found');
            return res.redirect('back');
        }

        // Validate required files
        if (!req.files || !req.files.resume || !req.files.resume[0]) {
            req.flash('error', 'Resume is required');
            return res.redirect('back');
        }

        // Create application record
        const application = new JobApplication({
            jobseeker: req.user._id,
            agencyId: employerId,
            targetType: 'employer',
            message: req.body.message || '',
            resume: '/uploads/applications/' + req.files.resume[0].filename,
            coverLetter: req.files.coverLetter && req.files.coverLetter[0] 
                ? '/uploads/applications/' + req.files.coverLetter[0].filename 
                : null,
            status: 'pending'
        });

        await application.save();

        // Create notification for employer
        const notification = new Notification({
            recipient: employer.user,
            sender: req.user._id,
            type: 'application',
            title: 'New Job Application',
            message: `${req.user.name} has applied to work with your company`,
            relatedApplication: application._id
        });

        await notification.save();

        req.flash('success', 'Application submitted successfully');
        res.redirect(`/employers/${employerId}`);
    } catch (err) {
        console.error('Application submission error:', err);
        req.flash('error', 'Error submitting application');
        res.redirect('back');
    }
});

// Placeholder: Employer Jobs
router.get('/jobs', authMiddleware, isEmployer, async (req, res) => {
    // Fetch jobs for this employer
    const jobs = await Job.find({ employer: req.employer._id });
    res.render('employer/jobs', { jobs, title: 'Manage Jobs', isAuthenticated: true });
});

// Candidates page: show all jobseekers who applied to this employer's jobs
router.get('/candidates', authMiddleware, isEmployer, async (req, res) => {
    try {
        // Find all jobs for this employer
        const jobs = await Job.find({ employer: req.employer._id });
        const jobIds = jobs.map(job => job._id);
        // Find all applications for these jobs
        const candidates = await JobApplication.find({ job: { $in: jobIds } })
            .populate('jobseeker')
        res.render('employer/candidates', {
            candidates,
            user: req.user,
            title: 'Candidates',
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Candidates view error:', err);
        res.status(500).render('error', { message: 'Error loading candidates' });
    }
});

// Update application status from candidates page
router.post('/candidates/:applicationId/status', authMiddleware, isEmployer, async (req, res) => {
    try {
        const { status } = req.body;
        await JobApplication.findByIdAndUpdate(req.params.applicationId, { status });
        res.redirect('/employer/candidates');
    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).render('error', { message: 'Error updating status' });
    }
});

// Placeholder: Employer Settings
router.get('/settings', authMiddleware, isEmployer, (req, res) => {
    res.render('employer/settings', { title: 'Settings', isAuthenticated: true, user: req.user });
});

// Change password
router.post('/settings/password', authMiddleware, isEmployer, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect('/employer/settings?error=notfound');
        const valid = await require('bcryptjs').compare(currentPassword, user.password);
        if (!valid) return res.redirect('/employer/settings?error=invalid');
        user.password = await require('bcryptjs').hash(newPassword, 10);
        await user.save();
        res.redirect('/employer/settings?success=password');
    } catch (err) {
        console.error('Change password error:', err);
        res.redirect('/employer/settings?error=server');
    }
});

// Save notification preferences
router.post('/settings/notifications', authMiddleware, isEmployer, async (req, res) => {
    try {
        const notifyNewApplications = !!req.body.notifyNewApplications;
        const notifyStatusUpdates = !!req.body.notifyStatusUpdates;
        await User.findByIdAndUpdate(req.session.userId, {
            notifyNewApplications,
            notifyStatusUpdates
        });
        res.redirect('/employer/settings?success=notifications');
    } catch (err) {
        console.error('Notification prefs error:', err);
        res.redirect('/employer/settings?error=server');
    }
});

module.exports = router; 