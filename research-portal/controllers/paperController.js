const Paper = require('../models/Paper');
const Review = require('../models/Review');
const Decision = require('../models/Decision');
const PaperAccess = require('../models/PaperAccess');
const cryptoService = require('../services/cryptoService');
const auditService = require('../services/auditService');
const authMiddleware = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');

/**
 * Paper Controller
 * Handles paper uploads, downloads, and submissions
 * Implements hybrid encryption: AES-256-CBC + RSA-2048
 */

const keyDir = path.join(__dirname, '../keys');
const publicKeyPath = path.join(keyDir, 'public.pem');
const privateKeyPath = path.join(keyDir, 'private.pem');

/**
 * Submit a new paper
 * File encrypted with hybrid encryption before storage
 */
exports.submitPaper = async (req, res) => {
  try {
    const { title, abstractText, keywords } = req.body;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);

    // Input validation
    if (!title || !abstractText || !req.file) {
      return res.status(400).json({ error: 'Title, abstract, and file required' });
    }

    if (title.length < 10 || title.length > 500) {
      return res.status(400).json({ error: 'Title must be 10-500 characters' });
    }

    if (abstractText.length < 100 || abstractText.length > 5000) {
      return res.status(400).json({ error: 'Abstract must be 100-5000 characters' });
    }

    // Validate file type (PDF only)
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Validate file size (max 50MB)
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size must not exceed 50MB' });
    }

    const user = await req.session.userId;

    // ENCRYPTION PROCESS:
    // 1. Read file content
    const fileBuffer = req.file.buffer;

    // 2. Encrypt file using hybrid encryption
    // - Generate AES-256 key and IV
    // - Encrypt file with AES
    // - Encrypt AES key with RSA public key
    const encryptedPackage = cryptoService.encryptFile(fileBuffer, publicKeyPath);

    // 3. Create paper document
    const newPaper = new Paper({
      title: title.trim(),
      abstractText: abstractText.trim(),
      keywords: keywords ? keywords.split(',').map((k) => k.trim()) : [],
      fileName: req.file.originalname,
      fileSize: req.file.size,
      // Store encrypted components
      encryptedData: encryptedPackage.encryptedData,
      encryptedIV: encryptedPackage.iv,
      encryptedAESKey: encryptedPackage.encryptedKey,
      fileHash: encryptedPackage.hash,
      // Author info
      authorId: userId,
      authorEmail: req.user.email,
      status: 'SUBMITTED',
    });

    await newPaper.save();

    // Create PaperAccess entry for the author (owner)
    const paperAccess = new PaperAccess({
      paperId: newPaper._id,
      userId: userId,
      accessLevel: 'owner',
      status: 'ACTIVE',
      grantedBy: userId,
      grantReason: 'Author - paper owner',
    });
    await paperAccess.save();

    // Log file upload
    await auditService.logFileUpload(userId, newPaper._id, req.file.originalname, req.file.size, clientIP);

    res.status(201).json({
      message: 'Paper submitted successfully',
      paperId: newPaper._id,
      paper: {
        id: newPaper._id,
        title: newPaper.title,
        status: newPaper.status,
        submittedAt: newPaper.submittedAt,
      },
    });
  } catch (error) {
    console.error('Paper submission error:', error);
    res.status(500).json({ error: 'Paper submission failed' });
  }
};

/**
 * Get paper details (with encrypted file blob)
 * ACL enforced at route level
 */
exports.getPaper = async (req, res) => {
  try {
    const paperId = req.params.paperId;

    const paper = await Paper.findById(paperId)
      .select('-encryptedData -encryptedAESKey -encryptedIV -fileHash')
      .populate('authorId', 'fullName email institution')
      .populate('assignedReviewers', 'fullName email')
      .populate('finalDecision');

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    res.status(200).json({
      paper: paper,
    });
  } catch (error) {
    console.error('Get paper error:', error);
    res.status(500).json({ error: 'Failed to get paper' });
  }
};

/**
 * Download paper file (with decryption)
 * Requires access permission and decrypts file on-the-fly
 * Logs file access for audit trail
 */
