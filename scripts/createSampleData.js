const mongoose = require('mongoose');
const dotenv = require('dotenv');
const JobApplication = require('../models/JobApplication');

// Load environment variables
dotenv.config();

// Sample applications data
const sampleApplications = [
    {
        jobTitle: "Senior Software Engineer",
        company: "Tech Innovators Inc.",
        location: "San Francisco, CA",
        status: "Interview Scheduled",
        appliedDate: new Date(),
        salary: "$120,000 - $150,000",
        notes: "Technical interview scheduled for next week",
        nextSteps: "Prepare for system design discussion",
        interviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    },
    {
        jobTitle: "Full Stack Developer",
        company: "Digital Solutions Ltd",
        location: "New York, NY",
        status: "Pending",
        appliedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        salary: "$90,000 - $120,000",
        notes: "Application submitted through company website",
        nextSteps: "Follow up if no response by next week"
    },
    {
        jobTitle: "Frontend Engineer",
        company: "WebTech Corp",
        location: "Remote",
        status: "Reviewed",
        appliedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        salary: "$85,000 - $110,000",
        notes: "Initial screening call completed",
        nextSteps: "Waiting for technical interview schedule"
    }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Get the first user from the database
        const User = require('../models/User');
        const user = await User.findOne();
        
        if (!user) {
            console.error('No users found in the database');
            process.exit(1);
        }

        // Add user ID to each application
        const applicationsWithUser = sampleApplications.map(app => ({
            ...app,
            userId: user._id
        }));

        // Clear existing applications
        await JobApplication.deleteMany({ userId: user._id });

        // Insert sample applications
        await JobApplication.insertMany(applicationsWithUser);
        
        console.log('Sample applications created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating sample applications:', error);
        process.exit(1);
    }
})
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
}); 