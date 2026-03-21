// ============================================================
// tests/jwtService.test.js
// ============================================================
process.env.JWT_SECRET = 'test_jwt_secret_32_bytes_for_tests!!';
process.env.ADMIN_JWT_SECRET = 'test_admin_secret_32_bytes_tests!!';

const jwt = require('jsonwebtoken');
const { issueVotingToken, issueAdminToken, decodeToken } = require('../auth-service/jwtService');

const mockVoter = {
  id: 'voter-test-uuid',
  full_name: 'Test Voter',
  national_id: 'TEST123',
};

const mockAdmin = {
  id: 'admin-uuid',
  username: 'admin',
  role: 'superadmin',
};

describe('issueVotingToken', () => {
  test('returns a valid JWT string', () => {
    const token = issueVotingToken(mockVoter);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('token contains correct voter payload', () => {
    const token = issueVotingToken(mockVoter);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.voterId).toBe(mockVoter.id);
    expect(decoded.scope).toBe('vote_once');
    expect(decoded.name).toBe(mockVoter.full_name);
  });

  test('token expires in ~10 minutes', () => {
    const token = issueVotingToken(mockVoter);
    const decoded = jwt.decode(token);
    const ttl = decoded.exp - decoded.iat;
    expect(ttl).toBe(600); // 10 min = 600 seconds
  });

  test('two tokens for same voter are different (different iat)', async () => {
    const t1 = issueVotingToken(mockVoter);
    await new Promise(r => setTimeout(r, 10));
    const t2 = issueVotingToken(mockVoter);
    expect(t1).not.toBe(t2);
  });
});

describe('issueAdminToken', () => {
  test('admin token contains role', () => {
    const token = issueAdminToken(mockAdmin);
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    expect(decoded.role).toBe('superadmin');
    expect(decoded.username).toBe('admin');
  });
});

describe('decodeToken', () => {
  test('decodes without verification', () => {
    const token = issueVotingToken(mockVoter);
    const decoded = decodeToken(token);
    expect(decoded.voterId).toBe(mockVoter.id);
  });

  test('returns null for garbage input', () => {
    const decoded = decodeToken('not.a.token');
    expect(decoded).toBeNull();
  });
});
