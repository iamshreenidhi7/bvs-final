// ============================================================
// routes/admin.routes.js
// ============================================================
const express = require('express');
const db = require('../models/db');
const { authenticateAdmin } = require('../middleware/authenticate');

const router = express.Router();

// All admin routes require admin JWT
router.use(authenticateAdmin);

/**
 * GET /api/admin/dashboard
 * Overall system stats
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const [voterCount]    = await db('voters').count('id as count');
    const [electionCount] = await db('elections').count('id as count');
    const [voteCount]     = await db('votes').count('id as count');
    const [activeElections] = await db('elections')
      .where({ is_active: true })
      .whereRaw('NOW() BETWEEN start_time AND end_time')
      .count('id as count');

    const recentAudit = await db('audit_log')
      .orderBy('created_at', 'desc')
      .limit(20)
      .select('event_type', 'voter_id', 'created_at', 'metadata');

    res.json({
      stats: {
        totalVoters:      parseInt(voterCount.count),
        totalElections:   parseInt(electionCount.count),
        totalVotesCast:   parseInt(voteCount.count),
        activeElections:  parseInt(activeElections.count),
      },
      recentActivity: recentAudit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/voters
 * List voters with pagination
 */
router.get('/voters', async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const voters = await db('voters')
      .select(
        'id', 'national_id', 'full_name', 'constituency',
        'is_registered', 'is_active', 'last_login', 'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db('voters').count('id as count');

    res.json({
      voters,
      pagination: {
        page,
        limit,
        total:      parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/voters/:id/deactivate
 */
router.put('/voters/:id/deactivate', async (req, res, next) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can deactivate voters' });
    }

    await db('voters').where({ id: req.params.id }).update({
      is_active:  false,
      updated_at: db.fn.now(),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/elections/:id/participation
 */
router.get('/elections/:id/participation', async (req, res, next) => {
  try {
    const stats = await db('participation_stats')
      .where({ election_id: req.params.id })
      .first();

    const hourlyVotes = await db('voter_participation')
      .where({ election_id: req.params.id })
      .select(db.raw("DATE_TRUNC('hour', voted_at) as hour"))
      .count('voter_id as count')
      .groupBy(db.raw("DATE_TRUNC('hour', voted_at)"))
      .orderBy('hour', 'asc');

    res.json({ stats, hourlyVotes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
