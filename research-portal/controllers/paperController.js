const Paper = require('../models/Paper');
const Review = require('../models/Review');
const Decision = require('../models/Decision');
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
 * ACL enforced: Authors see only their papers, Reviewers see assigned, Editors see all
 */
exports.listPapers = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = req.user;
    let query = {};

    if (user.role === 'Author') {
      // Authors see only their own papers
      query = { authorId: userId };
    } else if (user.role === 'Reviewer') {
      // Reviewers see only papers assigned to them
      query = { assignedReviewers: userId };
    }
    // Editors see all papers (empty query)

    const papers = await Paper.find(query)
      .select('-encryptedData -encryptedAESKey -encryptedIV -fileHash')
      .populate('authorId', 'fullName email')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      papers: papers,
      count: papers.length,
    });
  } catch (error) {
    console.error('List papers error:', error);
    res.status(500).json({ error: 'Failed to list papers' });
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
