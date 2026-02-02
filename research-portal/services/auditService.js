const AuditLog = require('../models/AuditLog');

/**
 * Audit Logging Service
 * Implements comprehensive audit trail per NIST requirements
 * Logs all security-relevant events: authentication, file operations, access control
 */

class AuditService {
  /**
   * Log user action to database
   * @param {string} userId - User performing the action
   * @param {string} action - Action type (LOGIN, REGISTER, FILE_UPLOAD, PAPER_SUBMIT, etc.)
   * @param {string} resource - Resource affected (paper ID, file name, etc.)
   * @param {string} status - Result (SUCCESS, FAILURE)
   * @param {string} details - Additional details
   * @param {string} ipAddress - Client IP address
   * @returns {Promise<Object>} Created audit log entry
   */
  async log(userId, action, resource, status, details, ipAddress) {
    try {
      const auditLog = new AuditLog({
        userId: userId,
        action: action,
        resource: resource,
        status: status,
        details: details,
        ipAddress: ipAddress,
        timestamp: new Date(),
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - prevent audit failures from breaking the app
      return null;
    }
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(email, success, ipAddress, details = '') {
    await this.log(
      null, // userId unknown before successful login
      success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
      email,
      success ? 'SUCCESS' : 'FAILURE',
      details,
      ipAddress
    );
  }

  /**
   * Log user registration
   */
  async logRegistration(userId, email, ipAddress) {
    await this.log(
      userId,
      'USER_REGISTRATION',
      email,
      'SUCCESS',
      'New user account created',
      ipAddress
    );
  }

  /**
   * Log MFA verification
   */
  async logMFAVerification(userId, email, success, ipAddress) {
    await this.log(
      userId,
      success ? 'MFA_VERIFIED' : 'MFA_FAILED',
      email,
      success ? 'SUCCESS' : 'FAILURE',
      `OTP verification ${success ? 'successful' : 'failed'}`,
      ipAddress
    );
  }

  /**
   * Log file upload
   */
  async logFileUpload(userId, paperId, fileName, fileSize, ipAddress) {
    await this.log(
      userId,
      'FILE_UPLOAD',
      paperId,
      'SUCCESS',
      `File uploaded: ${fileName} (${fileSize} bytes)`,
      ipAddress
    );
  }

  /**
   * Log file download/access
   */
  async logFileDownload(userId, paperId, fileName, ipAddress) {
    await this.log(
      userId,
      'FILE_DOWNLOAD',
      paperId,
      'SUCCESS',
      `File accessed: ${fileName}`,
      ipAddress
    );
  }

  /**
   * Log access control denial
   */
  async logAccessDenied(userId, action, resource, ipAddress, reason) {
    await this.log(
      userId,
      'ACCESS_DENIED',
      resource,
      'FAILURE',
      `${action}: ${reason}`,
      ipAddress
    );
  }

  /**
   * Log review submission
   */
  async logReviewSubmission(userId, paperId, reviewId, ipAddress) {
    await this.log(
      userId,
      'REVIEW_SUBMITTED',
      paperId,
      'SUCCESS',
      `Review submitted: ${reviewId}`,
      ipAddress
    );
  }

  /**
   * Log final decision
   */
  async logDecision(userId, paperId, decision, ipAddress) {
    await this.log(
      userId,
      'DECISION_MADE',
      paperId,
      'SUCCESS',
      `Decision: ${decision}`,
      ipAddress
    );
  }

  /**
   * Get user's action history
   */
  async getUserHistory(userId, limit = 100) {
    return await AuditLog.find({ userId: userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Get resource access history
   */
  async getResourceHistory(resource, limit = 100) {
    return await AuditLog.find({ resource: resource })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Get all failed access attempts (for security monitoring)
   */
  async getFailedAttempts(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await AuditLog.find({
      status: 'FAILURE',
      timestamp: { $gte: since },
    }).sort({ timestamp: -1 });
  }
}

module.exports = new AuditService();
