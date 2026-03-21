// ============================================================
// routes/vote.routes.js
// ============================================================
const express = require('express');
const rateLimit = require('express-rate-limit');
const { castVote, verifyVoteReceipt, getElectionResults } = require('../voting-service/castVote');
const { authenticate } = require('../middleware/authenticate');
const db = require('../models/db');
const redis = require('../models/redis');

const router = express.Router();

// One vote per token (since JWT is 10 min, this covers the window)
const voteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { error: 'Too many vote requests' },
  keyGenerator: (req) => req.voter?.id || req.ip,
});

/**
 * POST /api/vote/cast
 * Cast a vote (requires valid JWT)
 */
router.post('/cast', authenticate, voteLimiter, async (req, res, next) => {
  try {
    const { electionId, candidateId } = req.body;

    if (!electionId || !candidateId) {
      return res.status(400).json({ error: 'electionId and candidateId are required' });
    }

    const result = await castVote(
      req.voter.id,
      electionId,
      candidateId,
      req.ip
    );

    // Invalidate the token after voting (single-use enforcement via Redis)
    const redis_ = require('../models/redis');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(req.token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis_.set(`blacklist:${req.token}`, '1', ttl);
    }

    res.json(result);
  } catch (err) {
    if (err.message.includes('already cast') || err.message.includes('not active')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/vote/verify-receipt
 * Verify a vote receipt hash
 */
router.post('/verify-receipt', async (req, res, next) => {
  try {
    const { receiptHash } = req.body;
    if (!receiptHash) return res.status(400).json({ error: 'receiptHash required' });

    const result = await verifyVoteReceipt(receiptHash);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/vote/results/:electionId
 * Get election results (only after election ends)
 */
router.get('/results/:electionId', async (req, res, next) => {
  try {
    const results = await getElectionResults(req.params.electionId);
    res.json(results);
  } catch (err) {
    if (err.message.includes('Results will be available')) {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/vote/status/:electionId
 * Check if current voter has voted in this election
 */
router.get('/status/:electionId', authenticate, async (req, res, next) => {
  try {
    const participation = await db('voter_participation')
      .where({
        voter_id:    req.voter.id,
        election_id: req.params.electionId,
      })
      .first();

    res.json({ hasVoted: !!participation, votedAt: participation?.voted_at || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
