// ============================================================
// middleware/authenticate.js - JWT Verification Middleware
// ============================================================
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const redis = require('../models/redis');

// Voter authentication middleware
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redis.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure scope is correct
    if (decoded.scope !== 'vote_once') {
      return res.status(401).json({ error: 'Invalid token scope' });
    }

    // Fetch fresh voter data
    const voter = await db('voters')
      .where({ id: decoded.voterId, is_active: true })
      .first();

    if (!voter) {
      return res.status(401).json({ error: 'Voter not found or deactivated' });
    }

    req.voter = voter;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

// Admin authentication middleware
async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No admin token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Insufficient privileges' });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, authenticateAdmin };
