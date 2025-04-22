const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.authMiddleware = async (req, res, next) => {
    try {
        console.log('Auth Check - Session ID:', req.session.userId);
        console.log('Auth Check - Token:', req.cookies.token);

        // First check session
        if (req.session.userId) {
            console.log('Found session ID, looking up user...');
            const user = await User.findById(req.session.userId).select("-password");
            if (user) {
                console.log('User found by session:', user.email);
                req.user = user;
                return next();
            }
        }

        // Then check JWT token
        const token = req.cookies.token;
        if (!token) {
            console.log('No token found, redirecting to login');
            return res.redirect("/login");
        }

        console.log('Token found, verifying...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', decoded);
        
        const user = await User.findById(decoded.id).select("-password");
        
        if (!user) {
            console.log('No user found with token ID');
            return res.redirect("/login");
        }

        console.log('User authenticated:', user.email);
        req.user = user;
        next();
    } catch (err) {
        console.error("Auth error:", err);
        res.clearCookie("token");
        if (req.session) {
            req.session.destroy();
        }
        return res.redirect("/login");
    }
};
