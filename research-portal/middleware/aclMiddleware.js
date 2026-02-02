const Paper = require('../models/Paper');
const Review = require('../models/Review');
const Decision = require('../models/Decision');
const PaperAccess = require('../models/PaperAccess');
const auditService = require('../services/auditService');
const { getClientIP } = require('./authMiddleware');

/**
 * Access Control List (ACL) Middleware
 * Implements mandatory access control per specification:
 *
 * Protected Objects: Paper, Review, Final Decision
 *
 * Access Control Matrix:
 * ┌─────────┬──────────────┬──────────────┬────────────────┐
 * │  Role   │ Paper        │ Review       │ Final Decision │
 * ├─────────┼──────────────┼──────────────┼────────────────┤
 * │ Author  │ R/W own only │ Read only    │ Read only      │
 * │ Reviewer│ R assigned   │ W own only   │ None           │
 * │ Editor  │ R/W all      │ R all        │ R/W + Sign     │
 * └─────────┴──────────────┴──────────────┴────────────────┘
 *
 * This is enforced at EVERY route using these middleware functions.
 */

/**
 * Middleware: Check authorization for Paper access
 * Enforces role-based access to papers
 * Also checks PaperAccess database for additional permissions (e.g., editors granted access)
 */
exports.canAccessPaper = async (req, res, next) => {
  try {
    const paperId = req.params.paperId || req.body.paperId;
    const userId = req.session.userId;
    const user = req.user;

    if (!paperId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const paper = await Paper.findById(paperId);
    if (!paper) {
      await auditService.logAccessDenied(userId, 'PAPER_ACCESS', paperId, getClientIP(req), 'Paper not found');
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Access Control Matrix for Papers
    let hasAccess = false;

    if (user.role === 'Editor') {
      // Editors can read/write all papers
      hasAccess = true;
      req.accessLevel = 'full'; // Can read, write, manage
    } else if (user.role === 'Author') {
      // Authors can only read/write their own papers
      if (paper.authorId.toString() === userId.toString()) {
        hasAccess = true;
        req.accessLevel = 'owner'; // Can read, write own
      } else {
        // Check if author has been granted editor access via PaperAccess
        const access = await PaperAccess.findOne({
          paperId: paperId,
          userId: userId,
          accessLevel: 'editor',
          status: 'ACTIVE',
        });
        if (access) {
          hasAccess = true;
          req.accessLevel = 'editor'; // Granted editor access
        }
      }
    } else if (user.role === 'Reviewer') {
      // Reviewers can only read papers assigned to them
      if (paper.assignedReviewers.includes(userId)) {
        hasAccess = true;
        req.accessLevel = 'read'; // Can only read
      }
    }

    if (!hasAccess) {
      await auditService.logAccessDenied(
        userId,
        'PAPER_ACCESS',
        paperId,
        getClientIP(req),
        `User role (${user.role}) not authorized for this paper`
      );
      return res.status(403).json({ error: 'Access denied to this paper' });
    }

    req.paper = paper;
    next();
  } catch (error) {
    console.error('ACL check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Middleware: Check authorization for Review access
 */
exports.canAccessReview = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const userId = req.session.userId;
    const user = req.user;

    if (!reviewId) {
      return res.status(400).json({ error: 'Review ID required' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      await auditService.logAccessDenied(userId, 'REVIEW_ACCESS', reviewId, getClientIP(req), 'Review not found');
      return res.status(404).json({ error: 'Review not found' });
    }

    // Access Control Matrix for Reviews
    let hasAccess = false;

    if (user.role === 'Editor') {
      // Editors can read all reviews
      hasAccess = true;
      req.accessLevel = 'read'; // Can read all
    } else if (user.role === 'Reviewer') {
      // Reviewers can write their own reviews, cannot read others
      if (review.reviewerId.toString() === userId.toString()) {
        hasAccess = true;
        req.accessLevel = 'owner'; // Can read/write own
      }
    } else if (user.role === 'Author') {
      // Authors cannot access reviews (they're only visible through decisions)
      hasAccess = false;
    }

    if (!hasAccess) {
      await auditService.logAccessDenied(
        userId,
        'REVIEW_ACCESS',
        reviewId,
        getClientIP(req),
        `User role (${user.role}) not authorized for this review`
      );
      return res.status(403).json({ error: 'Access denied to this review' });
    }

    req.review = review;
    next();
  } catch (error) {
    console.error('ACL check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Middleware: Check authorization for Decision access
 */
exports.canAccessDecision = async (req, res, next) => {
  try {
    const decisionId = req.params.decisionId || req.body.decisionId;
    const paperId = req.params.paperId || req.body.paperId;
    const userId = req.session.userId;
    const user = req.user;

    let decision;
    if (decisionId) {
      decision = await Decision.findById(decisionId);
    } else if (paperId) {
      decision = await Decision.findOne({ paperId: paperId });
    }

    if (!decision) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    // Access Control Matrix for Decisions
    let hasAccess = false;

    if (user.role === 'Editor') {
      // Editors can read/write and sign all decisions
      hasAccess = true;
      req.accessLevel = 'full'; // Can read, write, sign
    } else if (user.role === 'Author') {
      // Authors can only read decisions on their own papers
      const paper = await Paper.findById(decision.paperId);
      if (paper && paper.authorId.toString() === userId.toString()) {
        hasAccess = true;
        req.accessLevel = 'read'; // Can only read own decision
      }
    } else if (user.role === 'Reviewer') {
      // Reviewers cannot access decisions
      hasAccess = false;
    }

    if (!hasAccess) {
      await auditService.logAccessDenied(
        userId,
        'DECISION_ACCESS',
        decision._id,
        getClientIP(req),
        `User role (${user.role}) not authorized for this decision`
      );
      return res.status(403).json({ error: 'Access denied to this decision' });
    }

    req.decision = decision;
    next();
  } catch (error) {
    console.error('ACL check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Middleware: Check if user can modify a paper
 * Only Authors (own) and Editors can modify
 */
exports.canModifyPaper = (req, res, next) => {
  const user = req.user;
  const paper = req.paper;

  if (user.role === 'Editor') {
    return next(); // Editors can always modify
  }

  if (user.role === 'Author' && paper.authorId.toString() === user._id.toString()) {
    return next(); // Authors can modify their own
  }

  auditService.logAccessDenied(
    req.session.userId,
    'PAPER_MODIFY',
    paper._id,
    getClientIP(req),
    'Insufficient permissions to modify paper'
  );

  res.status(403).json({ error: 'Cannot modify this paper' });
};

/**
 * Middleware: Check if user is an Editor
 * Used for operations that ONLY editors can perform
 */
exports.requireEditor = (req, res, next) => {
  if (req.user && req.user.role === 'Editor') {
    return next();
  }

  auditService.logAccessDenied(
    req.session.userId,
    'EDITOR_OPERATION',
    '',
    getClientIP(req),
    'This operation requires Editor role'
  );

  res.status(403).json({ error: 'Editor role required' });
};

/**
 * Middleware: Check if user is a Reviewer
 */
exports.requireReviewer = (req, res, next) => {
  if (req.user && req.user.role === 'Reviewer') {
    return next();
  }

  auditService.logAccessDenied(
    req.session.userId,
    'REVIEWER_OPERATION',
    '',
    getClientIP(req),
    'This operation requires Reviewer role'
  );

  res.status(403).json({ error: 'Reviewer role required' });
};

/**
 * Middleware: Check if user is an Author
 */
exports.requireAuthor = (req, res, next) => {
  if (req.user && req.user.role === 'Author') {
    return next();
  }

  auditService.logAccessDenied(
    req.session.userId,
    'AUTHOR_OPERATION',
    '',
    getClientIP(req),
    'This operation requires Author role'
  );

  res.status(403).json({ error: 'Author role required' });
};
