const express = require('express');
const router = express.Router();
const JobAlertPreference = require('../models/JobAlertPreference');
const Job = require('../models/Job');
const { authMiddleware } = require('../middleware/authMiddleware');

// Get all job alerts for a user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const preferences = await JobAlertPreference.find({ userId: req.session.userId });
        res.render('job-alerts/index', {
            preferences,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Error fetching job alerts:', error);
        res.status(500).render('error', { message: 'Error loading job alerts' });
    }
});

// Create new job alert preference
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { keywords, locations, jobTypes, categories, salaryRange, frequency } = req.body;
        
        const preference = new JobAlertPreference({
            userId: req.session.userId,
            keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
            locations: locations ? locations.split(',').map(l => l.trim()) : [],
            jobTypes: jobTypes || [],
            categories: categories ? categories.split(',').map(c => c.trim()) : [],
            salaryRange: {
                min: salaryRange?.min || 0,
                max: salaryRange?.max
            },
            frequency: frequency || 'daily'
        });

        await preference.save();
        res.redirect('/job-alerts');
    } catch (error) {
        console.error('Error creating job alert:', error);
        res.status(500).render('error', { message: 'Error creating job alert' });
    }
});

// Update job alert preference
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { keywords, locations, jobTypes, categories, salaryRange, frequency, isActive } = req.body;
        
        const preference = await JobAlertPreference.findByIdAndUpdate(
            req.params.id,
            {
                keywords: keywords ? keywords.split(',').map(k => k.trim()) : [],
                locations: locations ? locations.split(',').map(l => l.trim()) : [],
                jobTypes: jobTypes || [],
                categories: categories ? categories.split(',').map(c => c.trim()) : [],
                salaryRange: {
                    min: salaryRange?.min || 0,
                    max: salaryRange?.max
                },
                frequency: frequency || 'daily',
                isActive: isActive === 'true'
            },
            { new: true }
        );

        if (!preference) {
            return res.status(404).json({ error: 'Job alert not found' });
        }

        res.json(preference);
    } catch (error) {
        console.error('Error updating job alert:', error);
        res.status(500).json({ error: 'Error updating job alert' });
    }
});

// Delete job alert preference
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const preference = await JobAlertPreference.findByIdAndDelete(req.params.id);
        if (!preference) {
            return res.status(404).json({ error: 'Job alert not found' });
        }
        res.json({ message: 'Job alert deleted successfully' });
    } catch (error) {
        console.error('Error deleting job alert:', error);
        res.status(500).json({ error: 'Error deleting job alert' });
    }
});

// Get matching jobs for a job alert
router.get('/:id/matches', authMiddleware, async (req, res) => {
    try {
        const preference = await JobAlertPreference.findById(req.params.id);
        if (!preference) {
            return res.status(404).json({ error: 'Job alert not found' });
        }

        // Build search query based on preferences
        const searchQuery = {
            isActive: true
        };

        if (preference.keywords.length > 0) {
            searchQuery.$text = { $search: preference.keywords.join(' ') };
        }

        if (preference.locations.length > 0) {
            searchQuery.location = { $in: preference.locations };
        }

        if (preference.jobTypes.length > 0) {
            searchQuery.type = { $in: preference.jobTypes };
        }

        if (preference.categories.length > 0) {
            searchQuery.category = { $in: preference.categories };
        }

        if (preference.salaryRange.min > 0 || preference.salaryRange.max) {
            searchQuery.salary = {
                $gte: preference.salaryRange.min
            };
            if (preference.salaryRange.max) {
                searchQuery.salary.$lte = preference.salaryRange.max;
            }
        }

        const matchingJobs = await Job.find(searchQuery)
            .sort({ postedDate: -1 })
            .limit(20);

        res.json(matchingJobs);
    } catch (error) {
        console.error('Error fetching matching jobs:', error);
        res.status(500).json({ error: 'Error fetching matching jobs' });
    }
});

module.exports = router; 