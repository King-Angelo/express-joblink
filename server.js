// server.js
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

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const connectDB = require("./config/db");
connectDB();

const User = require("./models/User");
const { authMiddleware } = require("./middleware/authMiddleware");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const jobRoutes = require("./routes/jobs");
const profileRoutes = require("./routes/profile");
const jobAlertRoutes = require("./routes/jobAlerts");
const employerRoutes = require("./routes/employer");
const pageRoutes = require("./routes/pages");
const devRoutes = require("./routes/dev"); // Assuming you have this file
const agenciesRoutes = require("./routes/agencies");

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || "super-secret-key",
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use("/css", express.static(path.join(__dirname, "public/css")));
app.use("/images", express.static(path.join(__dirname, "public/images")));
app.use("/js", express.static(path.join(__dirname, "public/js")));

if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log("\n--- Incoming Request ---");
        console.log("URL:", req.url);
        console.log("Method:", req.method);
        console.log("Session:", req.session);
        console.log("Cookies:", req.cookies);
        next();
    });
}

app.get("/register", (req, res) => {
    console.log("--- /register route hit (rendering register-options) ---");
    res.render("register-options");
});

app.get("/register/:type", (req, res) => {
    console.log("--- /register/:type route hit ---");
    const { type } = req.params;
    console.log("req.params.type:", type);
    
    if (!["jobseeker", "agency", "employer"].includes(type)) {
        console.log("Invalid type, redirecting to /register");
        return res.redirect("/register");
    }

    if (req.session.userId) {
        console.log("User logged in, redirecting to dashboard");
        return res.redirect(`/${req.session.userType}/dashboard`);
    }

    if (type === "agency") {
        console.log("Rendering agency-profile for type:", type);
        return res.render("agency-profile", { error: null, userType: type });
    }
    
    console.log("Rendering register with userType:", type);
    return res.render("register", { error: null, userType: type });
});

app.use("/api/auth", authRoutes);
app.use("/dashboard", authMiddleware, dashboardRoutes);
app.use("/jobs", jobRoutes);
app.use("/profile", profileRoutes);
app.use("/job-alerts", authMiddleware, jobAlertRoutes);
app.use("/employer", employerRoutes);
app.use("/agencies", agenciesRoutes);
app.use("/", pageRoutes);
app.use("/dev", devRoutes);

app.post("/login", async (req, res) => {
    const { email, password, userType } = req.body;
    console.log("Login attempt:", { email, userType });

    try {
        const user = await User.findOne({ email, userType });
        if (!user) {
            console.log("User not found:", { email, userType });
            return res.render("login", { error: "Invalid email or user type" });
        }

        console.log("User found, comparing passwords");
        const valid = await user.comparePassword(password);
        console.log("Password comparison result:", valid);

        if (!valid) {
            console.log("Invalid password for user:", { email, userType });
            return res.render("login", { error: "Invalid password" });
        }

        // Set session data
        req.session.userId = user._id;
        req.session.userType = user.userType;
        req.session.user = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            userType: user.userType,
            agencyName: user.agencyProfile?.agencyName
        };

        console.log("Login successful, session data:", {
            userId: req.session.userId,
            userType: req.session.userType
        });

        // Save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.render("login", { error: "Login failed" });
            }

            console.log("Session saved, redirecting to dashboard");
            switch (userType) {
                case "jobseeker": return res.redirect("/dashboard");
                case "agency": return res.redirect("/agency/dashboard");
                case "employer": return res.redirect("/employer/dashboard");
                default: return res.redirect("/dashboard");
            }
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.render("login", { error: "An error occurred during login" });
    }
});

app.get("/register-options", (req, res) => {
    res.render("register-options");
});

