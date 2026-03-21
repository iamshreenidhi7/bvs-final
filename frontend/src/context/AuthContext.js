// ============================================================
// src/context/AuthContext.js
// ============================================================
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [voter, setVoter] = useState(null);
  const [token, setToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('voting_token');
    const savedVoter = localStorage.getItem('voter_info');
    const savedAdmin = localStorage.getItem('admin_token');

    if (savedToken && savedVoter) {
      setToken(savedToken);
      setVoter(JSON.parse(savedVoter));
    }
    if (savedAdmin) setIsAdmin(true);
    setLoading(false);

    // Handle token expiry
    const onExpired = () => logout();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  function loginVoter(token, voterInfo) {
    localStorage.setItem('voting_token', token);
    localStorage.setItem('voter_info', JSON.stringify(voterInfo));
    setToken(token);
    setVoter(voterInfo);
  }

  function loginAdmin(token) {
    localStorage.setItem('admin_token', token);
    setIsAdmin(true);
  }

  async function logout() {
    try {
      if (token) await authAPI.logout();
    } catch (_) {}
    localStorage.removeItem('voting_token');
    localStorage.removeItem('voter_info');
    localStorage.removeItem('admin_token');
    setToken(null);
    setVoter(null);
    setIsAdmin(false);
  }

  return (
    <AuthContext.Provider value={{ voter, token, isAdmin, loading, loginVoter, loginAdmin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
