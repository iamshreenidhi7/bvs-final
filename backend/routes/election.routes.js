// ============================================================
// routes/election.routes.js
// ============================================================
const express = require('express');
const db = require('../models/db');
const { authenticate } = require('../middleware/authenticate');
const { authenticateAdmin } = require('../middleware/authenticate');

const router = express.Router();

/**
 * GET /api/elections
 * List all active elections
 */
router.get('/', async (req, res, next) => {
  try {
    const elections = await db('elections')
      .where({ is_published: true })
      .orderBy('start_time', 'desc')
      .select('id', 'title', 'description', 'election_type', 'start_time', 'end_time', 'is_active');

    res.json({ elections });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/elections/:id
 * Get single election with candidates
 */
router.get('/:id', async (req, res, next) => {
  try {
    const election = await db('elections')
      .where({ id: req.params.id, is_published: true })
      .first();

    if (!election) return res.status(404).json({ error: 'Election not found' });

    const candidates = await db('candidates')
      .where({ election_id: req.params.id })
      .orderBy('ballot_order', 'asc')
      .select('id', 'name', 'party', 'symbol', 'manifesto', 'photo_url', 'ballot_order');

    res.json({ election, candidates });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/elections (admin only)
 * Create a new election
 */
router.post('/', authenticateAdmin, async (req, res, next) => {
  try {
    const { title, description, electionType, constituency, startTime, endTime } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'title, startTime, endTime required' });
    }

    const [election] = await db('elections').insert({
      title,
      description,
      election_type: electionType || 'general',
      constituency,
      start_time:    startTime,
      end_time:      endTime,
      created_by:    req.admin.username,
    }).returning('*');

    res.status(201).json({ election });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/elections/:id/candidates (admin only)
 */
router.post('/:id/candidates', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, party, symbol, manifesto, photoUrl, ballotOrder } = req.body;

    const election = await db('elections').where({ id: req.params.id }).first();
    if (!election) return res.status(404).json({ error: 'Election not found' });

    const [candidate] = await db('candidates').insert({
      election_id:  req.params.id,
      name,
      party,
      symbol,
      manifesto,
      photo_url:    photoUrl,
      ballot_order: ballotOrder,
    }).returning('*');

    res.status(201).json({ candidate });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/elections/:id/activate (admin only)
 */
router.put('/:id/activate', authenticateAdmin, async (req, res, next) => {
  try {
    await db('elections').where({ id: req.params.id }).update({
      is_active:    true,
      is_published: true,
    });
    res.json({ success: true, message: 'Election activated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
