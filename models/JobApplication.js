const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    jobTitle: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Reviewed', 'Shortlisted', 'Interview Scheduled', 'Offer Made', 'Rejected', 'Withdrawn'],
        default: 'Pending'
    },
    appliedDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String
    },
    nextSteps: {
        type: String
    },
    interviewDate: {
        type: Date
    },
    salary: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('JobApplication', jobApplicationSchema); 