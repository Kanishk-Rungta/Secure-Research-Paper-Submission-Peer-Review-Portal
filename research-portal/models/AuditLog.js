const mongoose = require('mongoose');

/**
 * Audit Log Model
 * Comprehensive logging per NIST SP 800-63-2 requirements
 * Tracks all security-relevant events
 */

const auditLogSchema = new mongoose.Schema(
  {
    // Actor
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // May be null for pre-authentication events
    },

    // Action
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'USER_REGISTRATION',
        'MFA_VERIFIED',
        'MFA_FAILED',
        'FILE_UPLOAD',
        'FILE_DOWNLOAD',
        'ACCESS_DENIED',
        'REVIEW_SUBMITTED',
        'DECISION_MADE',
        'PAPER_SUBMITTED',
        'LOGOUT',
        'SESSION_EXPIRED',
      ],
    },

    // Resource
    resource: {
      type: String,
      default: null, // Paper ID, email, file name, etc.
    },

    // Outcome
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      required: true,
    },

    // Context
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      required: true,
    },

    // Timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false } // We use explicit timestamp field
);

// Create TTL index: keep logs for 1 year, then auto-delete
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
