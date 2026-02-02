const User = require('../models/User');
const auditService = require('../services/auditService');

/**
 * Authentication Middleware
 * Enforces NIST SP 800-63-2 session management requirements
 */

// Middleware: Check if user is authenticated (session valid)
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId && req.session.mfaVerified) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
};

// Middleware: Check if user has completed MFA
exports.requireMFA = (req, res, next) => {
  if (req.session && req.session.mfaVerified) {
    return next();
  }
  res.status(403).json({ error: 'MFA verification required' });
};

// Middleware: Extract and validate session timeout
exports.checkSessionTimeout = (req, res, next) => {
  const SESSION_TIMEOUT = process.env.SESSION_TIMEOUT || 3600000; // 1 hour default

  if (req.session) {
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;

    // Check if session has expired
    if (now - lastActivity > SESSION_TIMEOUT) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
      });
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    // Update last activity timestamp
    req.session.lastActivity = now;
  }

  next();
};

// Middleware: Get client IP address
// Handles proxies and multiple IP formats
exports.getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Middleware: Refresh user session data
exports.refreshUserSession = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.isActive) {
        req.user = user;
        return next();
      } else {
        // User deactivated or deleted
        req.session.destroy();
        return res.status(401).json({ error: 'User account no longer active' });
      }
    }
    next();
  } catch (error) {
    console.error('Session refresh error:', error);
    next();
  }
};

// Create a session for authenticated user
exports.createSession = (req, userId, mfaVerified = false) => {
  req.session.userId = userId;
  req.session.mfaVerified = mfaVerified;
  req.session.lastActivity = Date.now();
  req.session.createdAt = Date.now();
};

// Logout: Destroy session
exports.destroySession = (req) => {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

/**
 * NIST SP 800-63-2 Compliance Notes:
 *
 * 1. Session Management:
 *    - Sessions are server-side (express-session)
 *    - Session timeout enforced (default 1 hour)
 *    - HTTPS/TLS required in production (enforce in app.js)
 *    - Secure session cookies with httpOnly flag
 *
 * 2. Credential Issuance:
 *    - Passwords hashed with bcrypt (per-user salt, cost 12)
 *    - MFA required for all users
 *    - OTP expires after 5 minutes
 *
 * 3. Identity Proofing:
 *    - Email verification (sendMFA)
 *    - Username/email uniqueness enforced at DB level
 *    - User registration requires valid email
 *
 * 4. Protected Session:
 *    - Session ID randomized by express-session
 *    - Marked secure, httpOnly in production
 *    - Regenerated after login (CSRF protection)
 *    - Destroyed on logout
 */
