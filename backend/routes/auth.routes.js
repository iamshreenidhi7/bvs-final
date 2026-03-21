// ============================================================
// routes/auth.routes.js
// ============================================================
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const db = require('../models/db');
const redis = require('../models/redis');
const webauthn = require('../auth-service/webauthn');
const { encryptEmbedding, verifyFaceEmbedding } = require('../auth-service/biometricEncryption');
const { issueVotingToken, issueAdminToken, revokeToken } = require('../auth-service/jwtService');
const { authenticate } = require('../middleware/authenticate');
const { logger } = require('../middleware/logger');

const router = express.Router();

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { error: 'Too many authentication attempts. Wait 15 minutes.' },
  keyGenerator: (req) => req.body.nationalId || req.ip,
});

// ============================================================
// VOTER REGISTRATION
// ============================================================

/**
 * POST /api/auth/register
 * Step 1: Register voter identity (no biometrics yet)
 */
router.post('/register', async (req, res, next) => {
  try {
    const { nationalId, fullName, dateOfBirth, constituency, email } = req.body;

    if (!nationalId || !fullName || !dateOfBirth || !constituency) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check duplicate
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
}).returning(['id', 'full_name', 'national_id']);

    // Audit
    await db('audit_log').insert({
      event_type: 'VOTER_REGISTERED',
      voter_id:   voter.id,
      ip_hash:    req.ip,
      metadata:   JSON.stringify({ national_id: nationalId }),
    });

    logger.info(`New voter registered: ${nationalId}`);

    res.status(201).json({
      success: true,
      voterId: voter.id,
      message: 'Identity registered. Please complete biometric enrollment.',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// BIOMETRIC ENROLLMENT
// ============================================================

/**
 * POST /api/auth/enroll/face
 * Store encrypted face embedding for a voter
 */
router.post('/enroll/face', async (req, res, next) => {
  try {
    const { voterId, faceEmbedding } = req.body;

    if (!voterId || !faceEmbedding) {
      return res.status(400).json({ error: 'voterId and faceEmbedding required' });
    }

    if (!Array.isArray(faceEmbedding) || faceEmbedding.length !== 128) {
      return res.status(400).json({ error: 'faceEmbedding must be a 128-element array' });
    }

    const voter = await db('voters').where({ id: voterId }).first();
    if (!voter) return res.status(404).json({ error: 'Voter not found' });
    if (voter.face_embedding) {
      return res.status(409).json({ error: 'Face already enrolled' });
    }

    const encrypted = encryptEmbedding(faceEmbedding);
    await db('voters').where({ id: voterId }).update({
      face_embedding: encrypted,
      updated_at: db.fn.now(),
    });

    res.json({ success: true, message: 'Face enrolled successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/enroll/webauthn/options/:voterId
 * Get WebAuthn registration challenge
 */
router.get('/enroll/webauthn/options/:voterId', async (req, res, next) => {
  try {
    const options = await webauthn.getRegistrationOptions(req.params.voterId);
    res.json(options);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/enroll/webauthn/verify
 * Verify WebAuthn registration response and mark voter as fully registered
 */
router.post('/enroll/webauthn/verify', async (req, res, next) => {
  try {
    const { voterId, registrationResponse } = req.body;
    if (!voterId || !registrationResponse) {
      return res.status(400).json({ error: 'voterId and registrationResponse required' });
    }

    await webauthn.verifyAndStoreCredential(voterId, registrationResponse);

    // Check if face is also enrolled
    const voter = await db('voters').where({ id: voterId }).first();
    const fullyEnrolled = voter.face_embedding !== null;

    if (fullyEnrolled) {
      await db('voters').where({ id: voterId }).update({
        is_registered: true,
        updated_at: db.fn.now(),
      });
    }

    res.json({
      success: true,
      fullyEnrolled,
      message: fullyEnrolled
        ? 'Biometric enrollment complete! You can now vote.'
        : 'Fingerprint enrolled. Please complete face enrollment.',
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUTHENTICATION (Login to vote)
// ============================================================

/**
 * POST /api/auth/login/start
 * Begin dual-biometric authentication
 */
router.post('/login/start', authLimiter, async (req, res, next) => {
  try {
    const { nationalId } = req.body;
    if (!nationalId) return res.status(400).json({ error: 'National ID required' });

    const voter = await db('voters')
      .where({ national_id: nationalId, is_active: true })
      .first();

    if (!voter) {
      // Deliberate vague error to prevent enumeration
      return res.status(404).json({ error: 'Voter not found' });
    }

    if (!voter.is_registered) {
      return res.status(403).json({ error: 'Biometric enrollment not complete' });
    }

    // Check lockout
    if (voter.locked_until && new Date(voter.locked_until) > new Date()) {
      const minutes = Math.ceil((new Date(voter.locked_until) - new Date()) / 60000);
      return res.status(423).json({
        error: `Account locked. Try again in ${minutes} minutes.`,
      });
    }

    const webauthnOptions = await webauthn.getAuthenticationOptions(voter.id);

    // Store voter ID temporarily for the session
    await redis.set(`login_session:${voter.id}`, 'pending', 120);

    res.json({
      voterId: voter.id,
      voterName: voter.full_name,
      webauthnOptions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login/complete
 * Complete authentication with fingerprint + face
 */
router.post('/login/complete', authLimiter, async (req, res, next) => {
  try {
    const { voterId, webauthnResponse, faceEmbedding } = req.body;

    if (!voterId || !webauthnResponse || !faceEmbedding) {
      return res.status(400).json({
        error: 'voterId, webauthnResponse, and faceEmbedding are required',
      });
    }

    const voter = await db('voters')
      .where({ id: voterId, is_registered: true, is_active: true })
      .first();

    if (!voter) return res.status(404).json({ error: 'Voter not found' });

    const ipHash = require('crypto').createHash('sha256').update(req.ip).digest('hex');

    // Step 1: Verify WebAuthn (fingerprint)
    try {
      await webauthn.verifyAuthentication(voterId, webauthnResponse);
    } catch (err) {
      await handleFailedAttempt(voter);
      await db('audit_log').insert({
        event_type: 'FAILED_FINGERPRINT',
        voter_id: voterId,
        ip_hash: ipHash,
        metadata: JSON.stringify({ error: err.message }),
      });
      return res.status(401).json({ error: 'Fingerprint verification failed' });
    }

    // Step 2: Verify face
    if (!voter.face_embedding) {
      return res.status(400).json({ error: 'No face enrolled for this voter' });
    }

    const faceResult = verifyFaceEmbedding(voter.face_embedding, faceEmbedding);
    if (!faceResult.match) {
      await handleFailedAttempt(voter);
      await db('audit_log').insert({
        event_type: 'FAILED_FACE',
        voter_id: voterId,
        ip_hash: ipHash,
        metadata: JSON.stringify({ distance: faceResult.distance }),
      });
      return res.status(401).json({
        error: 'Face verification failed',
        confidence: faceResult.confidence,
      });
    }

    // Both biometrics passed — reset failure count
    await db('voters').where({ id: voterId }).update({
      failed_attempts: 0,
      locked_until:    null,
      last_login:      db.fn.now(),
      updated_at:      db.fn.now(),
    });

    // Issue short-lived voting token
    const token = issueVotingToken(voter);

    await db('audit_log').insert({
      event_type: 'LOGIN_SUCCESS',
      voter_id:   voterId,
      ip_hash:    ipHash,
      metadata:   JSON.stringify({ face_confidence: faceResult.confidence }),
    });

    logger.info(`✅ Voter ${voterId} authenticated successfully`);

    res.json({
      success: true,
      token,
      voter: {
        id:           voter.id,
        name:         voter.full_name,
        constituency: voter.constituency,
      },
      expiresIn: 600, // 10 minutes
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
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
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

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
async function handleFailedAttempt(voter) {
  const maxAttempts = parseInt(process.env.MAX_AUTH_ATTEMPTS) || 5;
  const lockMinutes = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 30;

  const newCount = voter.failed_attempts + 1;
  const update = { failed_attempts: newCount, updated_at: db.fn.now() };

  if (newCount >= maxAttempts) {
    update.locked_until = db.raw(`NOW() + INTERVAL '${lockMinutes} minutes'`);
    logger.warn(`Account locked for voter ${voter.id} after ${newCount} failed attempts`);
  }

  await db('voters').where({ id: voter.id }).update(update);
}

module.exports = router;
