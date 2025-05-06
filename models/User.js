const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

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
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true,
    enum: ['jobseeker', 'agency', 'employer']
  },
  // Common fields for all user types
  firstName: String,
  lastName: String,
  phone: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Agency specific fields
  agencyProfile: {
    agencyName: String,
    companyType: {
      type: String,
      enum: ['recruitment', 'staffing', 'consulting']
    },
    description: String,
    foundedYear: Number,
    services: [{
      type: String,
      enum: ['permanent', 'contract', 'executive']
    }],
    specialties: String,
    address: String,
    website: String
  },
  // Jobseeker specific fields
  jobseekerProfile: {
    skills: [String],
    experience: [ExperienceSchema],
    education: [EducationSchema]
  },
  // Employer specific fields
  employerProfile: {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency'
    },
    position: String,
    department: String
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
  linkedin: {
    type: String,
    trim: true
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
  profileImage: {
    type: String,
    default: '/images/default-avatar.png'
  }
}, { timestamps: true });

// Add index on email field
UserSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

const User = mongoose.model("User", UserSchema);

module.exports = User;
