// ============================================================
// src/pages/Vote.jsx
// Main voting page — election selection + booth
// ============================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VotingBooth from '../components/VotingBooth';
import { electionsAPI, voteAPI } from '../api';

export default function Vote() {
  const { voter, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 min token timer

  // Redirect if not logged in
  useEffect(() => {
    if (!voter || !token) navigate('/login');
  }, [voter, token, navigate]);

  // Countdown timer
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timer); navigate('/login'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [token, navigate]);

  // Load elections
  useEffect(() => {
    async function load() {
      const res = await electionsAPI.list();
      const active = (res.data.elections || []).filter(e => e.is_active);
      setElections(active);

      // Auto-select if election param is in URL
      const preselect = searchParams.get('election');
      if (preselect) {
        const found = active.find(e => e.id === preselect);
        if (found) selectElection(found);
      }
    }
    load();
  }, []);

  async function selectElection(election) {
    setError('');
    setLoading(true);
    try {
      // Check if already voted
      const statusRes = await voteAPI.getStatus(election.id);
      if (statusRes.data.hasVoted) {
        setHasVoted(true);
        setSelectedElection(election);
        setLoading(false);
        return;
      }

      // Load candidates
      const detailRes = await electionsAPI.get(election.id);
      setCandidates(detailRes.data.candidates);
      setSelectedElection(election);
    } catch (err) {
      setError('Failed to load election details');
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(candidateId) {
    setLoading(true);
    setError('');
    try {
      const res = await voteAPI.cast(selectedElection.id, candidateId);
      setReceipt(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Vote submission failed');
    } finally {
      setLoading(false);
    }
  }

  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');
  const timerColor = timeLeft < 120 ? 'var(--danger)' : timeLeft < 300 ? 'var(--warning)' : 'var(--success)';

  // ── Receipt screen ─────────────────────────────────────
  if (receipt) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 580 }}>
          <div className="card text-center">
            <div style={{ padding: '20px 0 32px' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
              <h2>Vote Cast Successfully!</h2>
              <p className="mt-2 mb-6">
                You voted in <strong>{receipt.electionTitle}</strong>
              </p>

              <div className="receipt-box mb-6">
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                  🔗 Your Vote Receipt (SHA-256)
                </div>
                <div className="receipt-hash">{receipt.receiptHash}</div>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                  Save this hash to verify your vote was counted
                </p>
              </div>

              <div className="alert alert-success mb-6" style={{ textAlign: 'left' }}>
                <div>
                  <strong>✅ Vote recorded for: {receipt.candidateName}</strong>
                  <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Cast at: {new Date(receipt.castedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    navigator.clipboard.writeText(receipt.receiptHash);
                    alert('Receipt hash copied to clipboard!');
                  }}
                >
                  📋 Copy Receipt
                </button>
                <button className="btn btn-primary" onClick={() => navigate('/verify')}>
                  Verify Receipt
                </button>
                <button className="btn btn-outline" onClick={() => navigate('/')}>
                  Return Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        {/* Timer banner */}
        <div style={{
          background: 'var(--navy)',
          color: 'var(--white)',
          padding: '10px 20px',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <span>👤 <strong>{voter?.name}</strong> — Authenticated Voter</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: timerColor, fontWeight: 700 }}>
            ⏱️ Session: {minutes}:{seconds}
          </span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Election selection */}
        {!selectedElection && (
          <div>
            <h2 className="mb-4">Active Elections</h2>
            {elections.length === 0 && (
              <div className="alert alert-info">No active elections at this time.</div>
            )}
            <div className="grid-2">
              {elections.map((e) => (
                <div key={e.id} className="card" style={{ cursor: 'pointer' }}
                  onClick={() => selectElection(e)}>
                  <div className="badge badge-success mb-3">🟢 Voting Open</div>
                  <h3 style={{ marginBottom: 8 }}>{e.title}</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: 16 }}>{e.description}</p>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Ends: {new Date(e.end_time).toLocaleString()}</span>
                  </div>
                  <button className="btn btn-primary btn-sm mt-4">Vote in this election →</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already voted */}
        {selectedElection && hasVoted && (
          <div className="card text-center">
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
              <h2>Already Voted</h2>
              <p className="mt-3 mb-6">
                You have already cast your vote in <strong>{selectedElection.title}</strong>.
                Each voter can only vote once per election.
              </p>
              <div className="flex gap-3" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => navigate('/verify')}>
                  Verify Your Vote
                </button>
                <button className="btn btn-outline" onClick={() => { setSelectedElection(null); setHasVoted(false); }}>
                  ← Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Voting booth */}
        {selectedElection && !hasVoted && candidates.length > 0 && (
          <div className="card">
            {loading && !receipt && (
              <div className="flex-center" style={{ padding: 40, gap: 12 }}>
                <span className="spinner spinner-dark" />
                <span>Loading...</span>
              </div>
            )}
            {!loading && (
              <VotingBooth
                candidates={candidates}
                election={selectedElection}
                onVote={handleVote}
                isLoading={loading}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
