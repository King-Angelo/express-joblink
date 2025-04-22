const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Home route
app.get('/', (req, res) => {
    res.render('index');
});

// Login routes
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    // For testing purposes
    console.log('Login attempt:', { email, password });
    
    // Simple response for now
    res.json({ 
        success: true, 
        message: 'Login endpoint working' 
    });
});

// Register routes
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', { 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const PORT = 5000;
app.listen(PORT, () => {
    console.clear();
    console.log('='.repeat(50));
    console.log(`Server running on port ${PORT}`);
    console.log('Available routes:');
    console.log(`1. http://localhost:${PORT} (Home)`);
    console.log(`2. http://localhost:${PORT}/login (Login)`);
    console.log(`3. http://localhost:${PORT}/register (Register)`);
    console.log('='.repeat(50));
}); 