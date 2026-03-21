#!/usr/bin/env node
// ============================================================
// scripts/generate-secrets.js
// Run once to generate cryptographically secure secrets for .env
// Usage: node scripts/generate-secrets.js
// ============================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString('base64');
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

const secrets = {
  JWT_SECRET:                randomHex(32),
  ADMIN_JWT_SECRET:          randomHex(32),
  BIOMETRIC_ENCRYPTION_KEY:  randomBase64(32),  // Must be exactly 32 bytes
  DB_PASSWORD:               randomHex(16),
  REDIS_PASSWORD:            randomHex(16),
};

const envContent = `# ============================================================
# AUTO-GENERATED SECRETS — do not commit this file
# Generated at: ${new Date().toISOString()}
# ============================================================

NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=biometric_voting
DB_USER=postgres
DB_PASSWORD=${secrets.DB_PASSWORD}

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=${secrets.REDIS_PASSWORD}

# JWT
JWT_SECRET=${secrets.JWT_SECRET}
JWT_EXPIRES_IN=10m
ADMIN_JWT_SECRET=${secrets.ADMIN_JWT_SECRET}
ADMIN_JWT_EXPIRES_IN=8h

# Biometric Encryption (AES-256-GCM — 32 bytes base64)
BIOMETRIC_ENCRYPTION_KEY=${secrets.BIOMETRIC_ENCRYPTION_KEY}

# WebAuthn (change RP_ID to your domain in production)
RP_NAME=National Voting System
RP_ID=localhost
ORIGIN=http://localhost:3000

# Face Recognition
FACE_MATCH_THRESHOLD=0.45

# Rate Limiting
MAX_AUTH_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30
`;

const envPath = path.join(__dirname, '..', 'backend', '.env');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env already exists. Saving as .env.new instead.');
  fs.writeFileSync(envPath + '.new', envContent);
  console.log('✅ Secrets written to backend/.env.new');
} else {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Secrets written to backend/.env');
}

console.log('\n🔐 Generated secrets:');
Object.entries(secrets).forEach(([key, val]) => {
  console.log(`   ${key}: ${val.substring(0, 12)}...`);
});

console.log('\n⚠️  IMPORTANT:');
console.log('   1. Never commit .env to version control');
console.log('   2. Change RP_ID to your actual domain in production');
console.log('   3. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) in production');
console.log('   4. The BIOMETRIC_ENCRYPTION_KEY protects all stored biometric data — back it up securely!');
