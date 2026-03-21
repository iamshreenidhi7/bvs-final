// ============================================================
// src/App.jsx - Root component with routing
// ============================================================
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Vote from './pages/Vote';
import Elections from './pages/Elections';
import Verify from './pages/Verify';
import Admin from './pages/Admin';
import './styles/global.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/register"   element={<Register />} />
          <Route path="/login"      element={<Login />} />
          <Route path="/vote"       element={<Vote />} />
          <Route path="/elections"  element={<Elections />} />
          <Route path="/verify"     element={<Verify />} />
          <Route path="/admin"      element={<Admin />} />
          <Route path="*"           element={
            <div className="page flex-center flex-col" style={{ gap: 16 }}>
              <div style={{ fontSize: '4rem' }}>🗳️</div>
              <h2>404 — Page Not Found</h2>
              <a href="/" className="btn btn-primary">Return Home</a>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
