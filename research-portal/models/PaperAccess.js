const mongoose = require('mongoose');

/**
 * PaperAccess Model
 * Tracks who has access to each paper and their access level
 * Access levels: owner (author), editor (can contribute), reviewer (read-only)
 */

const paperAccessSchema = new mongoose.Schema(
  {
    // Paper being accessed
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Paper',
      required: true,
    },

    // User with access
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Access Level
    // owner: Author, can read/write/modify paper
    // editor: Can contribute/edit the paper
    // reviewer: Can only read and provide reviews
    accessLevel: {
      type: String,
      enum: ['owner', 'editor', 'reviewer'],
      required: true,
    },

    // Access Status
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
    },

    // Granted by (user who gave access)
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Grant reason/notes
    grantReason: {
      type: String,
      default: '',
    },

    // Access grant date
    grantedAt: {
      type: Date,
      default: Date.now,
    },

    // Access expiry date (optional)
    expiresAt: {
      type: Date,
      default: null,
    },

    // Revocation info
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revocationReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Unique constraint: one access record per user per paper
paperAccessSchema.index({ paperId: 1, userId: 1 }, { unique: true });
paperAccessSchema.index({ paperId: 1 });
paperAccessSchema.index({ userId: 1 });
paperAccessSchema.index({ accessLevel: 1 });
paperAccessSchema.index({ status: 1 });

module.exports = mongoose.model('PaperAccess', paperAccessSchema);
