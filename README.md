# 🗳️ VoteSecure — Biometric Online Voting System

A production-grade online voting system using **dual biometric authentication** (fingerprint via FIDO2/WebAuthn + facial recognition via face-api.js) to ensure secure, anonymous, and verifiable elections.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (port 3000)                                  │
│  face-api.js · @simplewebauthn/browser · React Router       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS / REST API
┌────────────────────▼────────────────────────────────────────┐
│  Node.js / Express Backend (port 5000)                       │
│  WebAuthn · JWT · AES-256-GCM · Rate Limiting                │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────┐
│  PostgreSQL (5432)   │   │  Redis (6379)        │
│  Voters, Elections   │   │  Sessions, Challenges│
│  Votes, Audit Log    │   │  Token Blacklist     │
└─────────────────────┘   └─────────────────────┘
```

---

## 📁 Project Structure

```
biometric-voting/
├── database/
│   └── schema.sql              # Full PostgreSQL schema
├── backend/
│   ├── server.js               # Express app entry point
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example            # Copy to .env
│   ├── auth-service/
│   │   ├── webauthn.js         # FIDO2/WebAuthn registration & auth
│   │   ├── biometricEncryption.js  # AES-256-GCM face embedding crypto
│   │   └── jwtService.js       # JWT issue/revoke
│   ├── voting-service/
│   │   └── castVote.js         # Anonymous vote casting
│   ├── models/
│   │   ├── db.js               # Knex PostgreSQL connection
│   │   └── redis.js            # Redis client
│   ├── middleware/
│   │   ├── authenticate.js     # JWT voter + admin middleware
│   │   ├── errorHandler.js     # Global error handler
│   │   └── logger.js           # Winston logger
│   ├── routes/
│   │   ├── auth.routes.js      # /api/auth/*
│   │   ├── vote.routes.js      # /api/vote/*
│   │   ├── election.routes.js  # /api/elections/*
│   │   └── admin.routes.js     # /api/admin/*
│   ├── database/
│   │   └── migrate.js          # DB migration runner
│   └── tests/
│       ├── biometricEncryption.test.js
│       ├── castVote.test.js
│       └── jwtService.test.js
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── public/
│   │   ├── index.html
│   │   └── models/             # face-api.js model weights (download separately)
│   └── src/
│       ├── App.jsx             # Root router
│       ├── index.js
│       ├── api.js              # Axios API client
│       ├── context/
│       │   └── AuthContext.js
│       ├── hooks/
│       │   ├── useFaceDetection.js
│       │   └── useWebAuthn.js
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── FaceScanner.jsx
│       │   ├── VotingBooth.jsx
│       │   └── ResultsDashboard.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Register.jsx
│       │   ├── Login.jsx
│       │   ├── Vote.jsx
│       │   ├── Elections.jsx
│       │   ├── Verify.jsx
│       │   └── Admin.jsx
│       └── styles/
│           └── global.css
├── scripts/
│   ├── generate-secrets.js     # Generate .env secrets
│   └── download-face-models.sh # Download face-api.js models
└── docker-compose.yml
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- A device with a fingerprint sensor (for WebAuthn)
- Modern browser (Chrome 80+, Safari 14+, Firefox 60+)

---

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone / extract the project
cd biometric-voting

# 2. Generate secrets
node scripts/generate-secrets.js

# 3. Download face-api.js models
chmod +x scripts/download-face-models.sh
./scripts/download-face-models.sh

# 4. Start all services
docker-compose up --build

# 5. Open browser
open http://localhost:3000
```

---

### Option B: Manual Setup

#### Database
```bash
# Create database
psql -U postgres -c "CREATE DATABASE biometric_voting;"

# Run schema
psql -U postgres -d biometric_voting -f database/schema.sql
```

#### Backend
```bash
cd backend

# Install dependencies
npm install

# Set up environment
node ../scripts/generate-secrets.js
# Then edit backend/.env with your DB/Redis credentials

# Start server
npm run dev
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Download face recognition models
cd .. && ./scripts/download-face-models.sh

