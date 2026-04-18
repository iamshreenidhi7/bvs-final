// ============================================================
// src/pages/Home.jsx
// ============================================================
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { electionsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { voter } = useAuth();
  const [elections, setElections] = useState([]);

  useEffect(() => {
    electionsAPI.list().then((r) => setElections(r.data.elections || [])).catch(() => {});
  }, []);

  const activeElections = elections.filter(e => e.is_active);

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <div className="container">
          <div style={{ maxWidth: 640 }}>
            <div className="badge badge-gold mb-3" style={{ fontSize: '0.8rem' }}>
              🔐 Biometric Secured
            </div>
            <h1 className="hero-title">
              Your Vote,<br />
              <span>Verified & Secure</span>
            </h1>
            <p className="hero-subtitle mt-4">
              Cast your vote with confidence. Our dual-biometric system — fingerprint and facial recognition —
              ensures only you can vote, and your identity stays private.
            </p>
            <div className="flex gap-3 mt-6" style={{ flexWrap: 'wrap' }}>
              {voter ? (
                <Link to="/vote" className="btn btn-gold btn-lg">🗳️ Vote Now</Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-gold btn-lg">Login to Vote</Link>
                  <Link to="/register" className="btn btn-outline btn-lg"
                    style={{ color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.4)' }}>
                    Register as Voter
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security features */}
      <div className="container" style={{ padding: '60px 24px' }}>
        <h2 className="text-center mb-6">How It Works</h2>
        <div className="grid-3" style={{ marginBottom: 60 }}>
          {[
            {[
              { icon: '👁️', title: 'Face Recognition', desc: 'Our 128-point facial analysis confirms your identity using encrypted biometric templates stored securely.' },
              { icon: '🔐', title: 'Secure Authentication', desc: 'Your face embedding is encrypted with AES-256 and never shared. Only you can unlock your voting session.' },
              { icon: '🗳️', title: 'Anonymous Vote', desc: 'Your vote is cryptographically anonymized before storage. Nobody — not even admins — can link your vote to your identity.' },
           ].map((f) => (
            <div key={f.title} className="card text-center">
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: '0.9rem' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Active elections */}
        {activeElections.length > 0 && (
          <div>
            <div className="flex-between mb-4">
              <h2>Active Elections</h2>
              <Link to="/elections" className="btn btn-outline btn-sm">View All</Link>
            </div>
            <div className="grid-2">
              {activeElections.map((e) => (
                <div key={e.id} className="card">
                  <div className="flex-between mb-3">
                    <div className="badge badge-success">🟢 Active</div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Ends {new Date(e.end_time).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 style={{ marginBottom: 8 }}>{e.title}</h3>
                  <p style={{ fontSize: '0.9rem', marginBottom: 20 }}>{e.description}</p>
                  <Link to={`/vote?election=${e.id}`} className="btn btn-primary btn-sm">
                    Cast Your Vote →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security badge row */}
        <div className="card mt-6" style={{ background: 'var(--navy)', color: 'var(--white)' }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center', textAlign: 'center' }}>
            {[
              ['🔐', 'AES-256', 'Biometric Encryption'],
              ['👁️‍🗨️', '128-D', 'Face Vectors'],
              ['📋', 'Auditable', 'Immutable Log'],
              ['🔗', 'SHA-256', 'Vote Receipts'],
              ['🚫', 'Zero-Link', 'Vote Anonymity'],
            ].map(([icon, title, sub]) => (
              <div key={title} style={{ minWidth: 100 }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{icon}</div>
                <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem' }}>{title}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
