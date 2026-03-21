// ============================================================
// src/components/ResultsDashboard.jsx
// Live/final election results with animated bars
// ============================================================
import React, { useEffect, useState } from 'react';
import { voteAPI } from '../api';

export default function ResultsDashboard({ electionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await voteAPI.getResults(electionId);
        setData(res.data);
        setTimeout(() => setAnimated(true), 100);
      } catch (err) {
        setError(err.response?.data?.error || 'Results not available yet');
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
    // Refresh every 30 seconds if election is still active
    const interval = setInterval(fetchResults, 30000);
    return () => clearInterval(interval);
  }, [electionId]);

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: 40, gap: 12 }}>
        <span className="spinner spinner-dark" />
        <span className="text-muted">Loading results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning">
        🔒 {error}
      </div>
    );
  }

  const { election, results, participation } = data;
  const winner = results?.[0];
  const totalVotes = results?.reduce((sum, r) => sum + parseInt(r.vote_count), 0) || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-6" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>{election.title}</h2>
          <p className="mt-1">
            Final results as of {new Date(election.endTime).toLocaleString()}
          </p>
        </div>
        {winner && (
          <div style={{
            background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
            color: 'var(--navy)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}>
            🏆 Winner: {winner.candidate_name}
          </div>
        )}
      </div>

      {/* Participation stats */}
      {participation && (
        <div className="grid-3 mb-6">
          {[
            { label: 'Total Votes Cast', value: participation.total_votes_cast?.toLocaleString() },
            { label: 'Registered Voters', value: participation.total_registered?.toLocaleString() },
            { label: 'Voter Turnout', value: `${participation.turnout_percentage}%` },
          ].map((stat) => (
            <div key={stat.label} className="card text-center" style={{ padding: '20px 16px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-display)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results bars */}
      <div className="card">
        <div className="card-header">
          <h3>Vote Distribution</h3>
        </div>
        {results?.map((r, i) => {
          const pct = totalVotes > 0 ? parseFloat(r.percentage) : 0;
          const isWinner = i === 0;
          return (
            <div key={r.candidate_id} className="result-bar-wrapper" style={{ marginBottom: 24 }}>
              <div className="result-bar-label">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isWinner && <span>🏆</span>}
                  <strong style={{ color: 'var(--navy)' }}>{r.candidate_name}</strong>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{r.party}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {parseInt(r.vote_count).toLocaleString()} votes
                  </span>
                  <strong style={{ color: isWinner ? 'var(--gold-dark)' : 'var(--navy)', minWidth: 48, textAlign: 'right' }}>
                    {pct}%
                  </strong>
                </div>
              </div>
              <div className="result-bar-track">
                <div
                  className={`result-bar-fill ${isWinner ? 'winner' : ''}`}
                  style={{ width: animated ? `${pct}%` : '0%' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
