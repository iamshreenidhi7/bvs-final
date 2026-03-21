// ============================================================
// tests/biometricEncryption.test.js
// ============================================================
const {
  encryptEmbedding,
  decryptEmbedding,
  verifyFaceEmbedding,
  euclideanDistance,
  generateEncryptionKey,
} = require('../auth-service/biometricEncryption');

// Generate and set a test key
const testKey = generateEncryptionKey();
process.env.BIOMETRIC_ENCRYPTION_KEY = testKey;
process.env.FACE_MATCH_THRESHOLD = '0.45';

// Helper: generate a random 128-D embedding
function randomEmbedding(seed = 0) {
  return Array.from({ length: 128 }, (_, i) =>
    Math.sin(seed + i) * 0.5
  );
}

describe('Biometric Encryption', () => {
  const embedding = randomEmbedding(42);

  test('encryptEmbedding returns a Buffer', () => {
    const encrypted = encryptEmbedding(embedding);
    expect(Buffer.isBuffer(encrypted)).toBe(true);
    expect(encrypted.length).toBeGreaterThan(128 * 4);
  });

  test('encrypt then decrypt returns original embedding', () => {
    const encrypted = encryptEmbedding(embedding);
    const decrypted = decryptEmbedding(encrypted);
    expect(decrypted).toHaveLength(128);
    decrypted.forEach((val, i) => {
      expect(val).toBeCloseTo(embedding[i], 5);
    });
  });

  test('throws on invalid embedding length', () => {
    expect(() => encryptEmbedding([1, 2, 3])).toThrow();
  });

  test('euclidean distance between identical vectors is 0', () => {
    const dist = euclideanDistance(embedding, embedding);
    expect(dist).toBeCloseTo(0, 5);
  });

  test('euclidean distance between different vectors is non-zero', () => {
    const other = randomEmbedding(99);
    const dist = euclideanDistance(embedding, other);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('Face Verification', () => {
  const trueEmbedding = randomEmbedding(10);

  test('same embedding matches (distance ~0)', () => {
    const encrypted = encryptEmbedding(trueEmbedding);
    const result = verifyFaceEmbedding(encrypted, trueEmbedding);
    expect(result.match).toBe(true);
    expect(result.distance).toBeCloseTo(0, 3);
    expect(result.confidence).toBeGreaterThan(90);
  });

  test('very different embedding does not match', () => {
    const encrypted = encryptEmbedding(trueEmbedding);
    const imposterEmbedding = randomEmbedding(9999);
    const result = verifyFaceEmbedding(encrypted, imposterEmbedding);
    expect(result.match).toBe(false);
  });

  test('slightly noisy embedding still matches', () => {
    const encrypted = encryptEmbedding(trueEmbedding);
    // Add tiny Gaussian-like noise
    const noisyEmbedding = trueEmbedding.map(v => v + (Math.random() - 0.5) * 0.05);
    const result = verifyFaceEmbedding(encrypted, noisyEmbedding);
    expect(result.match).toBe(true);
  });

  test('returns distance and confidence', () => {
    const encrypted = encryptEmbedding(trueEmbedding);
    const result = verifyFaceEmbedding(encrypted, trueEmbedding);
    expect(typeof result.distance).toBe('number');
    expect(typeof result.confidence).toBe('number');
    expect(result.threshold).toBe(0.45);
  });
});
