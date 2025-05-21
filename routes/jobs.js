const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const JobApplication = require('../models/JobApplication');
const { authMiddleware } = require('../middleware/authMiddleware');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/applications');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Create sample jobs (for testing)
router.get('/create-sample-jobs', async (req, res) => {
    try {
        const sampleJobs = [
            {
                title: "Senior Software Engineer",
                company: "Tech Innovations Inc",
                location: "San Francisco, CA",
                type: "Full-time",
                description: "We are looking for a Senior Software Engineer to join our team. The ideal candidate should have strong experience in full-stack development and cloud technologies.",
                requirements: [
                    "5+ years of software development experience",
                    "Strong knowledge of JavaScript, Python, and cloud platforms",
                    "Experience with microservices architecture",
                    "Bachelor's degree in Computer Science or related field"
                ],
                salary: "$120,000 - $150,000",
                skills: ["JavaScript", "Python", "AWS", "Docker", "Kubernetes"],
                category: "Engineering"
            },
            {
                title: "Frontend Developer",
                company: "Web Solutions Ltd",
                location: "Remote",
                type: "Full-time",
                description: "Join our team as a Frontend Developer and help build beautiful, responsive web applications. We're looking for someone passionate about user experience and modern web technologies.",
                requirements: [
                    "3+ years of frontend development experience",
                    "Proficiency in React.js and modern JavaScript",
                    "Experience with responsive design and CSS frameworks",
                    "Strong understanding of web performance optimization"
                ],
                salary: "$90,000 - $110,000",
                skills: ["React", "JavaScript", "HTML", "CSS", "TypeScript"],
                category: "Frontend Development"
            },
            {
                title: "Data Scientist",
                company: "Analytics Pro",
                location: "New York, NY",
                type: "Full-time",
                description: "We're seeking a Data Scientist to help us extract insights from large datasets and build predictive models. The ideal candidate should have strong statistical and machine learning skills.",
                requirements: [
                    "Master's degree in Statistics, Computer Science, or related field",
                    "3+ years of experience in data science",
                    "Proficiency in Python and R",
                    "Experience with machine learning frameworks"
                ],
                salary: "$100,000 - $130,000",
                skills: ["Python", "R", "Machine Learning", "Statistics", "SQL"],
                category: "Data Science"
            },
            {
                title: "DevOps Engineer",
                company: "Cloud Systems Inc",
                location: "Austin, TX",
                type: "Full-time",
                description: "Join our DevOps team to help build and maintain our cloud infrastructure. We're looking for someone with strong experience in automation and cloud platforms.",
                requirements: [
                    "4+ years of DevOps experience",
                    "Strong knowledge of AWS or Azure",
                    "Experience with CI/CD pipelines",
                    "Proficiency in infrastructure as code"
                ],
                salary: "$110,000 - $140,000",
                skills: ["AWS", "Docker", "Kubernetes", "Terraform", "Jenkins"],
                category: "DevOps"
            },
            {
                title: "UX/UI Designer",
                company: "Creative Design Studio",
                location: "Los Angeles, CA",
                type: "Full-time",
                description: "We're looking for a talented UX/UI Designer to create beautiful and intuitive user interfaces. The ideal candidate should have a strong portfolio and experience with design tools.",
                requirements: [
                    "3+ years of UX/UI design experience",
                    "Proficiency in Figma and Adobe Creative Suite",
                    "Strong portfolio showcasing web and mobile designs",
                    "Experience with user research and testing"
                ],
                salary: "$85,000 - $105,000",
                skills: ["Figma", "Adobe XD", "UI Design", "UX Research", "Prototyping"],
                category: "Design"
            }
        ];

        // Insert sample jobs
        await Job.insertMany(sampleJobs);

        res.redirect('/jobs');
    } catch (error) {
        console.error('Error creating sample jobs:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Error creating sample jobs',
            error: error.message 
        });
    }
});

