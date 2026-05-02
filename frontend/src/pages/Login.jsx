// ============================================================
// src/pages/Login.jsx
// Login flow: Identify → OTP (compulsory) → Face OR Fingerprint → Authenticated
// ============================================================
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FaceScanner from '../components/FaceScanner';
import { useWebAuthn } from '../hooks/useWebAuthn';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';

const STEPS = ['Identify', 'OTP', 'Biometric', 'Authenticated'];

export default function Login() {
  const navigate = useNavigate();
  const { loginVoter } = useAuth();
  const { authenticate: webauthnAuth, isLoading: fingerprintLoading } = useWebAuthn();

  const [step, setStep] = useState(0);
  const [nationalId, setNationalId] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [authMethod, setAuthMethod] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpSentTo, setOtpSentTo] = useState(null);
  const [otpSending, setOtpSending] = useState(false);

  // ── Step 0: Identify voter ─────────────────────────────
  async function handleIdentify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.loginStart(nationalId.trim());
      setSessionData(res.data);
      await sendOTP(res.data.voterId);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Voter not found');
    } finally {
      setLoading(false);
    }
  }

  // ── Send OTP ────────────────────────────────────────────
  async function sendOTP(voterId) {
    setOtpSending(true);
    setError('');
    try {
      const res = await authAPI.sendLoginOTP(voterId || sessionData.voterId);
      setOtpSentTo(res.data.sentTo);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Make sure email/phone is registered.');
    } finally {
      setOtpSending(false);
    }
  }

  // ── Step 1: Verify OTP (compulsory) ───────────────────
  async function handleVerifyOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.verifyLoginOTP(sessionData.voterId, otpValue);
      setSuccess('OTP verified! Now complete biometric verification.');
      setTimeout(() => setSuccess(''), 4000);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2a: Face login ────────────────────────────────
  async function handleFaceCaptured(embedding) {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.loginWithFace(sessionData.voterId, embedding);
      loginVoter(res.data.token, res.data.voter);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Face verification failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2b: Fingerprint login ─────────────────────────
  async function handleFingerprint() {
    setError('');
    setAuthMethod('fingerprint');
    try {
      const authResponse = await webauthnAuth(sessionData.webauthnOptions);
      const res = await authAPI.loginWithFingerprint(sessionData.voterId, authResponse);
      loginVoter(res.data.token, res.data.voter);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Fingerprint verification failed');
      setAuthMethod(null);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 580 }}>
        <div className="text-center mb-6">
          <h1>Voter Login</h1>
          <p className="mt-2">Two-step verification required to access your ballot</p>
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
              <p className="mt-1">An OTP will be sent to your registered email and phone</p>
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
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || otpSending}
              >
                {loading || otpSending
                  ? <><span className="spinner" /> {otpSending ? 'Sending OTP...' : 'Looking up...'}</>
                  : 'Continue & Send OTP →'}
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

        {/* ── Step 1: OTP (compulsory) ── */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3>📱 OTP Verification</h3>
              <p className="mt-1">
                Welcome, <strong>{sessionData?.voterName}</strong>. Enter the 6-digit code sent to you.
              </p>
            </div>

            {otpSentTo && (
              <div className="alert alert-info mb-4">
                📨 OTP sent to:
                {otpSentTo.email && <span> <strong>{otpSentTo.email}</strong></span>}
                {otpSentTo.email && otpSentTo.phone && <span> and</span>}
                {otpSentTo.phone && <span> <strong>{otpSentTo.phone}</strong></span>}
              </div>
            )}

            <div style={{
              background: 'rgba(10,22,40,0.04)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}>
              🔒 OTP verification is <strong>required</strong> for all logins to protect your account.
            </div>

            <form onSubmit={handleVerifyOTP}>
              <div className="form-group">
                <label className="form-label">Enter 6-digit OTP</label>
                <input
                  className="form-input"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  maxLength={6}
                  style={{
                    fontSize: '1.8rem',
                    letterSpacing: '0.6rem',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                  }}
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || otpValue.length < 6}
              >
                {loading
                  ? <><span className="spinner" /> Verifying...</>
                  : '✓ Verify OTP & Continue'}
              </button>
            </form>

            <div className="text-center mt-4" style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => sendOTP()}
                disabled={otpSending}
              >
                {otpSending ? 'Sending...' : '🔄 Resend OTP'}
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setStep(0); setOtpValue(''); setError(''); }}
              >
                ← Change ID
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Choose biometric method ── */}
        {step === 2 && !authMethod && (
          <div className="card">
            <div className="card-header">
              <h3>✅ OTP Verified</h3>
              <p className="mt-1">Choose your biometric verification method</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>

              {/* Face option */}
              {sessionData?.hasFace && (
                <button
                  onClick={() => setAuthMethod('face')}
                  style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                    background: 'var(--white)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--navy-mid)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: '2.5rem' }}>👁️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem' }}>
                      Face Recognition
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Scan your face using the camera
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>→</span>
                </button>
              )}

              {/* Fingerprint option */}
              {sessionData?.hasFingerprint && (
                <button
                  onClick={handleFingerprint}
                  style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border)',
                    background: 'var(--white)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--navy-mid)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <span style={{ fontSize: '2.5rem' }}>👆</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem' }}>
                      Fingerprint / Touch ID
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Use your device's biometric sensor
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>→</span>
                </button>
              )}

              {/* If neither enrolled */}
              {!sessionData?.hasFace && !sessionData?.hasFingerprint && (
                <div className="alert alert-warning">
                  ⚠️ No biometric enrolled. Please complete registration first.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Face scan screen ── */}
        {step === 2 && authMethod === 'face' && (
          <div className="card">
            <div className="card-header">
              <h3>👁️ Face Verification</h3>
              <p className="mt-1">Position your face in the oval to verify</p>
            </div>
            <FaceScanner onCapture={handleFaceCaptured} label="🔓 Verify My Face" />
            {loading && (
              <div className="alert alert-info mt-3">
                <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                &nbsp; Verifying identity...
              </div>
            )}
            <button
              className="btn btn-outline btn-sm mt-3"
              onClick={() => { setAuthMethod(null); setError(''); }}
            >
              ← Back to options
            </button>
          </div>
        )}

        {/* ── Fingerprint waiting screen ── */}
        {step === 2 && authMethod === 'fingerprint' && (
          <div className="card text-center">
            <div style={{ padding: '32px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>👆</div>
              <h3>Fingerprint Verification</h3>
              <p className="text-muted mt-2 mb-6">
                {fingerprintLoading
                  ? 'Waiting for your fingerprint...'
                  : 'Touch your fingerprint sensor or use Windows Hello / Touch ID'}
              </p>
              {fingerprintLoading && <span className="spinner spinner-dark" />}
              <br />
              <button
                className="btn btn-outline btn-sm mt-4"
                onClick={() => { setAuthMethod(null); setError(''); }}
              >
                ← Back to options
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Authenticated ── */}
        {step === 3 && (
          <div className="card text-center">
            <div style={{ padding: '40px 20px' }}>
              <div style={{ fontSize: '5rem', marginBottom: 16 }}>🗳️</div>
              <h2 style={{ color: 'var(--success)' }}>Authenticated!</h2>
              <p className="mt-3 mb-2">
                Welcome, <strong>{sessionData?.voterName}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', margin: '16px 0' }}>
                <span className="badge badge-success">✅ OTP Verified</span>
                <span className="badge badge-info">
                  {authMethod === 'fingerprint' ? '✅ Fingerprint Verified' : '✅ Face Verified'}
                </span>
              </div>
              <div className="alert alert-warning mt-3 mb-6" style={{ textAlign: 'left' }}>
                ⏱️ <strong>Your voting session expires in 10 minutes.</strong> Cast your vote promptly.
              </div>
              <button
                className="btn btn-gold btn-lg btn-full"
                onClick={() => navigate('/vote')}
              >
                Proceed to Vote →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
