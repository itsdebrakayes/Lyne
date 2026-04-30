require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const morgan       = require('morgan');

const app = express();

// ── Security & performance middleware ─────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ─────────────────────────────────────────────
// Global: 300 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Strict: 10 queue joins per minute per IP (prevents abuse)
const joinQueueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many queue join attempts. Please wait a moment.' },
});

app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/businesses',    require('./routes/businesses'));
app.use('/api/branches',      require('./routes/branches'));
app.use('/api/services',      require('./routes/services'));
app.use('/api/queues',        require('./routes/queues'));
app.use('/api/tickets',       joinQueueLimiter, require('./routes/tickets'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/assignments',   require('./routes/assignments'));
app.use('/api/analytics',     require('./routes/analytics'));
app.use('/api/predictions',   require('./routes/predictions'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/history',       require('./routes/history'));
app.use('/api/saved',         require('./routes/saved'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  service: 'qme-now-backend',
  timestamp: new Date().toISOString(),
  uptime: Math.round(process.uptime()),
}));

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : (err.message || 'Internal server error.'),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Q ME NOW backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