// Get recommended jobs based on user preferences and skills
router.get('/recommended', isAuthenticated, async (req, res) => {
    try {
        // Get the current user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).render('error', { 
                title: 'Error',
                message: 'User not found',
                isAuthenticated: true
            });
        }

        // Get user's preferred categories and skills
        const userSkills = user.skills || [];
        const userPreferences = user.jobPreferences || [];

        let jobs;
        
        if (userSkills.length === 0 && userPreferences.length === 0) {
            // If user has no skills or preferences, show recent active jobs
            jobs = await Job.find({ isActive: true })
                .sort({ postedDate: -1 })
                .limit(10);
        } else {
            // Build the search query
            const searchQuery = {
                isActive: true,
                $or: []
            };

            if (userSkills.length > 0) {
                searchQuery.$or.push({ skills: { $in: userSkills } });
            }

            if (userPreferences.length > 0) {
                searchQuery.$or.push({ category: { $in: userPreferences } });
            }

            // Find matching jobs, sort by posted date
            jobs = await Job.find(searchQuery)
                .sort({ postedDate: -1 })
                .limit(10);
        }

        // Render the recommended jobs page
        res.render('jobs/recommended', {
            title: 'Recommended Jobs',
            jobs: jobs || [],
            user: user,
            isAuthenticated: true,
            userSkills: userSkills,
            userPreferences: userPreferences
        });
    } catch (error) {
        console.error('Error fetching recommended jobs:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Error fetching recommended jobs',
            error: error.message,
            isAuthenticated: true
        });
    }
});

// Get all jobs with search and pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Jobs per page
        const skip = (page - 1) * limit;

        // Build search query
        let searchQuery = { isActive: true };
        
        if (req.query.search) {
            // Search in title, company, skills, and description
            searchQuery.$or = [
                { title: { $regex: new RegExp(req.query.search, 'i') } },
                { company: { $regex: new RegExp(req.query.search, 'i') } },
                { skills: { $in: [new RegExp(req.query.search, 'i')] } },
                { description: { $regex: new RegExp(req.query.search, 'i') } }
            ];
        }
        if (req.query.type) {
            searchQuery.type = req.query.type;
        }
        if (req.query.location) {
            searchQuery.location = { $regex: new RegExp(req.query.location, 'i') };
        }

        // Execute query with pagination
        const jobs = await Job.find(searchQuery)
            .sort({ postedDate: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalJobs = await Job.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalJobs / limit);

        res.render('jobs/index', {
            title: 'Available Jobs',
            jobs,
            currentPage: page,
            totalPages,
            search: req.query.search || '',
            type: req.query.type || '',
            location: req.query.location || '',
            isAuthenticated: !!req.session.userId
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Error fetching jobs',
            error: error.message 
        });
    }
});


// Show the job application form
router.get('/:id/apply', authMiddleware, async (req, res) => {
    const jobId = req.params.id;
    const job = await Job.findById(jobId);
    if (!job) {
        return res.status(404).render('error', { message: 'Job not found' });
    }
    res.render('jobs/apply', { job, user: req.user, isAuthenticated: true });
});

// Handle job application submission
router.post('/:id/apply', authMiddleware, upload.single('resume'), async (req, res) => {
    try {
        const jobId = req.params.id;
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).render('error', { message: 'Job not found' });
        }
        if (!req.file) {
            return res.status(400).render('jobs/apply', { job, user: req.user, isAuthenticated: true, error: 'Resume is required.' });
        }
        const application = new JobApplication({
            job: jobId,
            jobseeker: req.user._id,
            resume: '/uploads/applications/' + req.file.filename,
            coverLetter: req.body.coverLetter || '',
            status: 'pending',
            createdAt: new Date(),
            agencyId: job.agencyId,
            targetType: job.agencyId ? 'agency' : 'employer'
        });
        await application.save();
        res.render('jobs/apply', { job, user: req.user, isAuthenticated: true, success: 'Application submitted successfully!' });
    } catch (err) {
        console.error('Application submission error:', err);
        res.status(500).render('error', { message: 'Error submitting application' });
    }
});
// Get job details
router.get('/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) {
            return res.status(404).render('error', { 
                title: 'Error',
                message: 'Job not found' 
            });
        }
        res.render('jobs/details', { 
            title: job.title,
            job,
            isAuthenticated: !!req.session.userId
        });
    } catch (error) {
        console.error('Error fetching job details:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'Error fetching job details',
            error: error.message 
        });
    }
});
module.exports = router; 