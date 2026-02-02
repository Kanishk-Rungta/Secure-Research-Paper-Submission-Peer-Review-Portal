const mongoose = require('mongoose');

/**
 * Paper Model
 * Represents a research paper submitted by an Author
 * File storage: encrypted with AES-256, key encrypted with RSA-2048
 */

const paperSchema = new mongoose.Schema(
  {
    // Paper Metadata
    title: {
      type: String,
      required: true,
      trim: true,
    },
    abstractText: {
      type: String,
      required: true,
    },
    keywords: {
      type: [String],
      default: [],
    },

    // File Storage (Encrypted)
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    // Base64-encoded encrypted PDF content
    encryptedData: {
      type: String,
      required: true,
    },
    // IV for AES decryption (stored as Base64)
    encryptedIV: {
      type: String,
      required: true,
    },
    // RSA-encrypted AES key (stored as Base64)
    encryptedAESKey: {
      type: String,
      required: true,
    },
    // SHA-256 hash of original file for integrity check
    fileHash: {
      type: String,
      required: true,
    },

    // Author Information
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorEmail: {
      type: String,
      required: true,
    },

    // Review Process
    status: {
      type: String,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED'],
      default: 'SUBMITTED',
    },
    assignedReviewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Decision (populated by Editor)
    finalDecision: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Decision',
      default: null,
    },

    // Submission Timeline
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    reviewDeadline: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster queries
paperSchema.index({ authorId: 1 });
paperSchema.index({ status: 1 });

module.exports = mongoose.model('Paper', paperSchema);
