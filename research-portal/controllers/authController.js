const User = require('../models/User');
const cryptoService = require('../services/cryptoService');
const emailService = require('../services/emailService');
const auditService = require('../services/auditService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Authentication Controller
 * Implements NIST SP 800-63-2 compliant authentication flow
 */

/**
 * Register a new user
 * Input validation: username, email, password strength
 * Password: bcrypt with per-user salt (cost 12)
 * Email: OTP verification required
 */
exports.register = async (req, res) => {
  try {
    const { fullName, username, email, password, confirmPassword, role, institution } = req.body;
    const clientIP = authMiddleware.getClientIP(req);

    // Input validation
    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prevent injection attacks
    if (!/^[a-zA-Z\s'-]{2,}$/i.test(fullName)) {
      return res.status(400).json({ error: 'Invalid full name' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) {
      return res.status(400).json({ error: 'Username must be 3+ characters (alphanumeric, _, -)' });
    }

    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password strength validation (NIST-inspired)
    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Validate role
    if (!['Author', 'Reviewer', 'Editor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email: email }, { username: username }] });
    if (existingUser) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    // Hash password with bcrypt (per-user salt, cost 12)
    const passwordHash = await cryptoService.hashPassword(password);

    // Do NOT persist user until email OTP is verified.
    // Store pending registration in session for verification step.
    const otp = cryptoService.generateOTP();
    const pending = {
      fullName: fullName.trim(),
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash: passwordHash,
      role: role,
      institution: institution || '',
      otpCode: otp,
      otpExpiry: new Date(Date.now() + parseInt(process.env.OTP_EXPIRY || 300000)),
    };

    // Save pending registration in session (server-side store)
    req.session.pendingRegistration = pending;

    // Pending registration stored in session; will be logged after verification

    // Send OTP for email verification
    await emailService.sendOTP(email, otp, fullName);

    res.status(200).json({
      message: 'Registration initiated. OTP sent to email. Please verify to complete registration.',
      email: email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Login with email/username + password
 * Step 1 of MFA flow
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIP = authMiddleware.getClientIP(req);

    if (!username || !password) {
      await auditService.logAuthAttempt(username, false, clientIP, 'Missing credentials');
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: username.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (!user) {
      // Don't reveal whether user exists (prevent user enumeration)
      await auditService.logAuthAttempt(username, false, clientIP, 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password using bcrypt
    const isPasswordValid = await cryptoService.comparePassword(password, user.passwordHash);

    if (!isPasswordValid) {
      await auditService.logAuthAttempt(user.email, false, clientIP, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      await auditService.logAuthAttempt(user.email, false, clientIP, 'Account inactive');
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Generate OTP for MFA
    const otp = cryptoService.generateOTP();
    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY || 300000)); // 5 minutes
    await user.save();

    // Send OTP via email
    const emailSent = await emailService.sendOTP(user.email, otp, user.fullName);

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }

    // Create temporary session (for OTP verification only)
    authMiddleware.createSession(req, user._id, false); // mfaVerified = false

    res.status(200).json({
      message: 'OTP sent to email. Please verify to complete login.',
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Verify OTP and complete authentication
 * Step 2 of MFA flow
 * After this, user has full access (mfaVerified = true)
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);

    if (!otp) {
      return res.status(400).json({ error: 'OTP required' });
    }

    // Handle pending registration (user not yet persisted)
    if (!userId && req.session.pendingRegistration) {
      const pending = req.session.pendingRegistration;

      // Validate OTP format
      if (!/^\d{6}$/.test(otp.toString())) {
        return res.status(400).json({ error: 'OTP must be 6 digits' });
      }

      if (pending.otpCode !== otp) {
        await auditService.logMFAVerification(null, pending.email, false, clientIP);
        return res.status(401).json({ error: 'Invalid OTP' });
      }

      if (new Date() > new Date(pending.otpExpiry)) {
        await auditService.logMFAVerification(null, pending.email, false, clientIP);
        return res.status(401).json({ error: 'OTP expired. Please register again.' });
      }

      // Create persistent user now that OTP is verified
      const newUser = new User({
        fullName: pending.fullName,
        username: pending.username,
        email: pending.email,
        passwordHash: pending.passwordHash,
        role: pending.role,
        institution: pending.institution,
        isEmailVerified: true,
        mfaEnabled: true,
      });

      await newUser.save();

      // Clear pending registration from session
      delete req.session.pendingRegistration;

      // Establish authenticated session
      req.session.userId = newUser._id;
      req.session.mfaVerified = true;

      // Log successful registration and MFA
      await auditService.logRegistration(newUser._id, newUser.email, clientIP);
      await auditService.logMFAVerification(newUser._id, newUser.email, true, clientIP);

      return res.status(201).json({
        message: 'Registration complete. Account created and verified.',
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
        },
      });
    }

    // If not pending registration, expect normal login flow (requires session.userId)
    if (!userId) {
      return res.status(401).json({ error: 'Please login first' });
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp.toString())) {
      return res.status(400).json({ error: 'OTP must be 6 digits' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check OTP validity
    if (user.otpCode !== otp) {
      await auditService.logMFAVerification(userId, user.email, false, clientIP);
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Check OTP expiration (5 minutes)
    if (new Date() > user.otpExpiry) {
      await auditService.logMFAVerification(userId, user.email, false, clientIP);
      return res.status(401).json({ error: 'OTP expired. Please login again.' });
    }

    // Clear OTP after successful verification
    user.otpCode = null;
    user.otpExpiry = null;
    user.isEmailVerified = true;
    user.lastLogin = new Date();
    await user.save();

    // Complete session (MFA verified)
    req.session.mfaVerified = true;

    // Log successful authentication
    await auditService.logMFAVerification(userId, user.email, true, clientIP);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
};

/**
 * Logout: destroy session
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);

    if (userId) {
      const user = await User.findById(userId);
      await auditService.log(userId, 'LOGOUT', user?.email || 'unknown', 'SUCCESS', '', clientIP);
    }

    await authMiddleware.destroySession(req);

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

/**
 * Resend OTP (if user didn't receive the first one)
 */
exports.resendOTP = async (req, res) => {
  try {
    const userId = req.session.userId;

    // Support resending for pending registration stored in session
    if (!userId && req.session.pendingRegistration) {
      const pending = req.session.pendingRegistration;
      const otp = cryptoService.generateOTP();
      pending.otpCode = otp;
      pending.otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY || 300000));
      req.session.pendingRegistration = pending;

      const emailSent = await emailService.sendOTP(pending.email, otp, pending.fullName);
      if (!emailSent) return res.status(500).json({ error: 'Failed to send OTP' });
      return res.status(200).json({ message: 'OTP resent to email' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Please login first' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new OTP for existing user
    const otp = cryptoService.generateOTP();
    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + parseInt(process.env.OTP_EXPIRY || 300000));
    await user.save();

    // Send OTP
    const emailSent = await emailService.sendOTP(user.email, otp, user.fullName);

    if (!emailSent) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }

    res.status(200).json({ message: 'OTP resent to email' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
};

/**
 * Get current user info (protected)
 */
exports.getCurrentUser = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(req.session.userId).select('-passwordHash -otpCode');

    res.status(200).json({
      user: user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};
