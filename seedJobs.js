const mongoose = require('mongoose');
const Job = require('./models/Job');

// Sample job data
const jobs = [
    {
        title: "Full Stack Developer",
        company: "Tech Solutions Inc.",
        location: "Manila, Philippines",
        type: "Full-time",
        description: "We are looking for a Full Stack Developer to join our growing team. The ideal candidate will have experience with both frontend and backend development.",
        requirements: [
            "3+ years of experience in web development",
            "Proficiency in JavaScript, React, and Node.js",
            "Experience with MongoDB or similar NoSQL databases",
            "Strong problem-solving skills"
        ],
        salary: "₱60,000 - ₱90,000 per month",
        skills: ["JavaScript", "React", "Node.js", "MongoDB", "Express"],
        category: "Software Development",
        isActive: true
    },
    {
        title: "UI/UX Designer",
        company: "Creative Digital Agency",
        location: "Makati, Philippines",
        type: "Full-time",
        description: "Join our creative team as a UI/UX Designer. You will be responsible for creating beautiful and functional user interfaces for our clients.",
        requirements: [
            "2+ years of UI/UX design experience",
            "Proficiency in Figma and Adobe Creative Suite",
            "Strong portfolio showcasing web and mobile designs",
            "Understanding of user-centered design principles"
        ],
        salary: "₱45,000 - ₱70,000 per month",
        skills: ["UI Design", "UX Design", "Figma", "Adobe XD", "Prototyping"],
        category: "Design",
        isActive: true
    },
    {
        title: "Data Analyst",
        company: "Analytics Pro",
        location: "BGC, Philippines",
        type: "Full-time",
        description: "We're seeking a Data Analyst to help us make sense of complex data and provide actionable insights to our clients.",
        requirements: [
            "Bachelor's degree in Statistics, Mathematics, or related field",
            "Experience with SQL and data visualization tools",
            "Strong analytical and problem-solving skills",
            "Excellent communication skills"
        ],
        salary: "₱50,000 - ₱75,000 per month",
        skills: ["SQL", "Python", "Data Visualization", "Statistics", "Excel"],
        category: "Data Science",
        isActive: true
    },
    {
        title: "Marketing Manager",
        company: "Global Solutions Ltd.",
        location: "Ortigas, Philippines",
        type: "Full-time",
        description: "Lead our marketing efforts and develop comprehensive marketing strategies to drive business growth.",
        requirements: [
            "5+ years of marketing experience",
            "Experience with digital marketing and social media",
            "Strong leadership and team management skills",
            "Excellent project management abilities"
        ],
        salary: "₱80,000 - ₱120,000 per month",
        skills: ["Digital Marketing", "Social Media", "Content Strategy", "Analytics", "Team Management"],
        category: "Marketing",
        isActive: true
    },
    {
        title: "Frontend Developer",
        company: "Web Wizards",
        location: "Remote",
        type: "Contract",
        description: "Looking for a talented Frontend Developer to create responsive and interactive web applications.",
        requirements: [
            "Strong proficiency in HTML, CSS, and JavaScript",
            "Experience with React or Vue.js",
            "Understanding of responsive design principles",
            "Knowledge of version control systems"
        ],
        salary: "₱40,000 - ₱60,000 per month",
        skills: ["HTML", "CSS", "JavaScript", "React", "Responsive Design"],
        category: "Software Development",
        isActive: true
    }
];

// Function to seed the database
async function seedJobs() {
    try {
        // Connect to database directly
        await mongoose.connect('mongodb://localhost:27017/jobportal', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Clear existing jobs
        await Job.deleteMany({});
        console.log('Cleared existing jobs');

        // Insert new jobs
        const createdJobs = await Job.insertMany(jobs);
        console.log(`Successfully seeded ${createdJobs.length} jobs`);

        // Close the connection
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding jobs:', error);
        process.exit(1);
    }
}

// Run the seeding function
seedJobs(); 