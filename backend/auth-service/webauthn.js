const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { isoBase64URL } = require('@simplewebauthn/server/helpers');
const db = require('../models/db');
const redis = require('../models/redis');
const { logger } = require('../middleware/logger');

const RP_NAME = process.env.RP_NAME || 'VoteSecure';
const RP_ID   = process.env.RP_ID   || 'localhost';
const ORIGIN  = process.env.ORIGIN  || 'http://localhost:3000';

async function getRegistrationOptions(voterId) {
  const voter = await db('voters').where({ id: voterId }).first();
  if (!voter) throw new Error('Voter not found');
  const options = await generateRegistrationOptions({
    rpName: RP_NAME, rpID: RP_ID,
    userID: isoBase64URL.fromBuffer(Buffer.from(voter.id)),
    userName: voter.national_id, userDisplayName: voter.full_name,
    attestationType: 'none',
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'required' },
    supportedAlgorithmIDs: [-7, -257], timeout: 60000,
  });
  await redis.set('reg_challenge:' + voterId, options.challenge, 120);
  return options;
}

async function verifyAndStoreCredential(voterId, registrationResponse) {
  const expectedChallenge = await redis.get('reg_challenge:' + voterId);
  if (!expectedChallenge) throw new Error('Challenge expired. Please try again.');
  const verification = await verifyRegistrationResponse({
    response: registrationResponse, expectedChallenge,
    expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true,
  });
  if (!verification.verified) throw new Error('Fingerprint could not be verified');
  const { credential } = verification.registrationInfo;
  await db('voters').where({ id: voterId }).update({
    webauthn_credential_id: isoBase64URL.fromBuffer(credential.id),
    webauthn_public_key:    isoBase64URL.fromBuffer(credential.publicKey),
    sign_count:             credential.counter,
    updated_at:             db.fn.now(),
  });
  await redis.del('reg_challenge:' + voterId);
  logger.info('WebAuthn credential stored for voter ' + voterId);
  return true;
}

async function getAuthenticationOptions(voterId) {
  const voter = await db('voters').where({ id: voterId }).first();
  if (!voter || !voter.webauthn_credential_id) throw new Error('No fingerprint registered');
  const options = await generateAuthenticationOptions({
    rpID: RP_ID, userVerification: 'required',
    allowCredentials: [{ id: isoBase64URL.toBuffer(voter.webauthn_credential_id), type: 'public-key', transports: ['internal'] }],
    timeout: 60000,
  });
  await redis.set('auth_challenge:' + voterId, options.challenge, 120);
  return options;
}

async function verifyAuthentication(voterId, authResponse) {
  const voter = await db('voters').where({ id: voterId }).first();
  if (!voter) throw new Error('Voter not found');
  const expectedChallenge = await redis.get('auth_challenge:' + voterId);
  if (!expectedChallenge) throw new Error('Challenge expired.');
  const verification = await verifyAuthenticationResponse({
    response: authResponse, expectedChallenge,
    expectedOrigin: ORIGIN, expectedRPID: RP_ID,
    credential: {
      id:        isoBase64URL.toBuffer(voter.webauthn_credential_id),
      publicKey: isoBase64URL.toBuffer(voter.webauthn_public_key),
      counter:   voter.sign_count,
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error('Fingerprint verification failed');
  await db('voters').where({ id: voterId }).update({ sign_count: verification.authenticationInfo.newCounter, last_login: db.fn.now(), updated_at: db.fn.now() });
  await redis.del('auth_challenge:' + voterId);
  return true;
}

module.exports = { getRegistrationOptions, verifyAndStoreCredential, getAuthenticationOptions, verifyAuthentication };