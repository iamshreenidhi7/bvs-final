// ============================================================
// routes/auth.routes.js - Face + Fingerprint + OTP
// ============================================================
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const db = require('../models/db');
const redis = require('../models/redis');
const webauthn = require('../auth-service/webauthn');
const { encryptEmbedding, verifyFaceEmbedding } = require('../auth-service/biometricEncryption');
const { issueVotingToken, issueAdminToken, revokeToken } = require('../auth-service/jwtService');
const { sendOTP, verifyOTP } = require('../auth-service/otpService');
const { authenticate } = require('../middleware/authenticate');
const { logger } = require('../middleware/logger');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Wait 15 minutes.' },
  keyGenerator: (req) => req.body.nationalId || req.ip,
});

const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests. Wait 1 minute.' },
});

// ============================================================
// REGISTRATION
// ============================================================

router.post('/register', async (req, res, next) => {
  try {
    const { nationalId, fullName, dateOfBirth, constituency, email, phone } = req.body;

    if (!nationalId || !fullName || !dateOfBirth || !constituency) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await db('voters').where({ national_id: nationalId }).first();
    if (existing) {
      return res.status(409).json({ error: 'National ID already registered' });
    }

    const [voter] = await db('voters').insert({
      national_id:   nationalId,
      full_name:     fullName,
      date_of_birth: dateOfBirth,
      constituency,
      email: email && email.trim() !== '' ? email.trim() : null,
      phone: phone && phone.trim() !== '' ? phone.trim() : null,
    }).returning(['id', 'full_name', 'national_id']);

    await db('audit_log').insert({
      event_type: 'VOTER_REGISTERED',
      voter_id:   voter.id,
      ip_hash:    req.ip,
      metadata:   JSON.stringify({ national_id: nationalId }),
    });

    logger.info(`New voter registered: ${nationalId}`);
    res.status(201).json({ success: true, voterId: voter.id, message: 'Identity registered.' });
  } catch (err) {
    next(err);
  }
});

