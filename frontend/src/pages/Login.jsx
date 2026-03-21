// ============================================================
// src/pages/Login.jsx
// Dual biometric authentication flow
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';
import { useWebAuthn } from '../hooks/useWebAuthn';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

const STEPS = ['Identify', 'Fingerprint', 'Face Scan', 'Authenticated'];

export default function Login() {
  const navigate = useNavigate();
  const { loginVoter } = useAuth();
  const { authenticate: webauthnAuth, isLoading: fingerprintLoading } = useWebAuthn();

  const [step, setStep] = useState(0);
  const [nationalId, setNationalId] = useState('');
  const [sessionData, setSessionData] = useState(null); // { voterId, voterName, webauthnOptions }
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const [webauthnResponse, setWebauthnResponse] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Step 0: Enter National ID ──────────────────────────
  async function handleIdentify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.loginStart(nationalId.trim());
      setSessionData(res.data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Voter not found');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: Fingerprint ────────────────────────────────
  async function handleFingerprint() {
    setError('');
    try {
      const response = await webauthnAuth(sessionData.webauthnOptions);
      setWebauthnResponse(response);
      setStep(2);
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Step 2: Face Captured → Complete Login ─────────────
  async function handleFaceCaptured(embedding) {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.loginComplete(
        sessionData.voterId,
        webauthnResponse,
        embedding
      );
      loginVoter(res.data.token, res.data.voter);
      setFaceEmbedding(embedding);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
      // Don't advance step — let user retry face scan
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 580 }}>
        <div className="text-center mb-6">
          <h1>Voter Login</h1>
          <p className="mt-2">Two biometric factors required to authenticate</p>
        </div>

        {/* Steps */}
        <div className="steps mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="step">
                <div className={`step-circle ${i < step ? 'completed' : i === step ? 'active' : 'pending'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`step-label ${i === step ? 'active' : ''}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < step ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="alert alert-error">
            ❌ {error}
            {error.includes('locked') && (
              <p style={{ marginTop: 4, fontSize: '0.85rem' }}>
                Contact your election authority if you believe this is an error.
              </p>
            )}
          </div>
        )}

        {/* ── Step 0: National ID ── */}
        {step === 0 && (
          <div className="card">
            <div className="card-header">
              <h3>Enter Your Voter ID</h3>
            </div>
            <form onSubmit={handleIdentify}>
              <div className="form-group">
                <label className="form-label">National ID</label>
                <input
                  className="form-input"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  placeholder="e.g. IND123456789"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading ? <><span className="spinner" /> Looking up...</> : 'Continue →'}
              </button>
            </form>
            <p className="text-center mt-4" style={{ fontSize: '0.9rem' }}>
              Not registered?{' '}
              <a href="/register" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>
                Register here
              </a>
            </p>
          </div>
        )}

        {/* ── Step 1: Fingerprint ── */}
        {step === 1 && (
          <div className="card text-center">
            <div className="card-header">
              <h3>Fingerprint Verification</h3>
              <p className="mt-1">Welcome, <strong>{sessionData?.voterName}</strong></p>
            </div>
            <div style={{ padding: '32px 0' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>👆</div>
              <p className="text-muted mb-6">
                Place your finger on the sensor. Your browser will prompt for biometric verification.
              </p>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleFingerprint}
                disabled={fingerprintLoading}
              >
                {fingerprintLoading
                  ? <><span className="spinner" /> Verifying...</>
                  : '👆 Scan Fingerprint'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Face Scan ── */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <h3>Face Verification</h3>
              <p className="mt-1">
                ✅ Fingerprint verified. Now confirm with your face.
              </p>
            </div>
            <FaceScanner onCapture={handleFaceCaptured} label="🔓 Verify My Face" />
            {loading && (
              <div className="alert alert-info mt-3">
                <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                Verifying identity...
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 3 && (
          <div className="card text-center">
            <div style={{ padding: '40px 20px' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>🗳️</div>
              <h2 style={{ color: 'var(--success)' }}>Authenticated!</h2>
              <p className="mt-3 mb-2">
                Welcome, <strong>{sessionData?.voterName}</strong>
              </p>
              <div className="alert alert-warning mt-3 mb-6" style={{ textAlign: 'left' }}>
                ⏱️ <strong>Your voting session expires in 10 minutes.</strong> Cast your vote promptly.
              </div>
              <button className="btn btn-gold btn-lg btn-full" onClick={() => navigate('/vote')}>
                Proceed to Vote →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
