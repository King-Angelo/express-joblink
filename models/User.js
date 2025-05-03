const mongoose = require("mongoose");

const ExperienceSchema = new mongoose.Schema({
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
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    description: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const EducationSchema = new mongoose.Schema({
    degree: {
        type: String,
        required: true,
        trim: true
    },
    school: {
        type: String,
        required: true,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    }
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
        required: [true, 'Name is required'],
    trim: true,
        minlength: [2, 'Name must be at least 2 characters long']
  },
  email: {
    type: String,
        required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    title: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        trim: true
    },
    location: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    linkedin: {
        type: String,
        trim: true
    },
    skills: {
        type: [String],
        default: []
    },
    preferredJobTypes: {
        type: [String],
        default: []
    },
    preferredLocations: {
        type: [String],
        default: []
    },
    expectedSalary: {
        type: String,
        trim: true
    },
    experience: [ExperienceSchema],
    education: [EducationSchema],
    profileImage: {
        type: String,
        default: '/images/default-avatar.png'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Add index on email field
UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);
