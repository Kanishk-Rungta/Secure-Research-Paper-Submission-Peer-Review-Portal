const express = require('express');
const router = express.Router();
const multer = require('multer');
const paperController = require('../controllers/paperController');
const reviewController = require('../controllers/reviewController');
const decisionController = require('../controllers/decisionController');
const authMiddleware = require('../middleware/authMiddleware');
const aclMiddleware = require('../middleware/aclMiddleware');

/**
 * Protected Routes Middleware
 * All routes require authentication and MFA verification
 */
router.use(authMiddleware.checkSessionTimeout);
router.use(authMiddleware.isAuthenticated);
router.use(authMiddleware.refreshUserSession);

/**
 * Configure multer for file uploads
 * Stores file in memory (no disk storage)
 * Validates file type and size
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// ==================== PAPER ROUTES ====================

/**
 * POST /papers
 * Submit a new research paper
 * Required: PDF file, title, abstract
 * Only Authors can submit papers
 * File encrypted with AES-256-CBC + RSA-2048 before storage
 */
router.post('/', aclMiddleware.requireAuthor, upload.single('paper'), paperController.submitPaper);

/**
 * GET /papers
 * List papers accessible to current user
 * Authors see their own, Reviewers see assigned, Editors see all
 * ACL enforced per role
 */
router.get('/', paperController.listPapers);

/**
 * GET /papers/:paperId
 * Get paper details
 * ACL enforced: Authors (own only), Reviewers (assigned), Editors (all)
 */
router.get('/:paperId', aclMiddleware.canAccessPaper, paperController.getPaper);

/**
 * GET /papers/:paperId/download
 * Download and decrypt paper file
 * File decrypted using RSA-2048 private key and AES-256-CBC
 * Integrity verified using SHA-256 hash
 * Logs file access for audit trail
 */
router.get(
  '/:paperId/download',
  aclMiddleware.canAccessPaper,
  paperController.downloadPaper
);

/**
 * PUT /papers/:paperId/status
 * Update paper status and assign reviewers
 * Only Editor can perform this action
 */
router.put(
  '/:paperId/status',
  aclMiddleware.canAccessPaper,
  aclMiddleware.requireEditor,
  paperController.updatePaperStatus
);

/**
 * GET /papers/:paperId/with-reviews
 * Get paper with all reviews (Editor only)
 */
router.get(
  '/:paperId/with-reviews',
  aclMiddleware.canAccessPaper,
  aclMiddleware.requireEditor,
  paperController.getPaperWithReviews
);

// ==================== REVIEW ROUTES ====================

/**
 * POST /reviews/:paperId
 * Submit a peer review
 * Only assigned Reviewers can submit
 */
router.post('/:paperId/reviews', aclMiddleware.requireReviewer, reviewController.submitReview);

/**
 * GET /reviews/my
 * Get current reviewer's reviews
 * Only Reviewers
 */
router.get('/reviews/my', aclMiddleware.requireReviewer, reviewController.getMyReviews);

/**
 * GET /papers/:paperId/reviews
 * Get all reviews for a paper
 * Only Editor can view all reviews
 */
router.get(
  '/:paperId/reviews',
  aclMiddleware.canAccessPaper,
  aclMiddleware.requireEditor,
  reviewController.getReviewsForPaper
);

/**
 * GET /reviews/:reviewId
 * Get a specific review
 * ACL: Reviewers can view their own, Editors can view all
 */
router.get(
  '/reviews/:reviewId',
  aclMiddleware.canAccessReview,
  reviewController.getReview
);

// ==================== DECISION ROUTES ====================

/**
 * POST /papers/:paperId/decision
 * Make final editorial decision
 * Only Editor can create decisions
 * Decision is digitally signed using RSA-PSS (non-repudiation)
 */
router.post(
  '/:paperId/decision',
  aclMiddleware.canAccessPaper,
  aclMiddleware.requireEditor,
  decisionController.makeDecision
);

/**
 * GET /papers/:paperId/decision
 * Get final decision for a paper
 * ACL: Authors (own only), Editors (all)
 */
router.get('/:paperId/decision', aclMiddleware.canAccessPaper, decisionController.getDecision);

/**
 * GET /decisions/:decisionId/verify
 * Verify digital signature of decision
 * Confirms decision authenticity and editor identity
 */
router.get(
  '/:decisionId/verify-signature',
  aclMiddleware.canAccessDecision,
  decisionController.verifyDecisionSignature
);

/**
 * GET /decisions
 * List all decisions (Editor only)
 */
router.get('/list-all', aclMiddleware.requireEditor, decisionController.listDecisions);

module.exports = router;
