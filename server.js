const express = require("express");
const path = require("path");
const session = require("express-session");
const morgan = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const winston = require("winston");

// Import routes and models
const connectDB = require("./config/db");
const User = require("./models/User");
const { authMiddleware } = require("./middleware/authMiddleware");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const pageRoutes = require("./routes/pages");
const jobRoutes = require("./routes/jobs");
const profileRoutes = require("./routes/profile");
const jobAlertRoutes = require("./routes/jobAlerts");
const employerRoutes = require("./routes/employer");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set up view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Debug middleware - Log every request (development only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log('\n--- New Request ---');
        console.log('URL:', req.url);
        console.log('Method:', req.method);
        console.log('Session:', req.session);
        console.log('Cookies:', req.cookies);
        console.log('Body:', req.body);
        next();
    });
}

// Simple flash message middleware
app.use((req, res, next) => {
    res.locals.flash = {
        success: req.session.success,
        error: req.session.error
    };
    req.flash = (type, message) => {
        req.session[type] = message;
    };
    next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/dashboard", authMiddleware, dashboardRoutes);
app.use("/jobs", jobRoutes);
app.use("/profile", profileRoutes);
app.use("/job-alerts", authMiddleware, jobAlertRoutes);
app.use("/employer", employerRoutes);
app.use("/", pageRoutes);

// Login route
app.post("/login", async (req, res) => {
    console.log('Processing login attempt:', req.body);
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        
        // Check if user exists and password matches
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render("login", { error: "Invalid email or password" });
        }

        // Set session
        req.session.userId = user._id;
        await req.session.save();

        // Set JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: "24h" });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Redirect to dashboard
        return res.redirect('/dashboard');
    } catch (err) {
        console.error('Login error:', err);
        return res.render("login", { error: "Something went wrong" });
    }
});

// Register routes
app.get("/register", (req, res) => {
    console.log('Handling register route');
    try {
        // If user is already logged in, redirect to dashboard
        if (req.session.userId) {
            return res.redirect('/dashboard');
        }
        res.render("register", { error: null });
    } catch (err) {
        console.error('Error rendering register:', err);
        res.status(500).send('Error rendering register page');
    }
});

app.post("/register", async (req, res) => {
    console.log('Registration attempt:', req.body);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.render("register", { error: "All fields are required" });
    }

    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('User already exists:', email);
            return res.render("register", { error: "Email already registered" });
        }

        // Create new user
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();
        console.log('User created:', user._id);

        // Set session
        req.session.userId = user._id;
        await req.session.save();
        console.log('Session after registration:', req.session);

        // Set JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.cookie('token', token, {
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            maxAge: 3600000 // 1 hour
        });

        return res.redirect('/dashboard');
    } catch (err) {
        console.error('Registration error:', err);
        return res.render("register", { 
            error: "Registration failed. Please try again.",
            name: name,
            email: email
        });
    }
});

// Dashboard route with session check
app.get("/dashboard", async (req, res) => {
    console.log('Handling dashboard route');
    console.log('Session:', req.session);
    
    try {
        // Check if user is logged in
        if (!req.session.userId) {
            console.log('No session, redirecting to login');
            return res.redirect('/login');
        }

        // Get user data
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            console.log('No user found, destroying session');
            req.session.destroy();
            return res.redirect('/login');
        }

        // Check if user is an employer
        const Employer = require('./models/Employer');
        const employerProfile = await Employer.findOne({ user: user._id });
        if (employerProfile) {
            // Redirect to employer dashboard
            return res.redirect('/employer/dashboard');
        }

        // Render dashboard with user data (job seeker dashboard)
        const dashboardData = {
            user: user,
            newJobs: 5,
            savedJobs: 3,
            recentActivity: [
                "Applied to Software Engineer position at Tech Corp",
                "Viewed Frontend Developer role at WebDev Inc.",
                "Updated your resume"
            ],
            chartData: {
                labels: ["January", "February", "March"],
                values: [10, 20, 30]
            }
        };

        console.log('Rendering dashboard for user:', user.email);
        res.render("dashboard", dashboardData);
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).render("error", { error: "Failed to load dashboard" });
    }
});

// Company Reviews (Protected)
app.get("/company-reviews", authMiddleware, async (req, res) => {
    const reviews = [
        { companyName: "Tech Innovations Inc.", rating: 4, reviewText: "Great place to work!", date: new Date() },
        { companyName: "Global Solutions Ltd.", rating: 3, reviewText: "Decent work-life balance.", date: new Date() },
    ];
    res.render("company-reviews/_partial", { reviews });
});

// Edit Profile (Protected)
app.get("/profile/edit", authMiddleware, (req, res) => {
    res.render("profile/edit", { user: req.user });
});

// Saved Jobs (Protected)
app.get("/saved-jobs", authMiddleware, async (req, res) => {
    const savedJobs = [
        { id: "1", title: "Software Engineer", company: "Awesome Co.", location: "Remote" },
        { id: "2", title: "Data Scientist", company: "Analytics Pro", location: "New York" },
    ];
    res.render("saved-jobs/index", { savedJobs });
});

// Applied Jobs (Protected)
app.get("/applied-jobs", authMiddleware, async (req, res) => {
    const applications = [
        { jobTitle: "Frontend Developer", companyName: "Web Wizards", appliedDate: new Date(), status: "Pending" },
        { jobTitle: "Backend Engineer", companyName: "Server Side Inc.", appliedDate: new Date(), status: "Reviewed" },
    ];
    res.render("applied-jobs/index", { applications });
});

// Redirect /job-alerts to /dashboard/alerts
app.get('/job-alerts', (req, res) => {
    res.redirect('/dashboard/alerts');
});

// Redirect /applications to /dashboard/applications
app.get('/applications', (req, res) => {
    res.redirect('/dashboard/applications');
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    
    // Set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // Render the error page
    res.status(err.status || 500);
    res.render('error', { 
        title: 'Error',
        message: err.message || 'Something went wrong!',
        error: req.app.get('env') === 'development' ? err : {},
        isAuthenticated: !!req.session.userId
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        isAuthenticated: !!req.session.userId
    });
});

// Start server
app.listen(PORT, () => {
    console.clear();
    console.log('='.repeat(50));
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log('Available routes:');
    console.log(`1. http://localhost:${PORT} (Home)`);
    console.log(`2. http://localhost:${PORT}/login (Login)`);
    console.log(`3. http://localhost:${PORT}/register (Register)`);
    console.log(`4. http://localhost:${PORT}/dashboard (Dashboard - Protected)`);
    console.log('='.repeat(50));
});