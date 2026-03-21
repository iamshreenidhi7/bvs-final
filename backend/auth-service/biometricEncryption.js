// ============================================================
// auth-service/biometricEncryption.js
// AES-256-GCM encryption for biometric templates
// ============================================================
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Get or derive the encryption key from env
 */
function getEncryptionKey() {
  const keyBase64 = process.env.BIOMETRIC_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('BIOMETRIC_ENCRYPTION_KEY not set in environment');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Encryption key must be ${KEY_LENGTH} bytes`);
  }
  return key;
}

/**
 * Encrypt a face embedding (Float32Array as JSON) → Buffer
 * Format: [IV (16 bytes)] + [AuthTag (16 bytes)] + [Ciphertext]
 */
function encryptEmbedding(embeddingArray) {
  if (!Array.isArray(embeddingArray) || embeddingArray.length !== 128) {
    throw new Error('Face embedding must be an array of 128 floats');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = Buffer.from(JSON.stringify(embeddingArray));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Concatenate: IV + Tag + Ciphertext
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt stored biometric template → Float32Array
 */
function decryptEmbedding(encryptedBuffer) {
  if (!Buffer.isBuffer(encryptedBuffer)) {
    encryptedBuffer = Buffer.from(encryptedBuffer);
  }

  const key = getEncryptionKey();
  const iv = encryptedBuffer.slice(0, IV_LENGTH);
  const tag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encryptedBuffer.slice(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString());
}

/**
 * Compute Euclidean distance between two 128-D vectors
 */
function euclideanDistance(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Compare a live face embedding against the stored encrypted template
 * @returns {Object} { match: boolean, distance: number, confidence: number }
 */
function verifyFaceEmbedding(storedEncrypted, liveEmbedding) {
  const threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD) || 0.45;

  const storedEmbedding = decryptEmbedding(storedEncrypted);
  const distance = euclideanDistance(storedEmbedding, liveEmbedding);

  // Confidence: 0-100%, higher = better match
  const confidence = Math.max(0, Math.round((1 - distance / threshold) * 100));

  return {
    match: distance < threshold,
    distance: parseFloat(distance.toFixed(4)),
    confidence,
    threshold,
  };
}

/**
 * Generate a secure random encryption key (utility - run once)
 */
function generateEncryptionKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

module.exports = {
  encryptEmbedding,
  decryptEmbedding,
  verifyFaceEmbedding,
  euclideanDistance,
  generateEncryptionKey,
};
