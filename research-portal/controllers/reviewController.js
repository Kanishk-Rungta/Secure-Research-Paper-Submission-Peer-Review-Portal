const Review = require('../models/Review');
const Paper = require('../models/Paper');
const auditService = require('../services/auditService');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * Review Controller
 * Handles review submission and retrieval
 */

/**
 * Submit a review for a paper
 * Only assigned reviewers can submit
 */
exports.submitReview = async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);
    const { summary, strengths, weaknesses, suggestions, rating, recommendation } = req.body;

    // Input validation
    if (!summary || !rating || !recommendation) {
      return res.status(400).json({ error: 'Summary, rating, and recommendation required' });
    }

    if (summary.length < 50) {
      return res.status(400).json({ error: 'Summary must be at least 50 characters' });
    }

    if (![1, 2, 3, 4, 5].includes(parseInt(rating))) {
      return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    if (!['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT'].includes(recommendation)) {
      return res.status(400).json({ error: 'Invalid recommendation' });
    }

    // Check if paper exists
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Check if user is assigned to review this paper
    if (!paper.assignedReviewers.includes(userId)) {
      await auditService.logAccessDenied(userId, 'REVIEW_SUBMIT', paperId, clientIP, 'Not assigned reviewer');
      return res.status(403).json({ error: 'You are not assigned to review this paper' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ paperId: paperId, reviewerId: userId });
    if (existingReview && existingReview.status === 'COMPLETED') {
      return res.status(409).json({ error: 'You have already submitted a review for this paper' });
    }

    // Create or update review
    const review = existingReview || new Review({ paperId: paperId, reviewerId: userId });

    review.summary = summary.trim();
    review.strengths = strengths?.trim() || '';
    review.weaknesses = weaknesses?.trim() || '';
    review.suggestions = suggestions?.trim() || '';
    review.rating = parseInt(rating);
    review.recommendation = recommendation;
    review.status = 'COMPLETED';
    review.submittedAt = new Date();
    review.reviewerEmail = req.user.email;

    await review.save();

    // Log review submission
    await auditService.logReviewSubmission(userId, paperId, review._id, clientIP);

    res.status(201).json({
      message: 'Review submitted successfully',
      reviewId: review._id,
    });
  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({ error: 'Review submission failed' });
  }
};

/**
 * Get all reviews for a paper (Editor only)
 */
exports.getReviewsForPaper = async (req, res) => {
  try {
    const paperId = req.params.paperId;

    const reviews = await Review.find({ paperId: paperId })
      .populate('reviewerId', 'fullName email')
      .sort({ submittedAt: -1 });

    if (!reviews.length) {
      return res.status(200).json({ reviews: [], message: 'No reviews yet' });
    }

    res.status(200).json({ reviews: reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
};

/**
 * Get reviewer's own reviews
 */
exports.getMyReviews = async (req, res) => {
  try {
    const userId = req.session.userId;

    const reviews = await Review.find({ reviewerId: userId })
      .populate('paperId', 'title')
      .sort({ submittedAt: -1 });

    res.status(200).json({ reviews: reviews });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
};

/**
 * Get a specific review
 * Reviewers can only see their own, Editors can see all
 */
exports.getReview = async (req, res) => {
  try {
    const reviewId = req.params.reviewId;
    const userId = req.session.userId;
    const user = req.user;

    const review = await Review.findById(reviewId)
      .populate('reviewerId', 'fullName email')
      .populate('paperId', 'title');

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // ACL check
    if (user.role !== 'Editor' && review.reviewerId.toString() !== userId.toString()) {
      await auditService.logAccessDenied(userId, 'REVIEW_VIEW', reviewId, authMiddleware.getClientIP(req), 'Not authorized');
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({ review: review });
  } catch (error) {
    console.error('Get review error:', error);
    res.status(500).json({ error: 'Failed to get review' });
  }
};
