// ============================================================
// src/pages/Admin.jsx
// Admin dashboard
// ============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminAPI, authAPI } from '../api';

export default function Admin() {
  const { isAdmin, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [voters, setVoters] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin login form state
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) loadDashboard();
  }, [isAdmin]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await adminAPI.dashboard();
      setStats(res.data.stats);
      setRecentActivity(res.data.recentActivity);
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function loadVoters() {
    const res = await adminAPI.voters();
    setVoters(res.data.voters || []);
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await authAPI.adminLogin(credentials.username, credentials.password);
      loginAdmin(res.data.token);
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Admin Login Screen ─────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 420 }}>
          <div className="text-center mb-6">
            <h1>Admin Login</h1>
            <p className="mt-2">Election Authority Access</p>
          </div>
          {loginError && <div className="alert alert-error">{loginError}</div>}
          <div className="card">
            <form onSubmit={handleAdminLogin}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={credentials.username}
                  onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                  required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={credentials.password}
                  onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                  required />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loginLoading}>
                {loginLoading ? <><span className="spinner" /> Logging in...</> : '🔐 Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin Dashboard ────────────────────────────────────
  return (
    <div className="page">
      <div className="container">
        <div className="flex-between mb-6">
          <h1>Admin Dashboard</h1>
          <div className="badge badge-gold">⚙️ Election Authority</div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['dashboard', 'voters', 'activity'].map(t => (
            <button key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => { setTab(t); if (t === 'voters') loadVoters(); }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Dashboard tab */}
        {tab === 'dashboard' && (
          <div>
            {loading ? (
              <div className="flex-center" style={{ padding: 40 }}>
                <span className="spinner spinner-dark" />
              </div>
            ) : (
              <>
                <div className="grid-3 mb-6">
                  {stats && [
                    { icon: '👥', label: 'Registered Voters', value: stats.totalVoters?.toLocaleString() },
                    { icon: '📋', label: 'Total Elections',   value: stats.totalElections },
                    { icon: '🗳️', label: 'Votes Cast',        value: stats.totalVotesCast?.toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="card text-center">
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>{s.icon}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {stats?.activeElections > 0 && (
                  <div className="alert alert-success mb-4">
                    🟢 <strong>{stats.activeElections}</strong> election(s) currently active
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Voters tab */}
        {tab === 'voters' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>National ID</th>
                  <th>Name</th>
                  <th>Constituency</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {voters.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{v.national_id}</td>
                    <td style={{ fontWeight: 600 }}>{v.full_name}</td>
                    <td>{v.constituency}</td>
                    <td>
                      {v.is_registered
                        ? <span className="badge badge-success">✅ Enrolled</span>
                        : <span className="badge badge-warning">⏳ Pending</span>}
                      {!v.is_active && <span className="badge badge-danger ml-1">🚫 Inactive</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {v.last_login ? new Date(v.last_login).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {voters.length === 0 && (
              <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
                No voters found
              </div>
            )}
          </div>
        )}

        {/* Activity tab */}
        {tab === 'activity' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Voter ID</th>
                  <th>Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((a, i) => {
                  const meta = a.metadata ? JSON.parse(a.metadata) : {};
                  const eventColor = {
                    VOTE_CAST: 'badge-success',
                    LOGIN_SUCCESS: 'badge-info',
                    FAILED_FINGERPRINT: 'badge-danger',
                    FAILED_FACE: 'badge-danger',
                    VOTER_REGISTERED: 'badge-gold',
                  }[a.event_type] || 'badge-warning';

                  return (
                    <tr key={i}>
                      <td><span className={`badge ${eventColor}`}>{a.event_type}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.voter_id?.substring(0, 8)}...
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {meta.face_confidence ? `Face: ${meta.face_confidence}%` :
                         meta.error ? meta.error.substring(0, 40) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
