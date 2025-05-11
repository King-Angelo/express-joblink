const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const User = require('../models/User');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

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
            searchQuery.$text = { $search: req.query.search };
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