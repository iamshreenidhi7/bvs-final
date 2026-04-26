// ============================================================
// src/pages/Register.jsx
// Registration: Identity → OTP Verify → Face Enroll → Fingerprint (optional) → Complete
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';
import { useWebAuthn } from '../hooks/useWebAuthn';
import { authAPI } from '../api';

const STEPS = ['Identity', 'Verify OTP', 'Face Enroll', 'Fingerprint', 'Complete'];

export default function Register() {
  const navigate = useNavigate();
  const { registerCredential, isLoading: webauthnLoading, isSupported } = useWebAuthn();

  const [step, setStep] = useState(0);
  const [voterId, setVoterId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpSentTo, setOtpSentTo] = useState(null);
  const [otpSending, setOtpSending] = useState(false);

  const [form, setForm] = useState({
    nationalId: '',
    fullName: '',
    dateOfBirth: '',
    constituency: '',
    email: '',
    phone: '',
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
      // Auto-send OTP after registration
      await handleSendOTP(res.data.voterId);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Send OTP ────────────────────────────────────────────
  async function handleSendOTP(id) {
    setOtpSending(true);
    setError('');
    try {
      const res = await authAPI.sendRegisterOTP(id || voterId);
      setOtpSentTo(res.data.sentTo);
      setSuccess('OTP sent successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  }

  // ── Step 1: Verify OTP ─────────────────────────────────
  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.verifyRegisterOTP(voterId, otpValue);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Face Enrollment ────────────────────────────
  async function handleFaceCaptured(embedding) {
    setError('');
    setLoading(true);
    try {
      await authAPI.enrollFace(voterId, embedding);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Face enrollment failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Fingerprint Enrollment (optional) ──────────
  async function handleFingerprintEnroll() {
    setError('');
    try {
      await registerCredential(voterId);
      await authAPI.markRegistered(voterId);
      setStep(4);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSkipFingerprint() {
    setError('');
    setLoading(true);
    try {
      await authAPI.markRegistered(voterId);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to complete registration');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="text-center mb-6">
          <h1>Voter Registration</h1>
          <p className="mt-2">Register once. Vote securely with biometric verification.</p>
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

        {error   && <div className="alert alert-error mb-4">❌ {error}</div>}
        {success && <div className="alert alert-success mb-4">✅ {success}</div>}

        {/* ── Step 0: Identity ── */}
        {step === 0 && (
          <div className="card">
            <div className="card-header">
              <h3>Personal Information</h3>
              <p className="mt-1">Enter your details exactly as on your official ID</p>
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
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input className="form-input" type="email" name="email" value={form.email}
                    onChange={handleChange} placeholder="For OTP verification" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-input" name="phone" value={form.phone}
                    onChange={handleChange} placeholder="10-digit mobile number" />
                </div>
              </div>
              <div className="note ni mt-2 mb-4" style={{ fontSize: '0.85rem' }}>
                📱 Provide at least one of email or phone to receive your OTP verification code.
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading ? <><span className="spinner" /> Registering...</> : 'Continue →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 1: OTP Verification ── */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3>OTP Verification</h3>
              <p className="mt-1">Enter the 6-digit code sent to your contact details</p>
            </div>

            {otpSentTo && (
              <div className="alert alert-info mb-4">
                📨 OTP sent to:
                {otpSentTo.email && <span> <strong>{otpSentTo.email}</strong></span>}
                {otpSentTo.email && otpSentTo.phone && <span> and</span>}
                {otpSentTo.phone && <span> <strong>{otpSentTo.phone}</strong></span>}
              </div>
            )}

            <form onSubmit={handleVerifyOTP}>
              <div className="form-group">
                <label className="form-label">Enter OTP</label>
                <input
                  className="form-input"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={6}
                  style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
                {loading ? <><span className="spinner" /> Verifying...</> : '✓ Verify OTP'}
              </button>
            </form>

            <div className="text-center mt-4">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Didn't receive the code?{' '}
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleSendOTP()}
                  disabled={otpSending}
                  style={{ marginLeft: 8 }}
                >
                  {otpSending ? 'Sending...' : 'Resend OTP'}
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: Face Enrollment ── */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <h3>Face Enrollment</h3>
              <p className="mt-1">
                ✅ OTP verified. Now enroll your face for biometric authentication.
              </p>
            </div>
            <FaceScanner onCapture={handleFaceCaptured} label="📸 Enroll My Face" />
          </div>
        )}

        {/* ── Step 3: Fingerprint Enrollment ── */}
        {step === 3 && (
          <div className="card text-center">
            <div className="card-header">
              <h3>Fingerprint Enrollment</h3>
              <p className="mt-1">
                ✅ Face enrolled. Optionally add fingerprint for an alternative login method.
              </p>
            </div>

            <div style={{ padding: '24px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>👆</div>

              {!isSupported && (
                <div className="alert alert-warning mb-4">
                  ⚠️ Fingerprint not supported on this browser. You can skip this step.
                </div>
              )}

              <p className="text-muted mb-6">
                Adding a fingerprint lets you log in using your device's Touch ID or Windows Hello
                as an alternative to face scanning.
              </p>

              <div className="flex gap-3" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleFingerprintEnroll}
                  disabled={!isSupported || webauthnLoading}
                >
                  {webauthnLoading
                    ? <><span className="spinner" /> Waiting for fingerprint...</>
                    : '👆 Enroll Fingerprint'}
                </button>
                <button
                  className="btn btn-outline btn-lg"
                  onClick={handleSkipFingerprint}
                  disabled={loading}
                >
                  {loading ? <><span className="spinner spinner-dark" /> Please wait...</> : 'Skip for now →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Complete ── */}
        {step === 4 && (
          <div className="card text-center">
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>✅</div>
              <h2>Registration Complete!</h2>
              <p className="mt-3 mb-6">
                You are fully registered. Login using your National ID with face scan,
                fingerprint, or OTP verification.
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
