const mongoose = require('mongoose');

/**
 * Review Model
 * Represents a peer review written by a Reviewer for a Paper
 */

const reviewSchema = new mongoose.Schema(
  {
    // Paper being reviewed
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Paper',
      required: true,
    },

    // Reviewer information
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerEmail: {
      type: String,
      required: true,
    },

    // Review Content
    summary: {
      type: String,
      required: true,
      minlength: 50,
      maxlength: 10000,
    },
    strengths: {
      type: String,
      default: '',
    },
    weaknesses: {
      type: String,
      default: '',
    },
    suggestions: {
      type: String,
      default: '',
    },

    // Rating (1-5 scale)
    rating: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
      required: true,
    },

    // Recommendation
    recommendation: {
      type: String,
      enum: ['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT'],
      required: true,
    },

    // Review Status
    status: {
      type: String,
      enum: ['PENDING', 'SUBMITTED', 'COMPLETED'],
      default: 'PENDING',
    },
    submittedAt: {
      type: Date,
      default: null,
    },

    // Confidentiality
    isConfidential: {
      type: Boolean,
      default: false,
    },

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
reviewSchema.index({ paperId: 1 });
reviewSchema.index({ reviewerId: 1 });

module.exports = mongoose.model('Review', reviewSchema);