exports.downloadPaper = async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);

    const paper = await Paper.findById(paperId);

    if (!paper) {
      await auditService.logAccessDenied(userId, 'FILE_DOWNLOAD', paperId, clientIP, 'Paper not found');
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Prepare encrypted package for decryption
    const encryptedPackage = {
      encryptedData: paper.encryptedData,
      iv: paper.encryptedIV,
      encryptedKey: paper.encryptedAESKey,
      hash: paper.fileHash,
    };

    try {
      // DECRYPTION PROCESS:
      // 1. Decrypt AES key using RSA private key
      // 2. Decrypt file using AES key and IV
      // 3. Verify SHA-256 hash
      const decryptedPackage = cryptoService.decryptFile(encryptedPackage, privateKeyPath);

      if (!decryptedPackage.hashVerified) {
        console.warn(`Hash mismatch for paper ${paperId}: file may be corrupted`);
        await auditService.logAccessDenied(userId, 'FILE_DOWNLOAD', paperId, clientIP, 'Hash verification failed');
        return res.status(400).json({
          error: 'File integrity check failed. File may be corrupted.',
        });
      }

      // Log successful file download
      await auditService.logFileDownload(userId, paperId, paper.fileName, clientIP);

      // Send decrypted file to client
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${paper.fileName}"`);
      res.send(decryptedPackage.data);
    } catch (decryptError) {
      console.error('File decryption error:', decryptError);
      await auditService.logAccessDenied(userId, 'FILE_DOWNLOAD', paperId, clientIP, 'Decryption failed');
      res.status(500).json({ error: 'Failed to decrypt file' });
    }
  } catch (error) {
    console.error('Download paper error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
};

/**
 * List papers accessible to current user
 * ACL enforced: Authors see only their papers and papers they have access to,
 * Reviewers see assigned papers, Editors see all
 */
exports.listPapers = async (req, res) => {
  try {
    console.log('[listPapers] Starting...');
    const userId = req.session.userId;
    const user = req.user;
    
    // Safety check: ensure user is loaded
    if (!user || !userId) {
      console.error('[listPapers] User not loaded: user=', !!user, 'userId=', !!userId);
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!user.role) {
      console.error('[listPapers] User has no role:', user);
      return res.status(400).json({ error: 'Invalid user data' });
    }
    
    console.log('[listPapers] User role:', user.role);
    let query = {};

    if (user.role === 'Author') {
      // Authors see their own papers
      query = { authorId: userId };
      console.log('[listPapers] Author query');
    } else if (user.role === 'Reviewer') {
      // Reviewers should be able to see all papers per updated requirement
      query = {}; // all papers
      console.log('[listPapers] Reviewer query - all papers');
    } else if (user.role === 'Editor') {
      // Editors should NOT see all papers automatically.
      // Editors only see papers they have been granted editor access to (PaperAccess)
      console.log('[listPapers] Editor - fetching editor access records...');
      const accessRecords = await PaperAccess.find({
        userId: userId,
        accessLevel: 'editor',
        status: 'ACTIVE',
      }).select('paperId');

      const accessPaperIds = accessRecords.map(a => a.paperId.toString());
      console.log('[listPapers] Editor has access to', accessPaperIds.length, 'papers');
      
      if (accessPaperIds.length > 0) {
        query = { _id: { $in: accessPaperIds } };
      } else {
        // No access records - return empty set
        query = { _id: { $in: [] } };
      }
    }

    console.log('[listPapers] Fetching papers with query...');
    let papers = await Paper.find(query)
      .select('-encryptedData -encryptedAESKey -encryptedIV -fileHash')
      .populate('authorId', 'fullName email institution')
      .populate('assignedReviewers', 'fullName email')
      .sort({ submittedAt: -1 });
    
    console.log('[listPapers] Found', papers.length, 'papers');

    // For Authors, also get papers they have editor access to (so they can collaborate)
    if (user.role === 'Author') {
      console.log('[listPapers] Author - fetching editor access papers...');
      const accessRecords = await PaperAccess.find({
        userId: userId,
        accessLevel: 'editor',
        status: 'ACTIVE',
      }).select('paperId');

      const accessPaperIds = accessRecords.map(a => a.paperId.toString());
      console.log('[listPapers] Author has editor access to', accessPaperIds.length, 'papers');

      if (accessPaperIds.length > 0) {
        const accessPapers = await Paper.find({
          _id: { $in: accessPaperIds },
          authorId: { $ne: userId }, // Don't duplicate own papers
        })
          .select('-encryptedData -encryptedAESKey -encryptedIV -fileHash')
          .populate('authorId', 'fullName email institution')
          .populate('assignedReviewers', 'fullName email')
          .sort({ submittedAt: -1 });

        papers.push(...accessPapers);
      }
    }

    console.log('[listPapers] Returning', papers.length, 'papers');
    res.status(200).json({
      papers: papers,
      count: papers.length,
    });
  } catch (error) {
    console.error('[listPapers] Error:', error);
    res.status(500).json({ error: 'Failed to list papers: ' + error.message });
  }
};

/**
 * Update paper status (Editor only)
 */
exports.updatePaperStatus = async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const { status, assignedReviewers } = req.body;

    // Validate status
    if (!['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const paper = await Paper.findByIdAndUpdate(
      paperId,
      { status: status, assignedReviewers: assignedReviewers || [] },
      { new: true }
    );

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Create PaperAccess records for newly assigned reviewers
    if (assignedReviewers && assignedReviewers.length > 0) {
      for (const reviewerId of assignedReviewers) {
        // Check if access already exists
        const existingAccess = await PaperAccess.findOne({
          paperId: paperId,
          userId: reviewerId,
        });

        if (!existingAccess) {
          // Create new access record for reviewer
          const reviewerAccess = new PaperAccess({
            paperId: paperId,
            userId: reviewerId,
            accessLevel: 'reviewer',
            status: 'ACTIVE',
            grantedBy: req.session.userId,
            grantReason: 'Assigned as reviewer',
          });
          await reviewerAccess.save();
        }
      }
    }

    await auditService.log(
      req.session.userId,
      'PAPER_STATUS_UPDATE',
      paperId,
      'SUCCESS',
      `Status changed to ${status}`,
      authMiddleware.getClientIP(req)
    );

    res.status(200).json({
      message: 'Paper status updated',
      paper: paper,
    });
  } catch (error) {
    console.error('Update paper status error:', error);
    res.status(500).json({ error: 'Failed to update paper' });
  }
};

