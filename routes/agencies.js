const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Employer = require('../models/Employer');
const JobApplication = require('../models/JobApplication');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/authMiddleware');

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

// Submit application to agency/employer
router.post('/:id/apply', authMiddleware, async (req, res) => {
    try {
        const { resume, coverLetter } = req.body;
        const targetUser = await User.findOne({
            _id: req.params.id,
            deletedAt: { $exists: false },
            'agencyProfile.agencyName': { $exists: true, $ne: '' }
        });
        
        if (!targetUser) {
            return res.status(404).render('error', { 
                message: 'Agency/Employer not found',
                error: { status: 404 }
            });
        }

        const application = new JobApplication({
            jobseeker: req.user._id,
            agency: req.params.id,
            resume,
            coverLetter,
            status: 'pending'
        });

        await application.save();

        // Create notification for the agency/employer
        const notification = new Notification({
            recipient: req.params.id,
            sender: req.user._id,
            type: 'new_application',
            message: `New application from ${req.user.firstName} ${req.user.lastName}`,
            relatedApplication: application._id
        });

        await notification.save();

        res.redirect('/agencies/browse?success=true');
    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).render('error', { 
            message: 'Error submitting application',
            error: error
        });
    }
});

module.exports = router; 