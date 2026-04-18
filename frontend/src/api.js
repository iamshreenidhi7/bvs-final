// ============================================================
// src/api.js - Axios API Client
// ============================================================
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voting_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('voting_token');
      localStorage.removeItem('voter_info');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────
export const authAPI = {
  markRegistered: (voterId) =>
    api.post('/auth/mark-registered', { voterId }),
  loginWithFace: (voterId, faceEmbedding) =>
    api.post('/auth/login/face', { voterId, faceEmbedding }),
  register: (data) => api.post('/auth/register', data),
  enrollFace: (voterId, faceEmbedding) =>
    api.post('/auth/enroll/face', { voterId, faceEmbedding }),
  getWebAuthnEnrollOptions: (voterId) =>
    api.get(`/auth/enroll/webauthn/options/${voterId}`),
  verifyWebAuthnEnroll: (voterId, registrationResponse) =>
    api.post('/auth/enroll/webauthn/verify', { voterId, registrationResponse }),
  loginStart: (nationalId) => api.post('/auth/login/start', { nationalId }),
  loginComplete: (voterId, webauthnResponse, faceEmbedding) =>
    api.post('/auth/login/complete', { voterId, webauthnResponse, faceEmbedding }),
  logout: () => api.post('/auth/logout'),
  adminLogin: (username, password) =>
    api.post('/auth/admin/login', { username, password }),
};

// ── Elections ─────────────────────────────────────────────
export const electionsAPI = {
  list: () => api.get('/elections'),
  get: (id) => api.get(`/elections/${id}`),
  create: (data) => api.post('/elections', data),
  addCandidate: (electionId, data) =>
    api.post(`/elections/${electionId}/candidates`, data),
  activate: (id) => api.put(`/elections/${id}/activate`),
};

// ── Voting ────────────────────────────────────────────────
export const voteAPI = {
  cast: (electionId, candidateId) =>
    api.post('/vote/cast', { electionId, candidateId }),
  verifyReceipt: (receiptHash) =>
    api.post('/vote/verify-receipt', { receiptHash }),
  getResults: (electionId) => api.get(`/vote/results/${electionId}`),
  getStatus: (electionId) => api.get(`/vote/status/${electionId}`),
};

// ── Admin ─────────────────────────────────────────────────
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  voters: (page = 1) => api.get(`/admin/voters?page=${page}`),
  deactivateVoter: (id) => api.put(`/admin/voters/${id}/deactivate`),
  participation: (electionId) =>
    api.get(`/admin/elections/${electionId}/participation`),
};

export default api;
