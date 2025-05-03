const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.authMiddleware = async (req, res, next) => {
    try {
        // First check session
        if (req.session.userId) {
            const user = await User.findById(req.session.userId).select("-password");
            if (user) {
                req.user = user;
                return next();
            }
        }

        // Then check JWT token
        const token = req.cookies.token;
        if (!token) {
            return res.redirect("/login");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id).select("-password");
        
        if (!user) {
            return res.redirect("/login");
        }

        req.user = user;
        // Set session if it doesn't exist
        if (!req.session.userId) {
            req.session.userId = user._id;
            await req.session.save();
        }
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
