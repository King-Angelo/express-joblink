const mongoose = require('mongoose');
const winston = require('winston');

// Create a logger instance
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MongoDB connection string is not defined in environment variables');
        }

        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // These options are no longer needed in Mongoose 6+
            // but kept here for compatibility with older versions
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        logger.info(`MongoDB Connected: ${conn.connection.host}`);

        // Handle connection events
        mongoose.connection.on('connected', () => {
            logger.info('Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            logger.error('Mongoose connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.info('Mongoose disconnected from MongoDB');
        });

        // Handle process termination
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            logger.info('Mongoose connection closed through app termination');
            process.exit(0);
        });

        return conn;
    } catch (error) {
        logger.error('MongoDB connection error:', error);
        // Exit with failure
        process.exit(1);
    }
};

module.exports = connectDB;
