const Decision = require('../models/Decision');
const Paper = require('../models/Paper');
const Review = require('../models/Review');
const cryptoService = require('../services/cryptoService');
const emailService = require('../services/emailService');
const auditService = require('../services/auditService');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');

/**
 * Decision Controller
 * Handles final editorial decisions
 * Decisions are digitally signed using RSA-PSS (non-repudiation)
 */

const keyDir = path.join(__dirname, '../keys');
const privateKeyPath = path.join(keyDir, 'private.pem');
const publicKeyPath = path.join(keyDir, 'public.pem');

/**
 * Create/Update final decision for a paper
 * Only Editor can create decisions
 * Digitally signs the decision using RSA-PSS
 * This ensures non-repudiation: Editor cannot deny making the decision
 */
exports.makeDecision = async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);
    const { decision, summary } = req.body;

    // Input validation
    if (!decision || !summary) {
      return res.status(400).json({ error: 'Decision and summary required' });
    }

    if (!['ACCEPTED', 'REJECTED', 'REVISION_REQUESTED'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision type' });
    }

    if (summary.length < 50) {
      return res.status(400).json({ error: 'Summary must be at least 50 characters' });
    }

    // Get paper and reviews
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const reviews = await Review.find({ paperId: paperId });

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      averageRating = (totalRating / reviews.length).toFixed(2);
    }

    // Create review summary
    const reviewsSummary = reviews
      .map(
        (r) =>
          `Reviewer: ${r.reviewerEmail}, Rating: ${r.rating}/5, Recommendation: ${r.recommendation}`
      )
      .join('\n');

    // Create decision document
    const decisionData = {
      paperId: paperId,
      decision: decision,
      summary: summary.trim(),
      editorId: userId,
      editorEmail: req.user.email,
      reviewsSummary: reviewsSummary,
      averageRating: averageRating,
      decidedAt: new Date(),
    };

    // DIGITAL SIGNATURE PROCESS:
    // Create a deterministic string representation of decision data
    const dataToSign = JSON.stringify({
      paperId: paperId,
      decision: decision,
      summary: summary,
      decidedAt: new Date().toISOString(),
    });

    try {
      // Sign decision using RSA-PSS with SHA-256
      // RSA-PSS is more secure than PKCS#1 v1.5 padding
      const signature = cryptoService.signData(Buffer.from(dataToSign), privateKeyPath);

      decisionData.signature = signature;
      decisionData.signatureAlgorithm = 'RSA-PSS with SHA-256';

      // Check if decision already exists
      let finalDecision = await Decision.findOne({ paperId: paperId });

      if (finalDecision) {
        // Update existing decision
        finalDecision = await Decision.findByIdAndUpdate(
          finalDecision._id,
          decisionData,
          { new: true }
        );
      } else {
        // Create new decision
        finalDecision = new Decision(decisionData);
        await finalDecision.save();
      }

      // Update paper status and link decision
      paper.status = decision === 'ACCEPTED' ? 'ACCEPTED' : decision === 'REJECTED' ? 'REJECTED' : 'REVISION_REQUESTED';
      paper.finalDecision = finalDecision._id;
      await paper.save();

      // Log decision creation
      await auditService.logDecision(userId, paperId, decision, clientIP);

      // Send notification email to author
      await emailService.sendDecisionNotification(paper.authorEmail, paper.title, decision);

      res.status(201).json({
        message: 'Decision recorded and digitally signed',
        decisionId: finalDecision._id,
        signature: signature,
        signatureAlgorithm: 'RSA-PSS with SHA-256',
      });
    } catch (signError) {
      console.error('Digital signature error:', signError);
      res.status(500).json({ error: 'Failed to digitally sign decision' });
    }
  } catch (error) {
    console.error('Make decision error:', error);
    res.status(500).json({ error: 'Failed to create decision' });
  }
};

/**
 * Get decision for a paper
 * Authors can view their own decisions
 * Editors can view all decisions
 */
exports.getDecision = async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const userId = req.session.userId;
    const user = req.user;

    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const decision = await Decision.findOne({ paperId: paperId }).populate('editorId', 'fullName email');

    if (!decision) {
      return res.status(404).json({ error: 'No decision yet for this paper' });
    }

    // ACL: Authors can only view their own, Editors can view all
    if (user.role === 'Author' && paper.authorId.toString() !== userId.toString()) {
      await auditService.logAccessDenied(userId, 'DECISION_VIEW', decision._id, authMiddleware.getClientIP(req), 'Not author');
      return res.status(403).json({ error: 'Access denied' });
    }

    res.status(200).json({ decision: decision });
  } catch (error) {
    console.error('Get decision error:', error);
    res.status(500).json({ error: 'Failed to get decision' });
  }
};

/**
 * Verify digital signature of a decision
 * Confirms that the decision was signed by an Editor
 * This ensures authenticity and non-repudiation
 */
exports.verifyDecisionSignature = async (req, res) => {
  try {
    const decisionId = req.params.decisionId;

    const decision = await Decision.findById(decisionId);
    if (!decision) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    // Reconstruct the data that was signed
    const dataToVerify = JSON.stringify({
      paperId: decision.paperId.toString(),
      decision: decision.decision,
      summary: decision.summary,
      decidedAt: new Date(decision.decidedAt).toISOString(),
    });

    // Verify signature using RSA-PSS public key
    const isValid = cryptoService.verifySignature(
      Buffer.from(dataToVerify),
      decision.signature,
      publicKeyPath
    );

    res.status(200).json({
      decisionId: decisionId,
      isSignatureValid: isValid,
      signatureAlgorithm: decision.signatureAlgorithm,
      signedBy: decision.editorId,
      signedAt: decision.decidedAt,
    });
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(500).json({ error: 'Failed to verify signature' });
  }
};

/**
 * List all decisions (Editor only)
 */
exports.listDecisions = async (req, res) => {
  try {
    const decisions = await Decision.find()
      .populate('paperId', 'title')
      .populate('editorId', 'fullName email')
      .sort({ decidedAt: -1 });

    res.status(200).json({ decisions: decisions });
  } catch (error) {
    console.error('List decisions error:', error);
    res.status(500).json({ error: 'Failed to list decisions' });
  }
};
