const session = require('express-session');
const MongoStore = require('connect-mongo');

/**
 * Session Configuration
 * Implements NIST SP 800-63-2 session management requirements
 * - Server-side session storage in MongoDB
 * - Secure cookies (httpOnly, secure in production)
 * - Session timeout enforcement
 * - Session ID regeneration after login
 */

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  // Use MongoDB-backed session store when MONGODB_URI is provided.
  // Fall back to in-memory store for local testing when not configured.
  store: (function () {
    if (process.env.MONGODB_URI) {
      return MongoStore.create({ mongoUrl: process.env.MONGODB_URI });
    }
    console.warn('Warning: MONGODB_URI not set. Using MemoryStore (not for production).');
    return new session.MemoryStore();
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevents XSS attacks
    sameSite: 'strict', // CSRF protection
    maxAge: parseInt(process.env.SESSION_TIMEOUT || 3600000), // 1 hour default
  },
  name: 'research-portal-session', // Custom session name
};

/**
 * Create session middleware
 */
const sessionMiddleware = session(sessionConfig);

module.exports = sessionMiddleware;
