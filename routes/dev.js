const express = require('express');
const router = express.Router();

// Dev route: Jobseeker Dashboard
router.get('/dashboard/jobseeker', (req, res) => {
    res.render('dashboard', {
        firstName: 'Demo Jobseeker',
        // Add more mock data as needed
    });
});

// Dev route: Agency Dashboard
router.get('/dashboard/agency', (req, res) => {
    res.render('agency/dashboard', {
        agencyName: 'Demo Agency',
        // Add more mock data as needed
    });
});

// Dev route: Employer Dashboard
router.get('/dashboard/employer', (req, res) => {
    res.render('employer/dashboard', {
        firstName: 'Demo Employer',
        // Add more mock data as needed
    });
});

module.exports = router; 