/**
 * Get paper with reviews (Editors only)
 */
exports.getPaperWithReviews = async (req, res) => {
  try {
    const paperId = req.params.paperId;

    const paper = await Paper.findById(paperId)
      .select('-encryptedData')
      .populate('authorId', 'fullName email')
      .populate('assignedReviewers', 'fullName email');

    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    const reviews = await Review.find({ paperId: paperId }).select('-encryptedReview');

    res.status(200).json({
      paper: paper,
      reviews: reviews,
    });
  } catch (error) {
    console.error('Get paper with reviews error:', error);
    res.status(500).json({ error: 'Failed to get paper details' });
  }
};

/**
 * Grant editor access to a paper (Author only - for their own papers)
 * Allows authors to add editors who can contribute to the paper
 */
exports.grantEditorAccess = async (req, res) => {
  try {
    const PaperAccess = require('../models/PaperAccess');
    const User = require('../models/User');
    const paperId = req.params.paperId;
    const { editorEmail } = req.body;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);

    // Validate input
    if (!editorEmail || !editorEmail.trim()) {
      return res.status(400).json({ error: 'Editor email is required' });
    }

    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Verify the requester is the paper owner (Author)
    if (paper.authorId.toString() !== userId.toString()) {
      await auditService.logAccessDenied(
        userId,
        'GRANT_EDITOR_ACCESS',
        paperId,
        clientIP,
        'User is not the paper owner'
      );
      return res.status(403).json({ error: 'Only the paper author can grant editor access' });
    }

    // Find the editor user
    const editor = await User.findOne({ email: editorEmail.toLowerCase() });
    if (!editor) {
      return res.status(404).json({ error: 'Editor not found' });
    }

    // Prevent self-granting
    if (editor._id.toString() === userId.toString()) {
      return res.status(400).json({ error: 'You cannot grant access to yourself' });
    }

    // Check if access already exists
    const existingAccess = await PaperAccess.findOne({
      paperId: paperId,
      userId: editor._id,
    });

    if (existingAccess && existingAccess.status === 'ACTIVE') {
      return res.status(409).json({ error: 'This editor already has access to this paper' });
    }

    // Create or reactivate access record
    let paperAccess;
    if (existingAccess) {
      // Reactivate revoked access
      paperAccess = await PaperAccess.findByIdAndUpdate(
        existingAccess._id,
        {
          accessLevel: 'editor',
          status: 'ACTIVE',
          grantedBy: userId,
          grantReason: 'Editor access granted',
          grantedAt: new Date(),
          revokedAt: null,
          revokedBy: null,
          revocationReason: '',
        },
        { new: true }
      );
    } else {
      // Create new access record
      paperAccess = new PaperAccess({
        paperId: paperId,
        userId: editor._id,
        accessLevel: 'editor',
        status: 'ACTIVE',
        grantedBy: userId,
        grantReason: 'Editor access granted',
      });
      await paperAccess.save();
    }

    // Log the action
    await auditService.log(
      userId,
      'GRANT_EDITOR_ACCESS',
      paperId,
      'SUCCESS',
      `Editor access granted to ${editorEmail}`,
      clientIP
    );

    res.status(201).json({
      message: 'Editor access granted successfully',
      access: paperAccess,
    });
  } catch (error) {
    console.error('Grant editor access error:', error);
    res.status(500).json({ error: 'Failed to grant editor access' });
  }
};