app.post("/register/jobseeker", async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("Rendering register with error (existing email) - jobseeker", { userType: 'jobseeker' });
            return res.render("register", { error: "Email already registered", userType: 'jobseeker' });
        }

        const user = new User({
            firstName,
            lastName,
            email,
            password, // The pre-save middleware will hash this
            userType: 'jobseeker'
        });

        await user.save();
        req.session.userId = user._id;
        req.session.userType = 'jobseeker';

        return res.redirect('/dashboard');
    } catch (err) {
        console.error('Jobseeker registration error:', err);
        console.log("Rendering register with error (registration failed) - jobseeker", { userType: 'jobseeker' });
        return res.render("register", { error: "Registration failed", userType: 'jobseeker' });
    }
});

app.post("/register/employer", async (req, res) => {
    const { 
        firstName, 
        lastName, 
        email, 
        password, 
        companyName,
        companyDescription,
        industry,
        companySize,
        location,
        contactEmail,
        contactPhone,
        website
    } = req.body;
    console.log("Employer registration attempt:", { email, companyName });

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("Email already registered:", email);
            return res.render("register", { error: "Email already registered", userType: 'employer' });
        }

        // Create User document
        const user = new User({
            firstName,
            lastName,
            email,
            password, // The pre-save middleware will hash this
            userType: 'employer'
        });

        await user.save();
        console.log("User saved successfully:", { userId: user._id, email: user.email });

        // Create Employer document
        const Employer = require('./models/Employer');
        const employer = new Employer({
            user: user._id,
            companyName,
            companyDescription: companyDescription || "A great company to work for",
            industry: industry || "Technology",
            companySize: companySize || "1-10",
            location: location || "Remote",
            contactEmail: contactEmail || email,
            contactPhone: contactPhone || "",
            website: website || "",
            verificationStatus: 'pending'
        });

        await employer.save();
        console.log("Employer profile created:", { employerId: employer._id });

        // Set session data
        req.session.userId = user._id;
        req.session.userType = 'employer';
        req.session.user = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            userType: 'employer'
        };

        // Save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.render("register", { error: "Registration failed", userType: 'employer' });
            }
            console.log("Session saved, redirecting to dashboard");
            return res.redirect('/employer/dashboard');
        });
    } catch (err) {
        console.error('Employer registration error:', err);
        return res.render("register", { error: "Registration failed", userType: 'employer' });
    }
});

app.post("/agency/create", async (req, res) => {
    const {
        agencyName,
        email,
        password,
        companyType,
        description,
        foundedYear,
        services,
        specialties,
        address,
        phone,
        website
    } = req.body;
    console.log("Agency registration attempt:", { email, agencyName });

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("Email already registered:", email);
            return res.render("agency-profile", { error: "Email already registered", userType: 'agency' });
        }

        // Create User document
        const user = new User({
            firstName: agencyName, // Using agency name as first name
            lastName: "", // Empty last name for agency
            email,
            password, // The pre-save middleware will hash this
            userType: 'agency',
            agencyProfile: {
                agencyName,
                companyType,
                description,
                foundedYear,
                services: Array.isArray(services) ? services : [services],
                specialties,
                address,
                phone,
                website
            }
        });

        await user.save();
        console.log("Agency user saved successfully:", { userId: user._id, email: user.email });

        // Set session data
        req.session.userId = user._id;
        req.session.userType = 'agency';
        req.session.user = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            userType: user.userType,
            agencyName: user.agencyProfile.agencyName
        };

        // Save session before redirect
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.render("agency-profile", { error: "Registration failed", userType: 'agency' });
            }

            console.log("Session saved, redirecting to agency dashboard");
            return res.redirect("/agency/dashboard");
        });
    } catch (err) {
        console.error('Agency registration error:', err);
        return res.render("agency-profile", { error: "Registration failed", userType: 'agency' });
    }
});

