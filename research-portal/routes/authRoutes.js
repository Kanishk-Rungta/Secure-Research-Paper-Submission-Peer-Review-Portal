const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Authentication Routes
 * Public endpoints for registration and login
 * Protected endpoints for user operations
 */

// Public endpoints (no authentication required)

/**
 * POST /auth/register
 * Register a new user
 * Body: { fullName, username, email, password, confirmPassword, role, institution }
 */
router.post('/register', (req, res, next) => {
  // Apply session timeout check even for public routes
  authMiddleware.checkSessionTimeout(req, res, next);
}, authController.register);

/**
 * POST /auth/login
 * Step 1: Send OTP to email
 * Body: { username (email or username), password }
 */
router.post('/login', (req, res, next) => {
  authMiddleware.checkSessionTimeout(req, res, next);
}, authController.login);

/**
 * POST /auth/verify-otp
 * Step 2: Verify OTP and complete authentication
 * Body: { otp }
 * Requires: active session from /login
 */
router.post('/verify-otp', (req, res, next) => {
  authMiddleware.checkSessionTimeout(req, res, next);
}, authController.verifyOTP);

/**
 * POST /auth/resend-otp
 * Resend OTP if user didn't receive it
 * Requires: active session from /login
 */
router.post('/resend-otp', (req, res, next) => {
  authMiddleware.checkSessionTimeout(req, res, next);
}, authController.resendOTP);

// Protected endpoints (authentication required)

/**
 * POST /auth/logout
 * Logout and destroy session
 * Requires: authenticated session with MFA verified
 */
router.post(
  '/logout',
  authMiddleware.checkSessionTimeout,
  authMiddleware.isAuthenticated,
  authController.logout
);

/**
 * GET /auth/me
 * Get current authenticated user's information
 * Requires: authenticated session with MFA verified
 */
router.get(
  '/me',
  authMiddleware.checkSessionTimeout,
  authMiddleware.isAuthenticated,
  authMiddleware.refreshUserSession,
  authController.getCurrentUser
);

module.exports = router;
