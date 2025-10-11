import nodemailer from 'nodemailer';
import config from '../config/env';
import logger from './logger';

const { email } = config;

// Create a SMTP transporter
const transporter = nodemailer.createTransport({
  host: email.smtp.host,
  port: email.smtp.port,
  secure: email.smtp.port === 465, // true for 465, false for other ports
  auth: {
    user: email.smtp.auth.user,
    pass: email.smtp.auth.pass,
  },
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    logger.error('Error with mail configuration:', error);
  } else {
    logger.info('Server is ready to take our messages');
  }
});

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - HTML body
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text, html) => {
  const msg = {
    from: `"${email.fromName}" <${email.from}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(msg);
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send verification email
 * @param {string} to - Recipient email address
 * @param {string} token - Verification token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  const subject = 'Email Verification';
  const text = `Please verify your email by clicking: ${verificationUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Verify Your Email</h2>
      <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
      <a href="${verificationUrl}" 
         style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">
        Verify Email
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <p>This link will expire in 10 minutes.</p>
    </div>
  `;

  await sendEmail(to, subject, text, html);
};

/**
 * Send password reset email
 * @param {string} to - Recipient email address
 * @param {string} token - Reset token
 * @returns {Promise}
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const subject = 'Password Reset Request';
  const text = `To reset your password, click: ${resetUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2>Reset Your Password</h2>
      <p>You requested to reset your password. Click the button below to reset it:</p>
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">
        Reset Password
      </a>
      <p>Or copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
  `;

  await sendEmail(to, subject, text, html);
};

export { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
