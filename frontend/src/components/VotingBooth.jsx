// ============================================================
// src/components/VotingBooth.jsx
// Candidate selection + confirmation
// ============================================================
import React, { useState } from 'react';

export default function VotingBooth({ candidates, election, onVote, isLoading }) {
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  function handleSelect(candidate) {
    if (confirmed) return;
    setSelected(candidate);
  }

  function handleConfirm() {
    if (!selected) return;
    setConfirmed(true);
  }

  function handleSubmit() {
    if (!selected) return;
    onVote(selected.id);
  }

  if (!confirmed) {
    return (
      <div>
        <div className="card-header">
          <h2>{election.title}</h2>
          <p className="mt-2">Select your candidate. Your vote is secret and cannot be traced back to you.</p>
        </div>

        {!selected && (
          <div className="alert alert-info mb-4">
            👆 Click on a candidate to select them
          </div>
        )}

        <div className="candidates-grid">
          {candidates.map((c) => (
            <div
              key={c.id}
              className={`candidate-card ${selected?.id === c.id ? 'selected' : ''}`}
              onClick={() => handleSelect(c)}
            >
              {selected?.id === c.id && (
                <div className="candidate-selected-badge">✓</div>
              )}
              <span className="candidate-symbol">{c.symbol || '🗳️'}</span>
              <div className="candidate-name">{c.name}</div>
              <div className="candidate-party">{c.party}</div>
              {c.manifesto && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
                  {c.manifesto.substring(0, 80)}{c.manifesto.length > 80 ? '...' : ''}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6" style={{ justifyContent: 'center' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleConfirm}
            disabled={!selected}
          >
            Continue with {selected?.name || 'selected candidate'} →
          </button>
        </div>
      </div>
    );
  }

  // Confirmation screen
  return (
    <div className="text-center">
      <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>⚠️</div>
      <h2>Confirm Your Vote</h2>
      <p className="mt-2 mb-6">This action is <strong>irreversible</strong>. Once submitted, your vote cannot be changed.</p>

      <div className="card" style={{ maxWidth: 400, margin: '0 auto 32px', background: 'linear-gradient(135deg, #fffdf5, #fff8e1)', border: '2px solid var(--gold)' }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: 12 }}>{selected.symbol || '🗳️'}</span>
        <h3 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>
          {selected.name}
        </h3>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{selected.party}</p>
        <div className="badge badge-gold mt-3">Your Selection</div>
      </div>

      <div className="flex gap-3" style={{ justifyContent: 'center' }}>
        <button
          className="btn btn-outline btn-lg"
          onClick={() => setConfirmed(false)}
          disabled={isLoading}
        >
          ← Go Back
        </button>
        <button
          className="btn btn-gold btn-lg"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <><span className="spinner spinner-dark" /> Submitting...</>
          ) : (
            '🗳️ Submit My Vote'
          )}
        </button>
      </div>

      <p className="text-muted mt-4" style={{ fontSize: '0.82rem' }}>
        🔒 Your vote is encrypted and anonymized before storage
      </p>
    </div>
  );
}
