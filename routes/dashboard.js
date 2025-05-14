const express = require('express');
const router = express.Router();
const User = require('../models/User');
const JobAlert = require('../models/JobAlert');
const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');
const Employer = require('../models/Employer');
const Agency = require('../models/Agency');

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

        // Fetch agencies from User model
        const userAgencies = await User.find({
            userType: 'agency',
            deletedAt: { $exists: false }
        })
        .select('agencyProfile email description location website userType')
        .sort({ 'agencyProfile.agencyName': 1 })
        .lean();

        // Fetch employers from User model
        const userEmployers = await User.find({
            userType: 'employer',
            deletedAt: { $exists: false }
        })
        .select('employerProfile email description location website userType title')
        .sort({ title: 1 })
        .lean();

        // Fetch employers from Employer model
        const employerProfiles = await Employer.find()
            .populate('user', 'email userType')
            .sort({ companyName: 1 })
            .lean();

        // Transform agency data
        const agencies = userAgencies.map(agency => ({
            _id: agency._id,
            companyName: agency.agencyProfile?.agencyName,
            email: agency.email,
            description: agency.agencyProfile?.description || agency.description || 'No description available',
            location: agency.agencyProfile?.address || agency.location || 'Location not specified',
            website: agency.agencyProfile?.website || agency.website,
            userType: agency.userType,
            companyType: agency.agencyProfile?.companyType
        })).filter(agency => agency.companyName);

        // Transform employer data from User model
        const userEmployerList = userEmployers.map(employer => ({
            _id: employer._id,
            companyName: employer.title || employer.employerProfile?.companyName,
            email: employer.email,
            description: employer.description || 'No description available',
            location: employer.location || 'Location not specified',
            website: employer.website,
            userType: employer.userType
        })).filter(employer => employer.companyName);

        // Transform employer data from Employer model
        const employerList = employerProfiles.map(employer => ({
            _id: employer._id,
            companyName: employer.companyName,
            email: employer.contactEmail,
            description: employer.companyDescription || 'No description available',
            location: employer.location || 'Location not specified',
            website: employer.website,
            userType: employer.user?.userType || 'employer',
            industry: employer.industry,
            companySize: employer.companySize
        }));

        // Combine and deduplicate employers
        const allEmployers = [...userEmployerList, ...employerList];
        const uniqueEmployers = allEmployers.filter((employer, index, self) =>
            index === self.findIndex((e) => e.email === employer.email)
        );

        res.render('dashboard', {
            user,
            firstName: user.firstName || req.session.firstName,
            newJobs: unreadAlerts.length,
            recentAlerts,
            jobs,
            agencies,
            employers: uniqueEmployers,
            isAuthenticated: true,
            success: req.query.success
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

        const agency = await Agency.findOne({ user: req.session.userId });
        if (!agency) {
            // Create a new agency profile if it doesn't exist
            const newAgency = new Agency({
                user: req.session.userId,
                agencyName: user.agencyName || user.firstName,
                description: 'No description available',
                industry: 'Not specified',
                location: 'Not specified',
                contactEmail: user.email
            });
            await newAgency.save();
            agency = newAgency;
        }

        // Get recent applications
        const applications = await JobApplication.find({ 
            agencyId: agency._id,
            targetType: 'agency'
        })
        .populate('jobseeker', 'name email')
        .sort({ createdAt: -1 })
        .limit(5);

        // Get stats
        const stats = {
            activeJobs: await Job.countDocuments({ agencyId: agency._id, status: 'active' }),
            totalCandidates: await JobApplication.countDocuments({ agencyId: agency._id, targetType: 'agency' }),
            interviewsScheduled: await JobApplication.countDocuments({ agencyId: agency._id, targetType: 'agency', status: 'interview' }),
            placements: await JobApplication.countDocuments({ agencyId: agency._id, targetType: 'agency', status: 'hired' })
        };

        // Get recent activity (last 5 applications)
        const recentActivity = applications.map(app => 
            `New application from ${app.jobseeker.name} - ${new Date(app.createdAt).toLocaleDateString()}`
        );

        // Get chart data (last 6 months of placements)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyPlacements = await JobApplication.aggregate([
            {
                $match: {
                    agencyId: agency._id,
                    targetType: 'agency',
                    status: 'hired',
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            values: Array(6).fill(0)
        };

        monthlyPlacements.forEach(placement => {
            const monthIndex = placement._id - 1;
            if (monthIndex >= 0 && monthIndex < 6) {
                chartData.values[monthIndex] = placement.count;
            }
        });

        res.render('agency/dashboard', {
            user,
            agency,
            agencyName: agency.agencyName,
            stats,
            applications,
            recentActivity,
            chartData
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/dashboard');
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
            jobseeker: req.session.userId
        })
        .populate('agencyId', 'name')
        .sort({ createdAt: -1 });

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

// Update Profile
router.post("/profile/edit", checkUserType(['jobseeker']), async (req, res) => {
    try {
        const {
            firstName,
            middleName,
            lastName,
            title,
            bio,
            location,
            phone,
            linkedin,
            skills,
            preferredJobTypes,
            preferredLocations,
            expectedSalary,
            experience,
            education
        } = req.body;

        // Validate required name fields
        if (!firstName || !lastName) {
            return res.status(400).render('profile/edit', {
                user: req.body,
                error: 'First name and last name are required'
            });
        }

        // Split comma-separated strings into arrays
        const skillsArray = skills ? skills.split(',').map(skill => skill.trim()) : [];
        const preferredJobTypesArray = preferredJobTypes ? preferredJobTypes.split(',').map(type => type.trim()) : [];
        const preferredLocationsArray = preferredLocations ? preferredLocations.split(',').map(loc => loc.trim()) : [];

        // Construct full name
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            {
                firstName,
                middleName,
                lastName,
                name: fullName,
                title,
                bio,
                location,
                phone,
                linkedin,
                skills: skillsArray,
                preferredJobTypes: preferredJobTypesArray,
                preferredLocations: preferredLocationsArray,
                expectedSalary,
                experience: experience || [],
                education: education || []
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).render('error', { message: 'User not found' });
        }

        // Update session with new first name
        req.session.firstName = firstName;

        res.redirect('/dashboard?success=true');
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).render('profile/edit', {
            user: req.body,
            error: 'Error updating profile. Please try again.'
        });
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
            { _id: req.params.id, jobseeker: req.session.userId },
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
            jobseeker: req.session.userId,
            agencyId: '65f1a2b3c4d5e6f7g8h9i0j1', // Replace with a valid agency ID
            targetType: 'agency',
            message: 'I am interested in working with your agency',
            resume: '/uploads/applications/sample-resume.pdf',
            status: 'pending',
            nextSteps: 'Prepare for technical interview'
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

// Employer Applications
router.get('/employer/applications', checkUserType(['employer']), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        // Get query parameters for filtering
        const { status, date } = req.query;

        // Build query object
        const query = {
            agencyId: req.session.userId,
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
            query: req.query,
            title: 'Manage Applications',
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Error loading employer applications:', error);
        res.status(500).render('error', { message: 'Error loading employer applications' });
    }
});

module.exports = router; 