const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

// View profile
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -__v');
        
        if (!user) {
            return res.redirect('/login');
        }

        // Initialize arrays if they don't exist
        user.experience = user.experience || [];
        user.education = user.education || [];
        user.skills = user.skills || [];
        user.preferredJobTypes = user.preferredJobTypes || [];
        user.preferredLocations = user.preferredLocations || [];
        
        res.render('profile/index', { 
            user,
            title: 'My Profile',
            isAuthenticated: true,
            success: req.session.success,
            error: req.session.error
        });
        
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    } catch (error) {
        next(error);
    }
});

// Edit profile page
router.get('/edit', authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password -__v');
        
        if (!user) {
            return res.redirect('/login');
        }

        // Initialize arrays if they don't exist
        user.experience = user.experience || [];
        user.education = user.education || [];
        user.skills = user.skills || [];
        user.preferredJobTypes = user.preferredJobTypes || [];
        user.preferredLocations = user.preferredLocations || [];
        
        res.render('profile/edit', { 
            user,
            title: 'Edit Profile',
            isAuthenticated: true,
            success: req.session.success,
            error: req.session.error
        });
        
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    } catch (error) {
        next(error);
    }
});

// Update profile
router.post('/edit', authMiddleware, async (req, res, next) => {
    try {
        const {
            name,
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

        // Validate required fields
        if (!name) {
            req.session.error = 'Name is required';
            return res.redirect('/profile/edit');
        }

        const updateData = {
            name,
            title: title || '',
            bio: bio || '',
            location: location || '',
            phone: phone || '',
            linkedin: linkedin || '',
            skills: skills ? skills.split(',').map(skill => skill.trim()).filter(Boolean) : [],
            preferredJobTypes: preferredJobTypes ? preferredJobTypes.split(',').map(type => type.trim()).filter(Boolean) : [],
            preferredLocations: preferredLocations ? preferredLocations.split(',').map(loc => loc.trim()).filter(Boolean) : [],
            expectedSalary: expectedSalary || ''
        };

        // Handle experience array if it exists
        if (experience) {
            updateData.experience = Array.isArray(experience) ? experience : [experience];
            updateData.experience = updateData.experience.map(exp => ({
                title: exp.title || '',
                company: exp.company || '',
                startDate: exp.startDate || null,
                endDate: exp.endDate || null,
                description: exp.description || ''
            })).filter(exp => exp.title && exp.company); // Only keep experiences with at least title and company
        }

        // Handle education array if it exists
        if (education) {
            updateData.education = Array.isArray(education) ? education : [education];
            updateData.education = updateData.education.map(edu => ({
                degree: edu.degree || '',
                school: edu.school || '',
                startDate: edu.startDate || null,
                endDate: edu.endDate || null
            })).filter(edu => edu.degree && edu.school); // Only keep education entries with at least degree and school
        }

        const user = await User.findByIdAndUpdate(
            req.user._id, 
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!user) {
            req.session.error = 'User not found';
            return res.redirect('/login');
        }
        
        req.session.success = 'Profile updated successfully';
        res.redirect('/profile');
    } catch (error) {
        console.error('Profile update error:', error);
        req.session.error = 'Failed to update profile. Please try again.';
        res.redirect('/profile/edit');
    }
});

// Add work experience
router.post('/experience', authMiddleware, async (req, res, next) => {
    try {
        const { title, company, startDate, endDate, description } = req.body;
        
        const user = await User.findById(req.user._id);
        if (!user) {
            req.session.error = 'User not found';
            return res.redirect('/login');
        }
        
        user.experience.push({
            title,
            company,
            startDate,
            endDate,
            description
        });
        
        await user.save();
        
        req.session.success = 'Work experience added successfully';
        res.redirect('/profile');
    } catch (error) {
        next(error);
    }
});

// Add education
router.post('/education', authMiddleware, async (req, res, next) => {
    try {
        const { degree, school, startDate, endDate } = req.body;
        
        const user = await User.findById(req.user._id);
        if (!user) {
            req.session.error = 'User not found';
            return res.redirect('/login');
        }
        
        user.education.push({
            degree,
            school,
            startDate,
            endDate
        });
        
        await user.save();
        
        req.session.success = 'Education added successfully';
        res.redirect('/profile');
    } catch (error) {
        next(error);
    }
});

module.exports = router; 