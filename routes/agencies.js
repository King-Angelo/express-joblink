const express = require('express');
const router = express.Router();
const applicationsRouter = express.Router();
const User = require('../models/User');
const Employer = require('../models/Employer');
const JobApplication = require('../models/JobApplication');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

// Applications routes
applicationsRouter.get('/', authMiddleware, async (req, res) => {
    try {
        // Check if user is an agency or employer
        if (!['agency', 'employer'].includes(req.user.userType)) {
            req.flash('error', 'Access denied');
            return res.redirect('/dashboard');
        }

        // Get query parameters for filtering
        const { status, date } = req.query;

        // Build query object
        const query = {
            agencyId: req.user._id,
            targetType: req.user.userType
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

        res.render('agencies/applications', {
            user: req.user,
            applications,
            stats,
            query: req.query, // Pass query parameters to the view
            title: 'Manage Applications',
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Error fetching applications:', error);
        req.flash('error', 'Error loading applications');
        res.redirect('/dashboard');
    }
});

applicationsRouter.post('/:applicationId/status', authMiddleware, async (req, res) => {
    try {
        if (req.user.userType !== 'agency') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const application = await JobApplication.findById(req.params.applicationId);

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Verify the application belongs to this agency
        if (application.agencyId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { status } = req.body;
        application.status = status;
        await application.save();

        // Create notification for jobseeker
        const notification = new Notification({
            recipient: application.jobseeker,
            sender: req.user._id,
            type: 'application_status',
            title: 'Application Status Updated',
            message: `Your application status has been updated to ${status}`,
            relatedApplication: application._id
        });

        await notification.save();

        res.json({ success: true, application });
    } catch (error) {
        console.error('Error updating application status:', error);
        res.status(500).json({ error: 'Error updating application status' });
    }
});

// Mount applications router
router.use('/applications', applicationsRouter);

// Get all agencies and employers
router.get('/browse', authMiddleware, async (req, res) => {
    try {
        // Fetch from User model
        const users = await User.find({
            userType: { $in: ['agency', 'employer'] },
            deletedAt: { $exists: false }
        })
        .select('agencyProfile employerProfile email description location website userType title')
        .sort({ createdAt: -1 })
        .lean();

        console.log('Number of users found:', users.length);

        // Transform user data
        const userAgencies = users.map(user => {
            let companyName;
            if (user.userType === 'agency') {
                companyName = user.agencyProfile?.agencyName;
            } else if (user.userType === 'employer') {
                // Try to get company name from employerProfile first, then title
                companyName = user.employerProfile?.companyName || user.title;
            }

            // Only include if we have a valid company name
            if (!companyName) {
                console.log('Skipping user with no company name:', user.email);
                return null;
            }

            return {
                _id: user._id,
                companyName: companyName,
                email: user.email,
                description: user.agencyProfile?.description || user.description || 'No description available',
                location: user.agencyProfile?.address || user.location || 'Location not specified',
                website: user.agencyProfile?.website || user.website,
                userType: user.userType,
                agencyProfile: user.agencyProfile
            };
        }).filter(Boolean); // Remove null entries

        // Fetch from Employer model
        const employers = await Employer.find()
            .populate('user', 'email userType')
            .sort({ createdAt: -1 })
            .lean();

        console.log('Number of employers found:', employers.length);

        // Transform employer data
        const employerAgencies = employers.map(employer => {
            // Only include if we have a valid company name
            if (!employer.companyName) {
                console.log('Skipping employer with no company name:', employer.contactEmail);
                return null;
            }

            return {
                _id: employer._id,
                companyName: employer.companyName,
                email: employer.contactEmail,
                description: employer.companyDescription || 'No description available',
                location: employer.location || 'Location not specified',
                website: employer.website,
                userType: employer.user?.userType || 'employer'
            };
        }).filter(Boolean); // Remove null entries

        // Combine both arrays and remove duplicates based on email
        const allAgencies = [...userAgencies, ...employerAgencies];
        const uniqueAgencies = allAgencies.filter((agency, index, self) =>
            index === self.findIndex((a) => a.email === agency.email)
        );

        console.log('Total unique agencies/employers:', uniqueAgencies.length);
        
        res.render('agencies/browse', {
            agencies: uniqueAgencies,
            user: req.user,
            req: req
        });
    } catch (error) {
        console.error('Error fetching agencies and employers:', error);
        res.status(500).render('error', { 
            message: 'Error fetching agencies and employers',
            error: error
        });
    }
});

// View agency profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user || user.userType !== 'agency') {
            return res.redirect('/login');
        }

        const profile = {
            _id: user._id,
            companyName: user.agencyProfile?.agencyName,
            email: user.email,
            description: user.agencyProfile?.description,
            location: user.agencyProfile?.address,
            website: user.agencyProfile?.website,
            userType: user.userType,
            companyType: user.agencyProfile?.companyType,
            foundedYear: user.agencyProfile?.foundedYear,
            services: user.agencyProfile?.services,
            specialties: user.agencyProfile?.specialties,
            phone: user.agencyProfile?.phone
        };

        res.render('agencies/profile', {
            profile: profile,
            user: user
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error', { message: 'Error loading profile' });
    }
});

// Edit agency profile
router.get('/profile/edit', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user || user.userType !== 'agency') {
            return res.redirect('/login');
        }

        res.render('agencies/edit-profile', {
            user,
            agency: user.agencyProfile,
            success: req.query.success,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Error loading edit profile:', error);
        res.status(500).render('error', { message: 'Error loading edit profile' });
    }
});

// Update agency profile
router.post('/profile/edit', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user || user.userType !== 'agency') {
            return res.redirect('/login');
        }

        const {
            agencyName,
            companyType,
            description,
            foundedYear,
            services,
            specialties,
            address,
            phone,
            website
        } = req.body;

        // Update user's agency profile
        user.agencyProfile = {
            ...user.agencyProfile,
            agencyName,
            companyType,
            description,
            foundedYear,
            services: Array.isArray(services) ? services : [services],
            specialties,
            address,
            phone,
            website
        };

        await user.save();

        res.redirect('/agencies/profile/edit?success=true');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).render('error', { message: 'Error updating profile' });
    }
});

