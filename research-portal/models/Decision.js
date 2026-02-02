const mongoose = require('mongoose');

/**
 * Decision Model
 * Represents the final editorial decision on a paper
 * Signed by Editor using RSA-PSS digital signature
 */

const decisionSchema = new mongoose.Schema(
  {
    // Paper
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Paper',
      required: true,
      unique: true,
    },

    // Decision Details
    decision: {
      type: String,
      enum: ['ACCEPTED', 'REJECTED', 'REVISION_REQUESTED'],
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },

    // Editor Information
    editorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    editorEmail: {
      type: String,
      required: true,
    },

    // Digital Signature (RSA-PSS)
    // Ensures non-repudiation: Editor cannot deny signing the decision
    signature: {
      type: String,
      required: true, // Base64-encoded RSA-PSS signature
    },
    signatureAlgorithm: {
      type: String,
      default: 'RSA-PSS with SHA-256',
    },

    // Supporting Reviews
    reviewsSummary: {
      type: String,
      default: '',
    },
    averageRating: {
      type: Number,
      default: 0,
    },

    // Timeline
    decidedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
decisionSchema.index({ paperId: 1 });
decisionSchema.index({ editorId: 1 });

module.exports = mongoose.model('Decision', decisionSchema);
