// ============================================================
// server.js - Main Express Server Entry Point
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const voteRoutes = require('./routes/vote.routes');
const adminRoutes = require('./routes/admin.routes');
const electionRoutes = require('./routes/election.routes');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./middleware/logger');
const db = require('./models/db');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// Security Middleware
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://bvs-final.netlify.app',
    process.env.FRONTEND_URL,
    process.env.ORIGIN,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ============================================================
// General Middleware
// ============================================================
app.use(express.json({ limit: '10mb' })); // Face embeddings can be large
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ============================================================
// Routes
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// ============================================================
// Error Handling
// ============================================================
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================================
// Start Server
// ============================================================
async function startServer() {
  try {
    // Test DB connection
    await db.raw('SELECT 1');
    logger.info('✅ Database connected');

    app.listen(PORT, () => {
      logger.info(`🗳️  Biometric Voting Server running on port ${PORT}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
