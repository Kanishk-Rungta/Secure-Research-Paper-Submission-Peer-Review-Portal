const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Email Service for OTP delivery
 * Uses Gmail SMTP for secure email delivery
 * OTP is critical for MFA implementation per NIST SP 800-63-2
 */

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // App-specific password, not account password
      },
    });
  }

  /**
   * Send OTP to user email
   * @param {string} email - User email address
   * @param {string} otp - One-Time Password (6 digits)
   * @param {string} userName - User's name for personalization
   * @returns {Promise<boolean>} True if email sent successfully
   */
  async sendOTP(email, otp, userName) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Research Portal OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Multi-Factor Authentication</h2>
            <p>Hello ${userName},</p>
            <p>Your One-Time Password (OTP) for the Research Paper Submission Portal is:</p>
            <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="margin: 0; color: #007bff; letter-spacing: 5px; font-family: monospace;">${otp}</h1>
            </div>
            <p style="color: #666;">
              <strong>⏱️ This OTP expires in 5 minutes.</strong>
            </p>
            <p style="color: #666;">
              If you did not request this code, please ignore this email. Your account is secure.
            </p>
            <hr style="border: none; border-top: 1px solid #ccc; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✓ OTP sent to ${email}`);
      return true;
    } catch (error) {
      console.error(`✗ Failed to send OTP to ${email}:`, error.message);
      return false;
    }
  }

  /**
   * Send review invitation to reviewer
   * @param {string} email - Reviewer email
   * @param {string} paperTitle - Paper title
   * @param {string} reviewLink - Link to review page
   * @returns {Promise<boolean>}
   */
  async sendReviewInvitation(email, paperTitle, reviewLink) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Review Invitation: ${paperTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Research Paper Review Invitation</h2>
            <p>You have been invited to review the following paper:</p>
            <p><strong>${paperTitle}</strong></p>
            <p><a href="${reviewLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Review Paper</a></p>
            <p>Please complete your review within the deadline specified.</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error(`Failed to send review invitation:`, error.message);
      return false;
    }
  }

  /**
   * Send decision notification to author
   * @param {string} email - Author email
   * @param {string} paperTitle - Paper title
   * @param {string} decision - ACCEPTED, REJECTED, REVISION_REQUESTED
   * @returns {Promise<boolean>}
   */
  async sendDecisionNotification(email, paperTitle, decision) {
    try {
      const decisionMessages = {
        ACCEPTED: 'Your paper has been <strong>ACCEPTED</strong> for publication!',
        REJECTED: 'Unfortunately, your paper has been <strong>REJECTED</strong>.',
        REVISION_REQUESTED: 'Your paper requires <strong>MINOR/MAJOR REVISIONS</strong>. Please resubmit with changes.',
      };

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Decision: ${paperTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Paper Review Decision</h2>
            <p>Dear Author,</p>
            <p>${decisionMessages[decision] || 'Decision pending...'}</p>
            <p><strong>Paper Title:</strong> ${paperTitle}</p>
            <p>Please log in to the Research Portal to view detailed feedback from reviewers.</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error(`Failed to send decision notification:`, error.message);
      return false;
    }
  }
}

module.exports = new EmailService();