# Start dev server
cd frontend && npm start
```

---

## 🔐 Security Architecture

### Dual Biometric Authentication
Every voter must pass **both** checks to receive a voting token:

1. **Fingerprint (WebAuthn/FIDO2)**
   - Uses device's built-in secure enclave
   - Credentials never leave the device
   - Replay-attack prevention via signature counter

2. **Face Recognition (face-api.js)**
   - 128-dimensional face descriptor vector
   - Encrypted at rest with AES-256-GCM
   - Euclidean distance comparison (threshold: 0.45)

### Vote Anonymity
The system separates **who voted** from **what they voted for**:

```
voter_participation table:  { voter_id, election_id, voted_at }   ← WHO voted
votes table:                { candidate_id, vote_hash, cast_at }   ← WHAT was voted
```

These tables have **no foreign key between them**. Even a database administrator cannot link a voter to their choice.

### Voting Token
After authentication, voters receive a **short-lived JWT** (10 minutes) with:
- `scope: "vote_once"` — rejected by any endpoint except vote casting
- Automatically blacklisted in Redis after the vote is cast
- Countdown timer shown in UI

### Vote Receipt
Each vote generates a `SHA-256(election_id + candidate_id + random_salt + timestamp)` hash. Voters can use this to verify their vote was counted without revealing their identity.

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register voter identity |
| POST | `/api/auth/enroll/face` | Store encrypted face embedding |
| GET | `/api/auth/enroll/webauthn/options/:voterId` | Get WebAuthn registration challenge |
| POST | `/api/auth/enroll/webauthn/verify` | Verify and store fingerprint credential |
| POST | `/api/auth/login/start` | Start authentication (get WebAuthn challenge) |
| POST | `/api/auth/login/complete` | Complete dual-biometric login |
| POST | `/api/auth/logout` | Revoke voting token |
| POST | `/api/auth/admin/login` | Admin login |

### Elections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/elections` | List published elections |
| GET | `/api/elections/:id` | Get election with candidates |
| POST | `/api/elections` | Create election (admin) |
| POST | `/api/elections/:id/candidates` | Add candidate (admin) |
| PUT | `/api/elections/:id/activate` | Activate election (admin) |

### Voting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vote/cast` | Cast vote (requires voting JWT) |
| POST | `/api/vote/verify-receipt` | Verify vote receipt hash |
| GET | `/api/vote/results/:id` | Get results (after election ends) |
| GET | `/api/vote/status/:id` | Check if voter has voted |

---

## 👤 User Flow

### Voter Registration (one-time)
```
1. Enter National ID, name, DOB, constituency
2. Face enrollment: webcam capture → 128-D embedding → AES-256 encrypt → store
3. Fingerprint enrollment: WebAuthn prompt → FIDO2 credential → store public key
```

### Voting Day
```
1. Enter National ID → system finds voter
2. Fingerprint scan → WebAuthn verification
3. Face scan → Euclidean distance < 0.45 threshold
4. 10-minute JWT issued
5. Select candidate → confirm → submit
6. Receive SHA-256 receipt hash
7. JWT automatically blacklisted
```

---

## ⚙️ Configuration

Key environment variables in `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `BIOMETRIC_ENCRYPTION_KEY` | AES-256 key for face data (32 bytes base64) | — |
| `FACE_MATCH_THRESHOLD` | Max Euclidean distance for face match | `0.45` |
| `JWT_SECRET` | Voter token signing key | — |
| `MAX_AUTH_ATTEMPTS` | Failed attempts before lockout | `5` |
| `LOCKOUT_DURATION_MINUTES` | Lockout duration | `30` |
| `RP_ID` | WebAuthn relying party domain | `localhost` |

---

## 🧪 Running Tests

```bash
cd backend
npm test
# or with coverage
npm test -- --coverage
```

---

## 🚢 Production Checklist

- [ ] Change `RP_ID` and `ORIGIN` to your production domain
- [ ] Use HTTPS (TLS 1.3) — WebAuthn **requires** HTTPS in production
- [ ] Store `BIOMETRIC_ENCRYPTION_KEY` in a HSM or secrets manager
- [ ] Set up PostgreSQL with SSL enabled
- [ ] Configure Redis with `AUTH` password and TLS
- [ ] Set up log aggregation (e.g., ELK Stack)
- [ ] Enable database backups
- [ ] Rate limit at the load balancer level
- [ ] Run a security audit of WebAuthn RP configuration
- [ ] Conduct penetration testing before going live

---

## ⚖️ Legal & Compliance Notes

- Biometric data storage may be regulated by GDPR, CCPA, or local laws
- Consult a legal expert before deploying for actual elections
- This system is provided for educational purposes
- Election systems require certification by relevant election authorities

---

## 📄 License

MIT License — see LICENSE file.
