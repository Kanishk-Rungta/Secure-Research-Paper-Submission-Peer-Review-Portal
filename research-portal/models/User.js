const mongoose = require('mongoose');

/**
 * User Model
 * Stores user credentials, role, and MFA settings
 * Passwords are hashed with bcrypt (per-user salt, cost factor 12)
 */

const userSchema = new mongoose.Schema(
  {
    // Identity
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format'],
    },
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
    },

    // Authentication
    passwordHash: {
      type: String,
      required: true,
      // Hash should be ~60 chars for bcrypt
    },

    // Role-Based Access Control (RBAC)
    // Exactly three roles per specification
    role: {
      type: String,
      enum: ['Author', 'Reviewer', 'Editor'],
      required: true,
      default: 'Author',
    },

    // Multi-Factor Authentication
    mfaEnabled: {
      type: Boolean,
      default: true,
    },
    mfaSecret: {
      // Encrypted OTP secret or similar
      type: String,
      default: null,
    },
    otpCode: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
    },

    // Account Status
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Metadata
    institution: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);
