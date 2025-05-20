const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const Employer = require('./Employer');
const JobApplication = require('./JobApplication');
const JobAlert = require('./JobAlert');
const JobAlertPreference = require('./JobAlertPreference');
const Notification = require('./Notification');
const Agency = require('./Agency');

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
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
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

// Add pre-delete middleware to delete associated records
UserSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    try {
        const userId = this._id;
        console.log(`Cleaning up associated records for user: ${userId}`);

        // Delete employer record if user is an employer
        if (this.userType === 'employer') {
            await Employer.deleteOne({ user: userId });
            console.log(`Deleted employer record for user: ${userId}`);
        }

        // Delete agency record if user is an agency
        if (this.userType === 'agency') {
            await Agency.deleteOne({ user: userId });
            console.log(`Deleted agency record for user: ${userId}`);
        }

        // Delete all related records
        await Promise.all([
            JobApplication.deleteMany({ jobseeker: userId }),
            JobAlert.deleteMany({ userId }),
            JobAlertPreference.deleteMany({ userId }),
            Notification.deleteMany({ user: userId })
        ]);
        
        console.log(`Deleted all related records for user: ${userId}`);
        next();
    } catch (error) {
        console.error('Error in pre-delete middleware:', error);
        next(error);
    }
});

// Add static method to safely delete a user and all associated records
UserSchema.statics.safeDelete = async function(userId) {
    try {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        console.log(`Cleaning up associated records for user: ${userId}`);

        // Delete employer record if user is an employer
        if (user.userType === 'employer') {
            await Employer.deleteOne({ user: userId });
            console.log(`Deleted employer record for user: ${userId}`);
        }

        // Delete agency record if user is an agency
        if (user.userType === 'agency') {
            await Agency.deleteOne({ user: userId });
            console.log(`Deleted agency record for user: ${userId}`);
        }

        // Delete all related records
        await Promise.all([
            JobApplication.deleteMany({ jobseeker: userId }),
            JobAlert.deleteMany({ userId }),
            JobAlertPreference.deleteMany({ userId }),
            Notification.deleteMany({ user: userId })
        ]);
        
        console.log(`Deleted all related records for user: ${userId}`);

        // Finally delete the user
        await this.deleteOne({ _id: userId });
        console.log(`Successfully deleted user: ${userId}`);

        return true;
    } catch (error) {
        console.error('Error in safeDelete:', error);
        throw error;
    }
};

// Add safeDelete method to schema
UserSchema.methods.safeDelete = async function() {
    try {
        const userId = this._id;
        console.log(`Starting safe delete for user: ${userId}`);

        // Delete employer record if user is an employer
        if (this.userType === 'employer') {
            await Employer.deleteOne({ user: userId });
            console.log(`Deleted employer record for user: ${userId}`);
        }

        // Delete agency record if user is an agency
        if (this.userType === 'agency') {
            await Agency.deleteOne({ user: userId });
            console.log(`Deleted agency record for user: ${userId}`);
        }

        // Delete job applications
        await JobApplication.deleteMany({ jobseeker: userId });
        console.log(`Deleted job applications for user: ${userId}`);

        // Delete job alerts
        await JobAlert.deleteMany({ user: userId });
        console.log(`Deleted job alerts for user: ${userId}`);

        // Delete job alert preferences
        await JobAlertPreference.deleteMany({ user: userId });
        console.log(`Deleted job alert preferences for user: ${userId}`);

        // Delete notifications
        await Notification.deleteMany({ user: userId });
        console.log(`Deleted notifications for user: ${userId}`);

        // Finally, delete the user
        await this.deleteOne();
        console.log(`Deleted user: ${userId}`);

        return true;
    } catch (error) {
        console.error('Error in safeDelete:', error);
        throw error;
    }
};

const User = mongoose.model("User", UserSchema);

module.exports = User;