router.post('/register/send-otp', otpLimiter, async (req, res, next) => {
  try {
    const { voterId } = req.body;
    if (!voterId) return res.status(400).json({ error: 'voterId required' });

    const voter = await db('voters').where({ id: voterId }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });

    if (!voter.email && !voter.phone) {
      return res.status(400).json({ error: 'No email or phone on record to send OTP' });
    }

    await sendOTP(`reg_otp:${voterId}`, voter.email, voter.phone);

    res.json({
      success: true,
      message: 'OTP sent',
      sentTo: {
        email: voter.email ? voter.email.substring(0, 3) + '***@' + voter.email.split('@')[1] : null,
        phone: voter.phone ? '***' + voter.phone.slice(-4) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/register/verify-otp', async (req, res, next) => {
  try {
    const { voterId, otp } = req.body;
    if (!voterId || !otp) return res.status(400).json({ error: 'voterId and otp required' });

    const result = await verifyOTP('reg_otp:' + voterId, otp);
    if (!result.valid) return res.status(401).json({ error: result.message });

    await redis.set('reg_otp_verified:' + voterId, 'true', 600);
    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/enroll/face', async (req, res, next) => {
  try {
    const { voterId, faceEmbedding } = req.body;
    if (!voterId || !faceEmbedding) {
      return res.status(400).json({ error: 'voterId and faceEmbedding required' });
    }
    if (!Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
      return res.status(400).json({ error: 'faceEmbedding must be 128 elements' });
    }
    const voter = await db('voters').where({ id: voterId }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    if (voter.face_embedding) return res.status(409).json({ error: 'Face already enrolled' });

    const encrypted = encryptEmbedding(faceEmbedding);
    await db('voters').where({ id: voterId }).update({ face_embedding: encrypted, updated_at: db.fn.now() });
    res.json({ success: true, message: 'Face enrolled successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/enroll/webauthn/options/:voterId', async (req, res, next) => {
  try {
    const options = await webauthn.getRegistrationOptions(req.params.voterId);
    res.json(options);
  } catch (err) {
    next(err);
  }
});

router.post('/enroll/webauthn/verify', async (req, res, next) => {
  try {
    const { voterId, registrationResponse } = req.body;
    if (!voterId || !registrationResponse) {
      return res.status(400).json({ error: 'voterId and registrationResponse required' });
    }
    await webauthn.verifyAndStoreCredential(voterId, registrationResponse);
    res.json({ success: true, message: 'Fingerprint enrolled successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/mark-registered', async (req, res, next) => {
  try {
    const { voterId } = req.body;
    if (!voterId) return res.status(400).json({ error: 'voterId required' });
    const voter = await db('voters').where({ id: voterId }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    await db('voters').where({ id: voterId }).update({ is_registered: true, updated_at: db.fn.now() });
    res.json({ success: true, message: 'Registration complete' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// LOGIN
// ============================================================

router.post('/login/start', authLimiter, async (req, res, next) => {
  try {
    const { nationalId } = req.body;
    if (!nationalId) return res.status(400).json({ error: 'National ID required' });

    const voter = await db('voters').where({ national_id: nationalId, is_active: true }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    if (!voter.is_registered) return res.status(403).json({ error: 'Enrollment not complete' });

    if (voter.locked_until && new Date(voter.locked_until) > new Date()) {
      const minutes = Math.ceil((new Date(voter.locked_until) - new Date()) / 60000);
      return res.status(423).json({ error: 'Account locked. Try again in ' + minutes + ' minutes.' });
    }

    await redis.set('login_session:' + voter.id, 'pending', 120);

    const hasFace        = !!voter.face_embedding;
    const hasFingerprint = !!voter.webauthn_credential_id;

    let webauthnOptions = null;
    if (hasFingerprint) {
      webauthnOptions = await webauthn.getAuthenticationOptions(voter.id);
    }

    res.json({ voterId: voter.id, voterName: voter.full_name, hasFace, hasFingerprint, webauthnOptions });
  } catch (err) {
    next(err);
  }
});

router.post('/login/send-otp', otpLimiter, async (req, res, next) => {
  try {
    const { voterId } = req.body;
    if (!voterId) return res.status(400).json({ error: 'voterId required' });

    const voter = await db('voters').where({ id: voterId }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    if (!voter.email && !voter.phone) return res.status(400).json({ error: 'No email or phone on record' });

    await sendOTP('login_otp:' + voterId, voter.email, voter.phone);

    res.json({
      success: true,
      message: 'OTP sent',
      sentTo: {
        email: voter.email ? voter.email.substring(0, 3) + '***@' + voter.email.split('@')[1] : null,
        phone: voter.phone ? '***' + voter.phone.slice(-4) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login/verify-otp', async (req, res, next) => {
  try {
    const { voterId, otp } = req.body;
    if (!voterId || !otp) return res.status(400).json({ error: 'voterId and otp required' });

    const result = await verifyOTP('login_otp:' + voterId, otp);
    if (!result.valid) return res.status(401).json({ error: result.message });

    await redis.set('login_otp_verified:' + voterId, 'true', 600);
    res.json({ success: true, message: 'OTP verified' });
  } catch (err) {
    next(err);
  }
});

router.post('/login/face', authLimiter, async (req, res, next) => {
  try {
    const { voterId, faceEmbedding } = req.body;
    if (!voterId || !faceEmbedding) return res.status(400).json({ error: 'voterId and faceEmbedding required' });

    const voter = await db('voters').where({ id: voterId, is_registered: true, is_active: true }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    if (!voter.face_embedding) return res.status(400).json({ error: 'No face enrolled' });

    const faceResult = verifyFaceEmbedding(voter.face_embedding, faceEmbedding);
    if (!faceResult.match) {
      await handleFailedAttempt(voter);
      return res.status(401).json({ error: 'Face verification failed. Please try again.', confidence: faceResult.confidence });
    }

    return await issueToken(voter, res);
  } catch (err) {
    next(err);
  }
});

router.post('/login/fingerprint', authLimiter, async (req, res, next) => {
  try {
    const { voterId, webauthnResponse } = req.body;
    if (!voterId || !webauthnResponse) return res.status(400).json({ error: 'voterId and webauthnResponse required' });

    const voter = await db('voters').where({ id: voterId, is_registered: true, is_active: true }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });

    try {
      await webauthn.verifyAuthentication(voterId, webauthnResponse);
    } catch (err) {
      await handleFailedAttempt(voter);
      return res.status(401).json({ error: 'Fingerprint verification failed' });
    }

    return await issueToken(voter, res);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// LOGOUT
// ============================================================

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await revokeToken(req.token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// ADMIN LOGIN
// ============================================================

router.post('/admin/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const admin = await db('admins').where({ username }).first();
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = issueAdminToken(admin);
    res.json({ success: true, token, role: admin.role });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// HELPERS
// ============================================================

async function issueToken(voter, res) {
  await db('voters').where({ id: voter.id }).update({
    failed_attempts: 0,
    locked_until:    null,
    last_login:      db.fn.now(),
    updated_at:      db.fn.now(),
  });
  const token = issueVotingToken(voter);
  logger.info('Voter ' + voter.id + ' authenticated successfully');
  return res.json({
    success: true,
    token,
    voter: { id: voter.id, name: voter.full_name, constituency: voter.constituency },
    expiresIn: 600,
  });
}

async function handleFailedAttempt(voter) {
  const maxAttempts = parseInt(process.env.MAX_AUTH_ATTEMPTS) || 5;
  const lockMinutes = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 30;
  const newCount = voter.failed_attempts + 1;
  const update = { failed_attempts: newCount, updated_at: db.fn.now() };
  if (newCount >= maxAttempts) {
    update.locked_until = db.raw("NOW() + INTERVAL '" + lockMinutes + " minutes'");
    logger.warn('Account locked for voter ' + voter.id);
  }
  await db('voters').where({ id: voter.id }).update(update);
}

module.exports = router;
