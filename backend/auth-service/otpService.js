const { google } = require('googleapis');
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
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const htmlBody = '<div style="font-family:Arial;max-width:480px;margin:0 auto;padding:32px;background:#f5f0e8;border-radius:12px"><h2 style="color:#0a1628">VoteSecure</h2><p style="color:#6b7280">Your One-Time Password:</p><div style="background:#0a1628;color:#c9a84c;font-size:2.5rem;font-weight:700;letter-spacing:12px;text-align:center;padding:24px;border-radius:8px;margin:24px 0">' + otp + '</div><p style="color:#6b7280;font-size:0.85rem">Expires in 5 minutes. Do not share.</p></div>';

    const message = [
      'From: VoteSecure <' + process.env.GMAIL_USER + '>',
      'To: ' + email,
      'Subject: Your VoteSecure OTP',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody,
    ].join('\n');

    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    logger.info('Gmail API OTP sent to ' + email);
    return { success: true };
  } catch (err) {
    logger.error('Gmail API OTP error: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function sendSMSOTP(phone, otp) {
  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.length !== 10) {
      logger.error('Invalid phone number length: ' + cleanPhone);
      return { success: false, error: 'Invalid phone number' };
    }

    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: process.env.FAST2SMS_KEY,
        message: 'Your VoteSecure OTP is ' + otp + '. Valid for 5 minutes. Do not share.',
        language: 'english',
        route: 'q',
        numbers: cleanPhone,
      },
    });

    if (response.data.return === true) {
      logger.info('SMS OTP sent to ' + cleanPhone);
      return { success: true };
    }
    logger.error('Fast2SMS error: ' + JSON.stringify(response.data));
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
  // SMS is optional — only send if FAST2SMS_KEY is configured and active
  if (phone && process.env.FAST2SMS_ACTIVE === 'true') {
    results.sms = await sendSMSOTP(phone, otp);
  }
  return { otp, results };
}

module.exports = { generateOTP, storeOTP, verifyOTP, sendOTP, sendEmailOTP, sendSMSOTP };