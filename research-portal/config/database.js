const mongoose = require('mongoose');

/**
 * MongoDB Atlas Configuration
 * Cloud-based MongoDB with encryption at rest
 * Connection pooling and TLS/SSL enabled
 */

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI not configured in .env');
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Connection pooling
      maxPoolSize: 10,
      minPoolSize: 5,
      // Automatically retry connection
      retryWrites: true,
      // TLS/SSL enabled by default on MongoDB Atlas
    });

    console.log('✓ MongoDB Atlas connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
