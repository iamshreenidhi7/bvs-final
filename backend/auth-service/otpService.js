const nodemailer = require('nodemailer');
const axios = require('axios');
const redis = require('../models/redis');
const { logger } = require('../middleware/logger');

const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY) || 300;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeOTP(key, otp) {
  await redis.set(key, otp, OTP_EXPIRY);
}

async function verifyOTP(key, otp) {
  const stored = await redis.get(key);
  if (!stored) return { valid: false, message: 'OTP expired or not found' };
  if (stored !== otp) return { valid: false, message: 'Invalid OTP' };
  await redis.del(key);
  return { valid: true };
}

async function sendEmailOTP(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });
    await transporter.sendMail({
      from: '"VoteSecure" <' + process.env.GMAIL_USER + '>',
      to: email,
      subject: 'Your VoteSecure OTP',
      html: '<div style="font-family:Arial;max-width:480px;margin:0 auto;padding:32px;background:#f5f0e8;border-radius:12px"><h2 style="color:#0a1628">VoteSecure</h2><p style="color:#6b7280">Your One-Time Password:</p><div style="background:#0a1628;color:#c9a84c;font-size:2.5rem;font-weight:700;letter-spacing:12px;text-align:center;padding:24px;border-radius:8px;margin:24px 0">' + otp + '</div><p style="color:#6b7280;font-size:0.85rem">Expires in 5 minutes. Do not share.</p></div>',
    });
    logger.info('Email OTP sent to ' + email);
    return { success: true };
  } catch (err) {
    logger.error('Email OTP error: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function sendSMSOTP(phone, otp) {
  try {
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: process.env.FAST2SMS_KEY,
        variables_values: otp,
        route: 'otp',
        numbers: phone,
      },
    });
    if (response.data.return === true) {
      logger.info('SMS OTP sent to ' + phone);
      return { success: true };
    }
    return { success: false, error: response.data.message };
  } catch (err) {
    logger.error('SMS OTP error: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function sendOTP(identifier, email, phone) {
  const otp = generateOTP();
  await storeOTP(identifier, otp);
  const results = {};
  if (email) results.email = await sendEmailOTP(email, otp);
  if (phone) results.sms = await sendSMSOTP(phone, otp);
  return { otp, results };
}

module.exports = { generateOTP, storeOTP, verifyOTP, sendOTP, sendEmailOTP, sendSMSOTP };