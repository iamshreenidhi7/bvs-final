// ============================================================
// src/pages/Elections.jsx
// ============================================================
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { electionsAPI } from '../api';
import ResultsDashboard from '../components/ResultsDashboard';

export default function Elections() {
  const [elections, setElections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    electionsAPI.list()
      .then((r) => setElections(r.data.elections || []))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const active   = elections.filter(e => e.is_active && new Date(e.end_time) > now);
  const upcoming = elections.filter(e => new Date(e.start_time) > now);
  const past     = elections.filter(e => new Date(e.end_time) <= now);

  function ElectionCard({ e }) {
    const isActive  = e.is_active && new Date(e.end_time) > now;
    const isUpcoming = new Date(e.start_time) > now;
    const isPast    = new Date(e.end_time) <= now;

    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            {isActive  && <span className="badge badge-success mr-2">🟢 Active</span>}
            {isUpcoming && <span className="badge badge-info mr-2">📅 Upcoming</span>}
            {isPast    && <span className="badge badge-warning mr-2">✔ Ended</span>}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              {e.election_type?.toUpperCase()}
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {isActive ? `Ends ${new Date(e.end_time).toLocaleString()}` :
             isUpcoming ? `Starts ${new Date(e.start_time).toLocaleString()}` :
             `Ended ${new Date(e.end_time).toLocaleDateString()}`}
          </span>
        </div>

        <h3 style={{ marginTop: 12, marginBottom: 8 }}>{e.title}</h3>
        {e.description && <p style={{ fontSize: '0.9rem', marginBottom: 16 }}>{e.description}</p>}

        <div className="flex gap-2">
          {isActive && (
            <Link to={`/vote?election=${e.id}`} className="btn btn-gold btn-sm">
              🗳️ Vote Now
            </Link>
          )}
          {isPast && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}
            >
              {selectedId === e.id ? '▲ Hide Results' : '📊 View Results'}
            </button>
          )}
        </div>

        {selectedId === e.id && (
          <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
            <ResultsDashboard electionId={e.id} />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page flex-center">
        <span className="spinner spinner-dark" />
        <span className="ml-2">Loading elections...</span>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 800 }}>
        <h1 className="mb-2">Elections</h1>
        <p className="mb-6">All elections — past, present, and upcoming.</p>

        {active.length > 0 && (
          <>
            <h2 className="mb-3" style={{ color: 'var(--success)' }}>🟢 Active Now</h2>
            {active.map(e => <ElectionCard key={e.id} e={e} />)}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <h2 className="mb-3 mt-6" style={{ color: 'var(--info)' }}>📅 Upcoming</h2>
            {upcoming.map(e => <ElectionCard key={e.id} e={e} />)}
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mb-3 mt-6">✔ Past Elections</h2>
            {past.map(e => <ElectionCard key={e.id} e={e} />)}
          </>
        )}

        {elections.length === 0 && (
          <div className="alert alert-info">No elections have been published yet.</div>
        )}
      </div>
    </div>
  );
}