/**
 * Get editors with access to a paper (Author only - for their own papers)
 */
exports.getPaperEditors = async (req, res) => {
  try {
    const PaperAccess = require('../models/PaperAccess');
    const paperId = req.params.paperId;
    const userId = req.session.userId;

    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Verify the requester is the paper owner
    if (paper.authorId.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Only the paper author can view editors' });
    }

    // Get all active editor accesses
    const editors = await PaperAccess.find({
      paperId: paperId,
      accessLevel: 'editor',
      status: 'ACTIVE',
    }).populate('userId', 'fullName email');

    res.status(200).json({
      editors: editors,
      count: editors.length,
    });
  } catch (error) {
    console.error('Get paper editors error:', error);
    res.status(500).json({ error: 'Failed to get editors' });
  }
};

/**
 * Revoke editor access from a paper (Author only - for their own papers)
 */
exports.revokeEditorAccess = async (req, res) => {
  try {
    const PaperAccess = require('../models/PaperAccess');
    const paperId = req.params.paperId;
    const { editorId } = req.body;
    const userId = req.session.userId;
    const clientIP = authMiddleware.getClientIP(req);

    if (!editorId) {
      return res.status(400).json({ error: 'Editor ID is required' });
    }

    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Verify the requester is the paper owner
    if (paper.authorId.toString() !== userId.toString()) {
      await auditService.logAccessDenied(
        userId,
        'REVOKE_EDITOR_ACCESS',
        paperId,
        clientIP,
        'User is not the paper owner'
      );
      return res.status(403).json({ error: 'Only the paper author can revoke editor access' });
    }

    // Find and revoke the access
    const access = await PaperAccess.findOneAndUpdate(
      {
        paperId: paperId,
        userId: editorId,
        accessLevel: 'editor',
      },
      {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: userId,
        revocationReason: 'Revoked by paper author',
      },
      { new: true }
    );

    if (!access) {
      return res.status(404).json({ error: 'Editor access not found' });
    }

    // Log the action
    await auditService.log(
      userId,
      'REVOKE_EDITOR_ACCESS',
      paperId,
      'SUCCESS',
      `Editor access revoked for user ${editorId}`,
      clientIP
    );

    res.status(200).json({
      message: 'Editor access revoked successfully',
      access: access,
    });
  } catch (error) {
    console.error('Revoke editor access error:', error);
    res.status(500).json({ error: 'Failed to revoke editor access' });
  }
};
