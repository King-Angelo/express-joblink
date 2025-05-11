const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Remote', 'Internship'],
        required: true
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
        required: true
    }],
    category: {
        type: String,
        required: true
    },
    postedDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Create indexes for better search performance
jobSchema.index({ title: 'text', company: 'text', skills: 'text', category: 'text' });

module.exports = mongoose.model('Job', jobSchema); 