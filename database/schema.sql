-- ============================================================
-- BIOMETRIC VOTING SYSTEM - Complete Database Schema
-- PostgreSQL 15+
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- VOTERS TABLE
-- ============================================================
CREATE TABLE voters (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id             VARCHAR(20) UNIQUE NOT NULL,
  full_name               VARCHAR(100) NOT NULL,
  email                   VARCHAR(150) UNIQUE,
  date_of_birth           DATE NOT NULL,
  constituency            VARCHAR(100) NOT NULL,
  face_embedding          BYTEA,                        -- AES-256 encrypted 128-D vector
  webauthn_credential_id  TEXT,                         -- FIDO2 credential ID
  webauthn_public_key     TEXT,                         -- FIDO2 public key (base64url)
  sign_count              INTEGER DEFAULT 0,            -- WebAuthn replay counter
  is_registered           BOOLEAN DEFAULT FALSE,
  is_active               BOOLEAN DEFAULT TRUE,
  failed_attempts         INTEGER DEFAULT 0,
  locked_until            TIMESTAMP,
  last_login              TIMESTAMP,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_voters_national_id ON voters(national_id);
CREATE INDEX idx_voters_constituency ON voters(constituency);

-- ============================================================
-- ELECTIONS TABLE
-- ============================================================
CREATE TABLE elections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  election_type VARCHAR(50) NOT NULL DEFAULT 'general',   -- general, local, referendum
  constituency  VARCHAR(100),                             -- NULL = national election
  start_time    TIMESTAMP NOT NULL,
  end_time      TIMESTAMP NOT NULL,
  is_active     BOOLEAN DEFAULT FALSE,
  is_published  BOOLEAN DEFAULT FALSE,
  created_by    VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_times CHECK (end_time > start_time)
);

CREATE INDEX idx_elections_active ON elections(is_active, start_time, end_time);

-- ============================================================
-- CANDIDATES TABLE
-- ============================================================
CREATE TABLE candidates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  party       VARCHAR(100),
  symbol      VARCHAR(10),                -- Party/ballot symbol
  manifesto   TEXT,
  photo_url   VARCHAR(500),
  ballot_order INTEGER,                  -- Display order on ballot
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_candidates_election ON candidates(election_id);

-- ============================================================
-- VOTES TABLE (fully anonymized)
-- ============================================================
CREATE TABLE votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   UUID NOT NULL REFERENCES elections(id),
  candidate_id  UUID NOT NULL REFERENCES candidates(id),
  vote_hash     TEXT UNIQUE NOT NULL,    -- Blind signature hash (receipt)
  vote_salt     TEXT NOT NULL,           -- Random salt used in hash
  cast_at       TIMESTAMP DEFAULT NOW(),
  -- No voter_id here â€” votes are anonymous
  CONSTRAINT valid_candidate CHECK (
    candidate_id IN (SELECT id FROM candidates WHERE election_id = votes.election_id)
  )
);

CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_votes_candidate ON votes(candidate_id);

-- ============================================================
-- VOTER PARTICIPATION LOG (WHO voted, NOT for whom)
-- ============================================================
CREATE TABLE voter_participation (
  voter_id    UUID NOT NULL REFERENCES voters(id),
  election_id UUID NOT NULL REFERENCES elections(id),
  voted_at    TIMESTAMP DEFAULT NOW(),
  ip_hash     TEXT,                      -- Hashed IP for audit
  PRIMARY KEY (voter_id, election_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR(50) NOT NULL,      -- REGISTER, LOGIN, VOTE, FAILED_AUTH, etc.
  voter_id    UUID REFERENCES voters(id),
  ip_hash     TEXT,
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_voter ON audit_log(voter_id);
CREATE INDEX idx_audit_event ON audit_log(event_type, created_at);

-- ============================================================
-- SESSIONS TABLE (WebAuthn challenges)
-- ============================================================
CREATE TABLE webauthn_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id    UUID REFERENCES voters(id),
  challenge   TEXT NOT NULL,
  type        VARCHAR(20) NOT NULL,      -- registration or authentication
  expires_at  TIMESTAMP NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ADMIN USERS
-- ============================================================
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) DEFAULT 'admin',  -- admin, superadmin
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Live vote tally (safe to expose â€” no voter info)
CREATE VIEW election_results AS
SELECT
  e.id AS election_id,
  e.title AS election_title,
  c.id AS candidate_id,
  c.name AS candidate_name,
  c.party,
  COUNT(v.id) AS vote_count,
  ROUND(COUNT(v.id) * 100.0 / NULLIF(SUM(COUNT(v.id)) OVER (PARTITION BY e.id), 0), 2) AS percentage
FROM elections e
JOIN candidates c ON c.election_id = e.id
LEFT JOIN votes v ON v.candidate_id = c.id
GROUP BY e.id, e.title, c.id, c.name, c.party
ORDER BY e.id, vote_count DESC;

-- Participation stats
CREATE VIEW participation_stats AS
SELECT
  e.id AS election_id,
  e.title,
  COUNT(DISTINCT vp.voter_id) AS total_votes_cast,
  (SELECT COUNT(*) FROM voters WHERE is_active = TRUE) AS total_registered,
  ROUND(
    COUNT(DISTINCT vp.voter_id) * 100.0 /
    NULLIF((SELECT COUNT(*) FROM voters WHERE is_active = TRUE), 0), 2
  ) AS turnout_percentage
FROM elections e
LEFT JOIN voter_participation vp ON vp.election_id = e.id
GROUP BY e.id, e.title;

-- ============================================================
-- SEED DATA (sample election)
-- ============================================================
INSERT INTO admins (username, password_hash, role)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6oHBP3RVrS', 'superadmin');
-- Password: admin123 (change in production!)

INSERT INTO elections (id, title, description, election_type, start_time, end_time, is_active, is_published, created_by)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'General Election 2025',
  'National General Election for Parliament seats',
  'general',
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '24 hours',
  TRUE,
  TRUE,
  'admin'
);

INSERT INTO candidates (election_id, name, party, symbol, ballot_order) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Arjun Sharma',   'Progressive Alliance',  'ðŸŒŸ', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Priya Nair',     'Democratic Front',      'ðŸŒ¿', 2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Rahul Mehta',    'National Unity Party',  'ðŸ¦', 3),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Kavita Reddy',   'Citizens Coalition',    'âš¡', 4);
