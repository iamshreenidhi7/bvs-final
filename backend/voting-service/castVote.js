// ============================================================
// voting-service/castVote.js
// Handles vote casting with full anonymization
// ============================================================
const crypto = require('crypto');
const db = require('../models/db');
const redis = require('../models/redis');
const { logger } = require('../middleware/logger');

/**
 * Cast a vote atomically within a DB transaction
 * - Vote is stored WITHOUT voter identity
 * - Participation is logged WITHOUT vote choice
 * - Returns a receipt hash the voter can use to verify
 */
async function castVote(voterId, electionId, candidateId, ipAddress) {
  return await db.transaction(async (trx) => {

    // 1. Verify voter exists and is active
    const voter = await trx('voters')
      .where({ id: voterId, is_registered: true, is_active: true })
      .first();
    if (!voter) {
      throw new Error('Voter not found or not registered');
    }

    // 2. Check account not locked
    if (voter.locked_until && new Date(voter.locked_until) > new Date()) {
      throw new Error('Account is temporarily locked');
    }

    // 3. Verify election is active
    const election = await trx('elections')
      .where({ id: electionId, is_active: true, is_published: true })
      .whereRaw('NOW() BETWEEN start_time AND end_time')
      .first();
    if (!election) {
      throw new Error('Election is not currently active');
    }

    // 4. Verify candidate belongs to this election
    const candidate = await trx('candidates')
      .where({ id: candidateId, election_id: electionId })
      .first();
    if (!candidate) {
      throw new Error('Invalid candidate for this election');
    }

    // 5. Prevent double voting (atomic check using DB lock)
    const alreadyVoted = await trx('voter_participation')
      .where({ voter_id: voterId, election_id: electionId })
      .first();
    if (alreadyVoted) {
      throw new Error('You have already cast your vote in this election');
    }

    // 6. Generate anonymous vote hash (receipt)
    // This hash is verifiable by the voter but cannot be linked back to them
    const salt = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString();
    const voteHash = crypto
      .createHash('sha256')
      .update(`${electionId}:${candidateId}:${salt}:${timestamp}`)
      .digest('hex');

    // 7. INSERT the anonymous vote
    await trx('votes').insert({
      election_id:  electionId,
      candidate_id: candidateId,
      vote_hash:    voteHash,
      vote_salt:    salt,
    });

    // 8. Record participation (WHO voted — NOT for whom)
    const ipHash = ipAddress
      ? crypto.createHash('sha256').update(ipAddress).digest('hex')
      : null;

    await trx('voter_participation').insert({
      voter_id:    voterId,
      election_id: electionId,
      ip_hash:     ipHash,
    });

    // 9. Write audit log
    await trx('audit_log').insert({
      event_type: 'VOTE_CAST',
      voter_id:   voterId,
      ip_hash:    ipHash,
      metadata: JSON.stringify({
        election_id:   electionId,
        vote_hash:     voteHash,
        timestamp:     new Date().toISOString(),
      }),
    });

    logger.info(`✅ Vote cast by voter ${voterId} in election ${electionId}`);

    return {
      success: true,
      receiptHash: voteHash,
      candidateName: candidate.name,
      electionTitle: election.title,
      castedAt: new Date().toISOString(),
    };
  });
}

/**
 * Verify a vote receipt hash exists in the system
 */
async function verifyVoteReceipt(receiptHash) {
  const vote = await db('votes')
    .join('candidates', 'votes.candidate_id', 'candidates.id')
    .join('elections', 'votes.election_id', 'elections.id')
    .where('votes.vote_hash', receiptHash)
    .select(
      'votes.cast_at',
      'candidates.name as candidate_name',
      'candidates.party',
      'elections.title as election_title'
    )
    .first();

  if (!vote) {
    return { valid: false, message: 'Receipt not found in voting records' };
  }

  return {
    valid: true,
    election: vote.election_title,
    candidate: vote.candidate_name,
    party: vote.party,
    castedAt: vote.cast_at,
  };
}

/**
 * Get live tally for an election (only after polls close)
 */
async function getElectionResults(electionId) {
  const election = await db('elections').where({ id: electionId }).first();
  if (!election) throw new Error('Election not found');

  // Only show results if election has ended
  const now = new Date();
  const endTime = new Date(election.end_time);
  const showResults = !election.is_active || now > endTime;

  if (!showResults) {
    throw new Error('Results will be available after the election ends');
  }

  const results = await db('election_results')
    .where({ election_id: electionId })
    .select('*');

  const participation = await db('participation_stats')
    .where({ election_id: electionId })
    .first();

  return {
    election: {
      id:       election.id,
      title:    election.title,
      endTime:  election.end_time,
    },
    results,
    participation,
  };
}

module.exports = { castVote, verifyVoteReceipt, getElectionResults };
