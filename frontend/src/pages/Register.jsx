// ============================================================
// src/pages/Register.jsx
// Voter registration + biometric enrollment
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';
import { useWebAuthn } from '../hooks/useWebAuthn';
import { authAPI } from '../api';

const STEPS = ['Identity', 'Face Enroll', 'Fingerprint', 'Complete'];

export default function Register() {
  const navigate = useNavigate();
  const { registerCredential, isLoading: webauthnLoading, isSupported } = useWebAuthn();

  const [step, setStep] = useState(0);
  const [voterId, setVoterId] = useState(null);
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nationalId: '', fullName: '', dateOfBirth: '', constituency: '', email: '',
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // ── Step 0: Register Identity ──────────────────────────
  async function handleIdentitySubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      setVoterId(res.data.voterId);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: Face Enrollment ────────────────────────────
  async function handleFaceCaptured(embedding) {
    setError('');
    setLoading(true);
    try {
      await authAPI.enrollFace(voterId, embedding);
      setFaceEmbedding(embedding);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Face enrollment failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: WebAuthn Fingerprint Enrollment ────────────
  async function handleFingerprintEnroll() {
    setError('');
    try {
      const result = await registerCredential(voterId);
      if (result.fullyEnrolled) {
        setStep(3);
      } else {
        setError('Enrollment incomplete. Please try again.');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="text-center mb-6">
          <h1>Voter Registration</h1>
          <p className="mt-2">Register once. Vote securely with your biometrics.</p>
        </div>

        {/* Steps indicator */}
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

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── Step 0: Identity ── */}
        {step === 0 && (
          <div className="card">
            <div className="card-header">
              <h3>Personal Information</h3>
              <p className="mt-1">Enter your details exactly as they appear on your official ID</p>
            </div>
            <form onSubmit={handleIdentitySubmit}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">National ID *</label>
                  <input className="form-input" name="nationalId" value={form.nationalId}
                    onChange={handleChange} placeholder="e.g. IND123456789" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" name="fullName" value={form.fullName}
                    onChange={handleChange} placeholder="As on official ID" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input className="form-input" type="date" name="dateOfBirth"
                    value={form.dateOfBirth} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Constituency *</label>
                  <input className="form-input" name="constituency" value={form.constituency}
                    onChange={handleChange} placeholder="Your constituency" required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" name="email" value={form.email}
                    onChange={handleChange} placeholder="For notifications (optional)" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full mt-3" disabled={loading}>
                {loading ? <><span className="spinner" /> Registering...</> : 'Continue →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 1: Face Enrollment ── */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3>Face Enrollment</h3>
              <p className="mt-1">
                We'll capture your face to verify your identity when voting.
                Your biometric data is encrypted with AES-256.
              </p>
            </div>
            <FaceScanner onCapture={handleFaceCaptured} label="📸 Enroll My Face" />
          </div>
        )}

        {/* ── Step 2: Fingerprint Enrollment ── */}
        {step === 2 && (
          <div className="card text-center">
            <div className="card-header">
              <h3>Fingerprint Enrollment</h3>
              <p className="mt-1">
                Register your fingerprint using your device's built-in sensor.
                This uses the FIDO2/WebAuthn standard.
              </p>
            </div>

            <div style={{ padding: '32px 0' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>👆</div>

              {!isSupported && (
                <div className="alert alert-warning">
                  ⚠️ WebAuthn is not supported on this browser. Please use Chrome, Safari, or Firefox on a device with a fingerprint sensor.
                </div>
              )}

              <p className="text-muted mb-6">
                When you click below, your browser will prompt you to use your fingerprint sensor or device PIN.
              </p>

              <button
                className="btn btn-primary btn-lg"
                onClick={handleFingerprintEnroll}
                disabled={!isSupported || webauthnLoading}
              >
                {webauthnLoading
                  ? <><span className="spinner" /> Waiting for fingerprint...</>
                  : '👆 Register Fingerprint'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Complete ── */}
        {step === 3 && (
          <div className="card text-center">
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>✅</div>
              <h2>Registration Complete!</h2>
              <p className="mt-3 mb-6">
                You're now registered to vote. On election day, log in with your National ID
                and verify your identity with your fingerprint and face.
              </p>
              <div className="flex gap-3" style={{ justifyContent: 'center' }}>
                <button className="btn btn-gold btn-lg" onClick={() => navigate('/login')}>
                  Login to Vote →
                </button>
                <button className="btn btn-outline" onClick={() => navigate('/')}>
                  Return Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
