// ============================================================
// auth-service/webauthn.js - FIDO2/WebAuthn Authentication
// ============================================================
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoBase64URL } = require('@simplewebauthn/server/helpers');
const db = require('../models/db');
const redis = require('../models/redis');
const { logger } = require('../middleware/logger');

const RP_NAME   = process.env.RP_NAME   || 'National Voting System';
const RP_ID     = process.env.RP_ID     || 'localhost';
const ORIGIN    = process.env.ORIGIN    || 'http://localhost:3000';
const CHALLENGE_TTL = 120; // 2 minutes

// ============================================================
// REGISTRATION
// ============================================================

/**
 * Generate WebAuthn registration options for a voter
 */
async function getRegistrationOptions(voterId) {
  const voter = await db('voters').where({ id: voterId }).first();
  if (!voter) throw new Error('Voter not found');
  if (voter.is_registered) throw new Error('Voter already registered biometrics');

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: isoBase64URL.fromBuffer(Buffer.from(voter.id)),
    userName: voter.national_id,
    userDisplayName: voter.full_name,
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Use device built-in (fingerprint, FaceID)
      userVerification: 'required',        // Force biometric PIN
      residentKey: 'required',
    },
    supportedAlgorithmIDs: [-7, -257],     // ES256, RS256
    timeout: 60000,
  });

  // Store challenge in Redis with TTL
  await redis.set(`reg_challenge:${voterId}`, options.challenge, CHALLENGE_TTL);

  return options;
}

/**
 * Verify registration response and store credential
 */
async function verifyAndStoreCredential(voterId, registrationResponse) {
  const expectedChallenge = await redis.get(`reg_challenge:${voterId}`);
  if (!expectedChallenge) {
    throw new Error('Registration challenge expired or not found. Please start over.');
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    logger.warn(`WebAuthn registration verification failed for voter ${voterId}: ${err.message}`);
    throw new Error('Biometric registration verification failed');
  }

  if (!verification.verified) {
    throw new Error('Biometric registration could not be verified');
  }

  const { credential } = verification.registrationInfo;

  await db('voters').where({ id: voterId }).update({
    webauthn_credential_id: isoBase64URL.fromBuffer(credential.id),
    webauthn_public_key:    isoBase64URL.fromBuffer(credential.publicKey),
    sign_count:             credential.counter,
    updated_at:             db.fn.now(),
  });

  // Clean up challenge
  await redis.del(`reg_challenge:${voterId}`);

  logger.info(`✅ WebAuthn credential stored for voter ${voterId}`);
  return true;
}

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Generate WebAuthn authentication challenge
 */
async function getAuthenticationOptions(voterId) {
  const voter = await db('voters')
    .where({ id: voterId, is_registered: true, is_active: true })
    .first();

  if (!voter) throw new Error('Voter not found or not registered');
  if (!voter.webauthn_credential_id) {
    throw new Error('No biometric credential registered for this voter');
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: [{
      id: isoBase64URL.toBuffer(voter.webauthn_credential_id),
      type: 'public-key',
      transports: ['internal'],
    }],
    timeout: 60000,
  });

  await redis.set(`auth_challenge:${voterId}`, options.challenge, CHALLENGE_TTL);
  return options;
}

/**
 * Verify authentication response
 */
async function verifyAuthentication(voterId, authResponse) {
  const voter = await db('voters')
    .where({ id: voterId, is_registered: true })
    .first();

  if (!voter) throw new Error('Voter not found');

  const expectedChallenge = await redis.get(`auth_challenge:${voterId}`);
  if (!expectedChallenge) {
    throw new Error('Authentication challenge expired. Please start over.');
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id:        isoBase64URL.toBuffer(voter.webauthn_credential_id),
        publicKey: isoBase64URL.toBuffer(voter.webauthn_public_key),
        counter:   voter.sign_count,
      },
      requireUserVerification: true,
    });
  } catch (err) {
    logger.warn(`WebAuthn auth failed for voter ${voterId}: ${err.message}`);
    throw new Error('Fingerprint verification failed');
  }

  if (!verification.verified) {
    throw new Error('Fingerprint verification failed');
  }

  // Update sign counter (replay attack prevention)
  await db('voters').where({ id: voterId }).update({
    sign_count: verification.authenticationInfo.newCounter,
    last_login: db.fn.now(),
    updated_at: db.fn.now(),
  });

  await redis.del(`auth_challenge:${voterId}`);
  return true;
}

module.exports = {
  getRegistrationOptions,
  verifyAndStoreCredential,
  getAuthenticationOptions,
  verifyAuthentication,
};
