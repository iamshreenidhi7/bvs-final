// ============================================================
// src/pages/Verify.jsx
// Verify a vote receipt hash
// ============================================================
import React, { useState } from 'react';
import { voteAPI } from '../api';

export default function Verify() {
  const [hash, setHash] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await voteAPI.verifyReceipt(hash.trim());
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="text-center mb-6">
          <h1>Verify Your Vote</h1>
          <p className="mt-2">
            Enter your vote receipt hash to confirm your vote was recorded correctly.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label className="form-label">Vote Receipt Hash (SHA-256)</label>
              <textarea
                className="form-input"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Paste your 64-character receipt hash here..."
                rows={3}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', resize: 'vertical' }}
                required
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                You received this hash after casting your vote. Keep it private — it proves you voted but does not reveal your choice to others.
              </p>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || hash.length < 10}>
              {loading ? <><span className="spinner" /> Verifying...</> : '🔍 Verify Receipt'}
            </button>
          </form>
        </div>

        {error && (
          <div className="alert alert-error mt-4">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="card mt-4">
            {result.valid ? (
              <div className="text-center">
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                <h3 style={{ color: 'var(--success)', marginBottom: 16 }}>Vote Verified!</h3>
                <table className="table" style={{ textAlign: 'left' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, color: 'var(--navy)' }}>Election</td>
                      <td>{result.election}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: 'var(--navy)' }}>Candidate</td>
                      <td>{result.candidate}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: 'var(--navy)' }}>Party</td>
                      <td>{result.party || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: 'var(--navy)' }}>Cast At</td>
                      <td>{new Date(result.castedAt).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="alert alert-info mt-4" style={{ textAlign: 'left' }}>
                  🔒 This verification proves your vote exists in the system without revealing your voter identity.
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>❌</div>
                <h3 style={{ color: 'var(--danger)' }}>Receipt Not Found</h3>
                <p className="mt-2">{result.message}</p>
                <p className="mt-3" style={{ fontSize: '0.85rem' }}>
                  If you believe this is an error, contact your election authority with your receipt hash.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
