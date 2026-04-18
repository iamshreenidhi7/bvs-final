# 🗳️ VoteSecure — Biometric Online Voting System

A production-grade online voting system using **facial recognition** to ensure secure, anonymous, and verifiable elections. No fingerprint sensor required — just a webcam.

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| Frontend | https://bvs-final.netlify.app |
| Backend API | https://biometric-voting-backend.onrender.com |
| Health Check | https://biometric-voting-backend.onrender.com/api/health |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Netlify)                                │
│  face-api.js · Axios · React Router                     │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS REST API
┌────────────────────▼────────────────────────────────────┐
│  Node.js / Express Backend (Render)                      │
│  JWT · AES-256-GCM · Rate Limiting                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  PostgreSQL (Render)                                     │
│  Voters, Elections, Votes, Audit Log                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 How It Works

### Face Recognition Authentication
Every voter must pass face verification to receive a voting token:

- **Face Recognition (face-api.js)** — captures a 128-dimensional face descriptor vector via webcam
- Face embedding is encrypted at rest with **AES-256-GCM**
- Verified using **Euclidean distance** comparison (threshold: 0.45)
- Models loaded from jsDelivr CDN — no local file hosting needed

### Vote Anonymity
The system separates **who voted** from **what they voted for**:

```
voter_participation:  { voter_id, election_id, voted_at }   ← WHO voted
votes:                { candidate_id, vote_hash, cast_at }   ← WHAT was voted
```

These two tables have **no foreign key between them**. Even a database administrator cannot link a voter to their choice.

### Voting Token
After face authentication, voters receive a **short-lived JWT (10 minutes)** with `scope: "vote_once"` — automatically blacklisted after the vote is cast.

### Vote Receipt
Each vote generates a `SHA-256(election_id + candidate_id + random_salt + timestamp)` hash. Voters can verify their vote was counted without revealing their identity.

---

## 📁 Project Structure

```
biometric-voting/
├── database/
│   └── schema.sql                   # Full PostgreSQL schema
├── backend/
│   ├── server.js                    # Express app entry point
│   ├── package.json
│   ├── .env.example                 # Copy to .env
│   ├── auth-service/
│   │   ├── biometricEncryption.js   # AES-256-GCM face embedding crypto
│   │   └── jwtService.js            # JWT issue/revoke
│   ├── voting-service/
│   │   └── castVote.js              # Anonymous vote casting
│   ├── models/
│   │   ├── db.js                    # Knex PostgreSQL connection
│   │   └── redis.js                 # In-memory session store
│   ├── middleware/
│   │   ├── authenticate.js          # JWT voter + admin middleware
│   │   ├── errorHandler.js          # Global error handler
│   │   └── logger.js                # Winston logger
│   └── routes/
│       ├── auth.routes.js           # /api/auth/*
│       ├── vote.routes.js           # /api/vote/*
│       ├── election.routes.js       # /api/elections/*
│       └── admin.routes.js          # /api/admin/*
└── frontend/
    └── src/
        ├── api.js                   # Axios API client
        ├── context/
        │   └── AuthContext.js       # Auth state management
        ├── hooks/
        │   └── useFaceDetection.js  # face-api.js webcam hook
        ├── components/
        │   ├── Navbar.jsx
        │   ├── FaceScanner.jsx      # Live webcam face capture UI
        │   ├── VotingBooth.jsx      # Candidate selection + ballot
        │   └── ResultsDashboard.jsx # Election results charts
        └── pages/
            ├── Home.jsx
            ├── Register.jsx         # Voter registration + face enrollment
            ├── Login.jsx            # Face verification login
            ├── Vote.jsx             # Full voting flow
            ├── Elections.jsx        # Elections listing
            ├── Verify.jsx           # Vote receipt verification
            └── Admin.jsx            # Admin dashboard
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register voter identity |
| POST | `/api/auth/enroll/face` | Store encrypted face embedding |
| POST | `/api/auth/mark-registered` | Mark voter as fully registered |
| POST | `/api/auth/login/start` | Start authentication (get voter info) |
| POST | `/api/auth/login/face` | Verify face and issue voting token |
| POST | `/api/auth/logout` | Revoke voting token |
| POST | `/api/auth/admin/login` | Admin login |

### Elections
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/elections` | List published elections |
| GET | `/api/elections/:id` | Get election with candidates |
| POST | `/api/elections` | Create election (admin only) |
| POST | `/api/elections/:id/candidates` | Add candidate (admin only) |
| PUT | `/api/elections/:id/activate` | Activate election (admin only) |

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
1. Enter National ID, Full Name, Date of Birth, Constituency
2. Allow camera access
3. Face enrollment: webcam capture → 128-D embedding → AES-256 encrypt → store in DB
4. Registration complete — ready to vote
```

### Voting Day
```
1. Enter National ID → system finds voter
2. Face scan → Euclidean distance < 0.45 threshold → verified
3. 10-minute JWT issued
4. Select candidate → confirm → submit vote
5. Receive SHA-256 receipt hash
6. JWT automatically blacklisted after voting
```

### Vote Verification
```
1. Go to /verify
2. Paste your receipt hash
3. System confirms your vote exists in the database
4. Shows election, candidate, and timestamp — without revealing your identity
```

---

## 🔒 Security Architecture

| Layer | Mechanism |
|---|---|
| Biometric Auth | Face Recognition via face-api.js (128-D vectors) |
| Data Encryption | AES-256-GCM for all stored face embeddings |
| Vote Anonymity | Zero link between voter identity and vote choice |
| Anti-Replay | One-time JWT with 10-minute TTL |
| Token Blacklist | In-memory store after vote is cast |
| Double Vote Prevention | DB transaction lock on voter_participation table |
| Transport Security | HTTPS (TLS 1.3) on all endpoints |
| Rate Limiting | 100 requests per 15 minutes globally |
| Account Lockout | 5 failed attempts → 30 minute lockout |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Axios |
| Face Recognition | face-api.js (SSD MobileNet v1 + 128-D FaceNet descriptor) |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 15 |
| ORM | Knex.js |
| Auth | JWT (jsonwebtoken) |
| Encryption | AES-256-GCM (Node.js crypto) |
| Logging | Winston |
| Frontend Hosting | Netlify (free tier) |
| Backend Hosting | Render (free tier) |
| Database Hosting | Render PostgreSQL (free tier) |

---

## 🚀 Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- A device with a webcam

### Setup

```bash
# 1. Generate secrets
node scripts/generate-secrets.js