app.get("/dashboard", async (req, res) => {
    if (!req.session.userId) return res.redirect("/login");

    try {
        const user = await User.findById(req.session.userId).select("-password");
        if (!user) {
            req.session.destroy();
            return res.redirect("/login");
        }

        const Employer = require("./models/Employer");
        const employerProfile = await Employer.findOne({ user: user._id });
        if (employerProfile) return res.redirect("/employer/dashboard");

        const dashboardData = {
            user,
            newJobs: 5,
            savedJobs: 3,
            recentActivity: [
                "Applied to Software Engineer at Tech Corp",
                "Viewed Frontend Developer at WebDev Inc.",
                "Updated resume"
            ],
            chartData: {
                labels: ["January", "February", "March"],
                values: [10, 20, 30]
            }
        };

        res.render("dashboard", dashboardData);
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).render("error", { error: "Dashboard failed to load" });
    }
});

app.get("/company-reviews", authMiddleware, (req, res) => {
    const reviews = [
        { companyName: "Tech Innovations", rating: 4, reviewText: "Great place!", date: new Date() },
        { companyName: "Global Solutions", rating: 3, reviewText: "Good work-life balance.", date: new Date() },
    ];
    res.render("company-reviews/_partial", { reviews });
});

app.get("/profile/edit", authMiddleware, (req, res) => {
    res.render("profile/edit", { user: req.user });
});

app.get("/saved-jobs", authMiddleware, (req, res) => {
    const savedJobs = [
        { id: "1", title: "Software Engineer", company: "Awesome Co.", location: "Remote" },
        { id: "2", title: "Data Scientist", company: "Analytics Pro", location: "NY" },
    ];
    res.render("saved-jobs/index", { savedJobs });
});

app.get("/applied-jobs", authMiddleware, (req, res) => {
    const applications = [
        { jobTitle: "Frontend Developer", companyName: "Web Wizards", appliedDate: new Date(), status: "Pending" },
        { jobTitle: "Backend Engineer", companyName: "Server Side", appliedDate: new Date(), status: "Reviewed" },
    ];
    res.render("applied-jobs/index", { applications });
});

app.get("/job-alerts", (req, res) => res.redirect("/dashboard/alerts"));
app.get("/applications", (req, res) => res.redirect("/dashboard/applications"));

app.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: "Password reset successfully" });
    } catch (err) {
        console.error("Password reset error:", err);
        res.json({ success: false, message: "Error resetting password" });
    }
});

// Agency Dashboard
app.get("/agency/dashboard", async (req, res) => {
    if (!req.session.userId || req.session.userType !== 'agency') {
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.redirect('/login');
        }

        // Get agency-specific data
        const dashboardData = {
            user,
            agencyName: user.agencyProfile?.agencyName,
            stats: {
                activeJobs: 0,
                totalCandidates: 0,
                interviewsScheduled: 0,
                placements: 0
            },
            recentActivity: [
                "Posted new job: Senior Developer",
                "Scheduled interview with John Doe",
                "Updated candidate profile"
            ],
            chartData: {
                labels: ["January", "February", "March"],
                values: [10, 20, 30]
            }
        };

        res.render("agency/dashboard", dashboardData);
    } catch (err) {
        console.error("Agency dashboard error:", err);
        res.status(500).render("error", { error: "Dashboard failed to load" });
    }
});

// Sign Out Route
app.get("/signout", (req, res) => {
    console.log("Sign out request received");
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.redirect("/");
        }
        console.log("Session destroyed, redirecting to home");
        res.redirect("/");
    });
});

app.use((err, req, res, next) => {
    console.error("Global error:", err);
    res.status(err.status || 500).render("error", {
        title: "Error",
        message: err.message || "Unexpected error",
        error: process.env.NODE_ENV === "development" ? err : {},
        isAuthenticated: !!req.session.userId
    });
});

app.use((req, res) => {
    res.status(404).render("error", {
        title: "Page Not Found",
        message: "The page you're looking for doesn't exist.",
        isAuthenticated: !!req.session.userId
    });
});

app.listen(PORT, () => {
    console.clear();
    console.log("=".repeat(60));
    console.log(`🚀 JobLink running on http://localhost:${PORT}`);
    console.log("=".repeat(60));
});