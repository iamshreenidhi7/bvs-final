// ============================================================
// src/pages/Login.jsx
// Login: Identify → Choose method (Face / Fingerprint / OTP) → Authenticated
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';
import { useWebAuthn } from '../hooks/useWebAuthn';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

const STEPS = ['Identify', 'Verify', 'Authenticated'];

export default function Login() {
  const navigate = useNavigate();
  const { loginVoter } = useAuth();
  const { authenticate: webauthnAuth, isLoading: fingerprintLoading } = useWebAuthn();

  const [step, setStep] = useState(0);
  const [nationalId, setNationalId] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [authMethod, setAuthMethod] = useState(null); // 'face' | 'fingerprint' | 'otp'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpSentTo, setOtpSentTo] = useState(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // ── Step 0: Identify voter ─────────────────────────────
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

  // ── Send OTP ────────────────────────────────────────────
  async function handleSendOTP() {
    setOtpSending(true);
    setError('');
    try {
      const res = await authAPI.sendLoginOTP(sessionData.voterId);
      setOtpSentTo(res.data.sentTo);
      setSuccess('OTP sent!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  }

  // ── Verify OTP ─────────────────────────────────────────
  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.verifyLoginOTP(sessionData.voterId, otpValue);
      setOtpVerified(true);
      setSuccess('OTP verified! Now scan your face to complete login.');
      setTimeout(() => setSuccess(''), 4000);
      // After OTP, redirect to face scan
      setAuthMethod('face_after_otp');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  // ── Face login ─────────────────────────────────────────
  async function handleFaceCaptured(embedding) {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.loginWithFace(sessionData.voterId, embedding);
      loginVoter(res.data.token, res.data.voter);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Face verification failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Fingerprint login ──────────────────────────────────
  async function handleFingerprint() {
    setError('');
    try {
      const authResponse = await webauthnAuth(sessionData.webauthnOptions);
      const res = await authAPI.loginWithFingerprint(sessionData.voterId, authResponse);
      loginVoter(res.data.token, res.data.voter);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Fingerprint verification failed');
    }
  }

  // ── Select OTP method ──────────────────────────────────
  async function handleSelectOTP() {
    setAuthMethod('otp');
    await handleSendOTP();
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 580 }}>
        <div className="text-center mb-6">
          <h1>Voter Login</h1>
          <p className="mt-2">Verify your identity to access your ballot</p>
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

        {/* ── Step 1: Choose auth method ── */}
        {step === 1 && !authMethod && (
          <div className="card">
            <div className="card-header">
              <h3>Welcome, {sessionData?.voterName}</h3>
              <p className="mt-1">Choose how you want to verify your identity</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
              {/* Face option */}
              {sessionData?.hasFace && (
                <button
                  className="btn btn-outline"
                  onClick={() => setAuthMethod('face')}
                  style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>👁️</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem' }}>
                      Face Recognition
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Scan your face using the camera
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>→</span>
                </button>
              )}

              {/* Fingerprint option */}
              {sessionData?.hasFingerprint && (
                <button
                  className="btn btn-outline"
                  onClick={() => { setAuthMethod('fingerprint'); handleFingerprint(); }}
                  style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '2rem' }}>👆</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem' }}>
                      Fingerprint / Touch ID
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Use your device's biometric sensor
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>→</span>
                </button>
              )}

              {/* OTP option */}
              <button
                className="btn btn-outline"
                onClick={handleSelectOTP}
                disabled={otpSending}
                style={{
                  padding: '20px 24px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '2rem' }}>📱</span>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem' }}>
                    OTP Verification
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {otpSending ? 'Sending OTP...' : 'Receive a code via email or SMS'}
                  </div>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Face scan ── */}
        {step === 1 && (authMethod === 'face' || authMethod === 'face_after_otp') && (
          <div className="card">
            <div className="card-header">
              <h3>
                {authMethod === 'face_after_otp'
                  ? '✅ OTP Verified — Now Scan Your Face'
                  : 'Face Verification'}
              </h3>
              <p className="mt-1">Position your face in the oval to verify</p>
            </div>
            <FaceScanner onCapture={handleFaceCaptured} label="🔓 Verify My Face" />
            {loading && (
              <div className="alert alert-info mt-3">
                <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                Verifying identity...
              </div>
            )}
            <button
              className="btn btn-outline btn-sm mt-3"
              onClick={() => { setAuthMethod(null); setError(''); }}
            >
              ← Back to methods
            </button>
          </div>
        )}

        {/* ── Fingerprint waiting ── */}
        {step === 1 && authMethod === 'fingerprint' && (
          <div className="card text-center">
            <div style={{ padding: '32px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>👆</div>
              <h3>Fingerprint Verification</h3>
              <p className="text-muted mt-2 mb-6">
                {fingerprintLoading
                  ? 'Waiting for your fingerprint...'
                  : 'Touch your fingerprint sensor or use Windows Hello'}
              </p>
              {fingerprintLoading && <span className="spinner spinner-dark" />}
              <br />
              <button
                className="btn btn-outline btn-sm mt-4"
                onClick={() => { setAuthMethod(null); setError(''); }}
              >
                ← Back to methods
              </button>
            </div>
          </div>
        )}

        {/* ── OTP entry ── */}
        {step === 1 && authMethod === 'otp' && !otpVerified && (
          <div className="card">
            <div className="card-header">
              <h3>OTP Verification</h3>
              <p className="mt-1">Enter the 6-digit code sent to you</p>
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
              <button
                className="btn btn-outline btn-sm"
                onClick={handleSendOTP}
                disabled={otpSending}
                style={{ marginRight: 8 }}
              >
                {otpSending ? 'Sending...' : 'Resend OTP'}
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setAuthMethod(null); setError(''); }}
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Authenticated ── */}
        {step === 2 && (
          <div className="card text-center">
            <div style={{ padding: '40px 20px' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>🗳️</div>
              <h2 style={{ color: 'var(--success)' }}>Authenticated!</h2>
              <p className="mt-3 mb-2">Welcome, <strong>{sessionData?.voterName}</strong></p>
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
