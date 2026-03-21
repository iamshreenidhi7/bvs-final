// ============================================================
// src/components/Navbar.jsx
// ============================================================
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { voter, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">🗳️</div>
        <span className="navbar-title">Vote<span>Secure</span></span>
      </Link>

      <div className="navbar-links">
        <Link to="/" className={isActive('/')}>Home</Link>
        <Link to="/elections" className={isActive('/elections')}>Elections</Link>

        {voter ? (
          <>
            <Link to="/vote" className={isActive('/vote')}>Vote Now</Link>
            <Link to="/verify" className={isActive('/verify')}>Verify Receipt</Link>
            <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>|</span>
            <span style={{ color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 500 }}>
              👤 {voter.name?.split(' ')[0]}
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleLogout}
              style={{ marginLeft: 4, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/register" className={isActive('/register')}>Register</Link>
            <Link to="/login" className="btn btn-gold btn-sm" style={{ marginLeft: 8 }}>
              Login to Vote
            </Link>
          </>
        )}

        {isAdmin && (
          <Link to="/admin" className={isActive('/admin')} style={{ marginLeft: 8 }}>
            ⚙️ Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