// Place this BEFORE router.get('/:id', ...)
router.get('/test', (req, res) => {
  res.send('Agencies router is working!');
});

// Get specific agency/employer details
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        // First try to find in User model
        const userProfile = await User.findOne({
            _id: req.params.id,
            deletedAt: { $exists: false }
        })
        .select('agencyProfile employerProfile email description location website userType title')
        .lean();

        // Then try to find in Employer model
        const employerProfile = await Employer.findOne({
            _id: req.params.id
        })
        .populate('user', 'email userType')
        .lean();

        let profile;
        if (userProfile) {
            // Transform user profile data
            profile = {
                _id: userProfile._id,
                companyName: userProfile.userType === 'agency' 
                    ? userProfile.agencyProfile?.agencyName 
                    : (userProfile.employerProfile?.companyName || userProfile.title),
                email: userProfile.email,
                description: userProfile.agencyProfile?.description || userProfile.description,
                location: userProfile.agencyProfile?.address || userProfile.location,
                website: userProfile.agencyProfile?.website || userProfile.website,
                userType: userProfile.userType,
                companyType: userProfile.agencyProfile?.companyType,
                foundedYear: userProfile.agencyProfile?.foundedYear,
                services: userProfile.agencyProfile?.services,
                specialties: userProfile.agencyProfile?.specialties
            };
        } else if (employerProfile) {
            // Transform employer profile data
            profile = {
                _id: employerProfile._id,
                companyName: employerProfile.companyName,
                email: employerProfile.contactEmail,
                description: employerProfile.companyDescription,
                location: employerProfile.location,
                website: employerProfile.website,
                userType: employerProfile.user?.userType || 'employer',
                industry: employerProfile.industry,
                companySize: employerProfile.companySize
            };
        }

        if (!profile) {
            return res.status(404).render('error', { 
                message: 'Agency/Employer not found',
                error: { status: 404 }
            });
        }

        res.render('agencies/profile', {
            profile: profile,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).render('error', { 
            message: 'Error fetching profile',
            error: error
        });
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

// Handle jobseeker applications to agencies/employers
router.post('/:id/apply', authMiddleware, uploadApplications.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    try {
        // Check if user is a jobseeker
        if (req.user.userType !== 'jobseeker') {
            req.flash('error', 'Only jobseekers can apply to agencies/employers');
            return res.redirect(`/agencies/${req.params.id}`);
        }

        const targetId = req.params.id;
        let targetUser, targetType;

        // First try to find in User model
        targetUser = await User.findOne({
            _id: targetId,
            userType: { $in: ['agency', 'employer'] },
            deletedAt: { $exists: false }
        });

        // If not found in User model, try Employer model
        if (!targetUser) {
            const employer = await Employer.findById(targetId);
            if (employer) {
                targetUser = await User.findById(employer.user);
                targetType = 'employer';
            }
        } else {
            targetType = targetUser.userType;
        }

        if (!targetUser) {
            req.flash('error', 'Agency/Employer not found');
            return res.redirect('/agencies/browse');
        }

        // Validate required files
        if (!req.files || !req.files.resume || !req.files.resume[0]) {
            req.flash('error', 'Resume is required');
            return res.redirect(`/agencies/${targetId}`);
        }

        // Create application record
        const application = new JobApplication({
            jobseeker: req.user._id,
            agencyId: targetId,
            targetType: targetType || targetUser.userType,
            message: req.body.message || '',
            resume: '/uploads/applications/' + req.files.resume[0].filename,
            coverLetter: req.files.coverLetter && req.files.coverLetter[0] 
                ? '/uploads/applications/' + req.files.coverLetter[0].filename 
                : null,
            status: 'pending'
        });

        await application.save();

        // Create notification for agency/employer
        const notification = new Notification({
            recipient: targetId,
            sender: req.user._id,
            type: 'application',
            title: 'New Job Application',
            message: `${req.user.name} has applied to work with your ${targetType || targetUser.userType}`,
            relatedApplication: application._id
        });

        await notification.save();

        req.flash('success', 'Application submitted successfully');
        res.redirect(`/agencies/${targetId}`);
    } catch (err) {
        console.error('Application submission error:', err);
        req.flash('error', 'Error submitting application');
        res.redirect(`/agencies/${req.params.id}`);
    }
});

