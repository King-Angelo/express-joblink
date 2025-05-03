const mongoose = require('mongoose');

const jobAlertPreferenceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    keywords: [{
        type: String,
        trim: true
    }],
    locations: [{
        type: String,
        trim: true
    }],
    jobTypes: [{
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Remote', 'Internship']
    }],
    categories: [{
        type: String,
        trim: true
    }],
    salaryRange: {
        min: {
            type: Number,
            default: 0
        },
        max: {
            type: Number
        }
    },
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'instant'],
        default: 'daily'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastNotified: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('JobAlertPreference', jobAlertPreferenceSchema); 