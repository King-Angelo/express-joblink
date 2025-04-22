const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// @desc    Register new user (API endpoint)
// @route   POST /api/auth/register
router.post("/register", async (req, res) => {
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

    // Set JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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

// @desc    Login user (API endpoint)
// @route   POST /api/auth/login
router.post("/login", async (req, res) => {
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
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000 // 1 hour
    });

    // Redirect to dashboard
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    return res.render("login", { error: "Something went wrong" });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
router.post("/logout", (req, res) => {
    try {
        // Clear the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
        });

        // Clear the JWT cookie
        res.clearCookie('token');

        // Redirect to home page
        return res.redirect('/');
    } catch (err) {
        console.error('Logout error:', err);
        return res.redirect('/');
    }
});

module.exports = router;