# 2. Create local database
psql -U postgres -c "CREATE DATABASE voting_system_db;"

# 3. Install backend and run migrations
cd backend
npm install
node database/migrate.js

# 4. Install frontend
cd ../frontend
npm install
```

### Run

Open two terminals:

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# Runs on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start
# Runs on http://localhost:3000
```

---

## ☁️ Deployment

This project is deployed on:

| Service | Platform | Plan |
|---|---|---|
| Frontend | Netlify | Free |
| Backend API | Render Web Service | Free |
| Database | Render PostgreSQL | Free |

### Environment Variables (Backend)

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | Render PostgreSQL internal URL |
| `JWT_SECRET` | 256-bit random secret |
| `ADMIN_JWT_SECRET` | Separate admin JWT secret |
| `BIOMETRIC_ENCRYPTION_KEY` | 32-byte base64 AES key |
| `FACE_MATCH_THRESHOLD` | `0.45` (Euclidean distance) |
| `RP_ID` | Your Netlify domain (no https://) |
| `ORIGIN` | Your Netlify URL (with https://) |
| `FRONTEND_URL` | Your Netlify URL (with https://) |

---

## ⚙️ Admin Access

```
URL:      /admin
Username: admin
Password: admin123
```

> ⚠️ Change the admin password immediately after first login.

To create a new admin password hash:

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('NewPassword123!', 12).then(h => console.log(h));"
```

---

## 📋 Production Checklist

- [ ] Change default admin password
- [ ] Use HTTPS on all endpoints (enforced by Render and Netlify)
- [ ] Store `BIOMETRIC_ENCRYPTION_KEY` securely — if lost, all enrolled biometrics must be re-enrolled
- [ ] Set up database backups on Render
- [ ] Monitor Render logs for failed authentication attempts

---

## ⚖️ Legal Notes

- Biometric data storage may be regulated by GDPR, CCPA, or local laws
- Consult a legal expert before deploying for actual elections
- This system is provided for educational purposes
- Election systems require certification by relevant election authorities

---

## 📄 License

MIT License
