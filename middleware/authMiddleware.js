const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.authMiddleware = async (req, res, next) => {
    try {
        console.log("Auth middleware - Session data:", {
            userId: req.session?.userId,
            userType: req.session?.userType
        });

        // First check session
        if (req.session?.userId) {
            const user = await User.findById(req.session.userId).select("-password");
            if (user) {
                console.log("User authenticated via session:", {
                    userId: user._id,
                    userType: user.userType
                });
                req.user = user;
                return next();
            }
        }

        // Then check JWT token
        const token = req.cookies.token;
        if (!token) {
            console.log("No token found, redirecting to login");
            return res.redirect("/login");
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const user = await User.findById(decoded.id).select("-password");
            
            if (!user) {
                console.log("User not found for token, redirecting to login");
                return res.redirect("/login");
            }

            console.log("User authenticated via token:", {
                userId: user._id,
                userType: user.userType
            });

            req.user = user;
            // Set session if it doesn't exist
            if (!req.session.userId) {
                req.session.userId = user._id;
                req.session.userType = user.userType;
                await req.session.save();
            }
            next();
        } catch (tokenError) {
            console.error("Token verification failed:", tokenError);
            res.clearCookie("token");
            return res.redirect("/login");
        }
    } catch (err) {
        console.error("Auth middleware error:", err);
        res.clearCookie("token");
        if (req.session) {
            req.session.destroy();
        }
        return res.redirect("/login");
    }
};