// List all jobs for the logged-in agency
router.get('/agency/jobs', authMiddleware, async (req, res) => {
    try {
        const agency = await User.findById(req.session.userId);
        if (!agency) return res.redirect('/login');
        const jobs = await require('../models/Job').find({ agencyId: agency._id });
        res.render('agencies/agency/jobs', { jobs, user: agency, title: 'Manage Jobs', isAuthenticated: true });
    } catch (err) {
        console.error('Agency jobs error:', err);
        res.status(500).render('error', { message: 'Error loading agency jobs' });
    }
});

// List all candidates who applied to the agency's jobs
router.get('/agency/candidates', authMiddleware, async (req, res) => {
    try {
        const agency = await User.findById(req.session.userId);
        if (!agency) return res.redirect('/login');
        const jobs = await require('../models/Job').find({ agencyId: agency._id });
        const jobIds = jobs.map(job => job._id);
        const applications = await require('../models/JobApplication').find({ agencyId: agency._id, targetType: 'agency' })
            .populate('jobseeker');
        res.render('agencies/agency/candidates', { applications, user: agency, title: 'View Candidates', isAuthenticated: true });
    } catch (err) {
        console.error('Agency candidates error:', err);
        res.status(500).render('error', { message: 'Error loading candidates' });
    }
});

// Add this to routes/agencies.js
router.get('/agency/applications', authMiddleware, async (req, res) => {
    try {
        // Fetch applications for the logged-in agency
        const agency = await User.findById(req.session.userId);
        if (!agency) return res.redirect('/login');
        const applications = await require('../models/JobApplication').find({ agencyId: agency._id, targetType: 'agency' })
            .populate('jobseeker');
        // Calculate stats as in your previous logic
        const stats = {
            total: applications.length,
            pending: applications.filter(app => app.status === 'pending').length,
            reviewing: applications.filter(app => app.status === 'reviewing').length,
            interview: applications.filter(app => app.status === 'interview').length,
            rejected: applications.filter(app => app.status === 'rejected').length,
            hired: applications.filter(app => app.status === 'hired').length
        };
        res.render('agencies/agency/applications', {
            applications,
            stats,
            user: agency,
            title: 'Manage Applications',
            isAuthenticated: true,
            query: req.query
        });
    } catch (err) {
        console.error('Agency applications error:', err);
        res.status(500).render('error', { message: 'Error loading agency applications' });
    }
});

module.exports = router; 