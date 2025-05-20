const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    company: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    location: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    type: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Remote', 'Internship'],
        required: true,
        index: true
    },
    description: {
        type: String,
        required: true
    },
    requirements: [{
        type: String,
        required: true
    }],
    salary: {
        type: String,
        required: true
    },
    skills: [{
        type: String,
        required: true,
        index: true
    }],
    category: {
        type: String,
        required: true,
        index: true
    },
    postedDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true
});

// Create compound indexes for better search performance
jobSchema.index({ title: 1, company: 1, location: 1 });
jobSchema.index({ skills: 1, type: 1, location: 1 });
jobSchema.index({ category: 1, type: 1, isActive: 1 });

module.exports = mongoose.model('Job', jobSchema); 