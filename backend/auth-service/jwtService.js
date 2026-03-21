// ============================================================
// auth-service/jwtService.js
// ============================================================
const jwt = require('jsonwebtoken');
const redis = require('../models/redis');

const TOKEN_TTL = 10 * 60; // 10 minutes in seconds

/**
 * Issue a single-use voting token after successful dual biometric auth
 */
function issueVotingToken(voter) {
  const payload = {
    voterId: voter.id,
    name:    voter.full_name,
    scope:   'vote_once',
    iat:     Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
    issuer: 'biometric-voting-system',
    audience: 'voter',
  });
}

/**
 * Issue an admin JWT
 */
function issueAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.id, username: admin.username, role: admin.role },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Blacklist a token (logout)
 */
async function revokeToken(token) {
  const decoded = jwt.decode(token);
  if (!decoded || !decoded.exp) return;
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.set(`blacklist:${token}`, '1', ttl);
  }
}

/**
 * Decode without verification (for logging only)
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = { issueVotingToken, issueAdminToken, revokeToken, decodeToken };
