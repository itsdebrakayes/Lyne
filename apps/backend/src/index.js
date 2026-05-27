require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');

const {
  authLimiter,
  queueJoinLimiter,
  ocrLimiter,
  publicQueueLimiter,
  generalLimiter,
} = require('./middleware/rateLimiter');

const app = express();

// Security & performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Body parsing — limit OCR uploads separately (see /api/ocr route)
app.use(express.json({ limit: '1mb' }));

// Global rate limiter
app.use(generalLimiter);

// Routes with per-endpoint rate limits
app.use('/api/auth/sync-user', authLimiter);
app.use('/api/auth',           require('./routes/auth'));

app.use('/api/businesses',     require('./routes/businesses'));
app.use('/api/branches',       require('./routes/branches'));
app.use('/api/services',       require('./routes/services'));

// Public queue status — higher rate limit for polling
app.use('/api/queues/live',    publicQueueLimiter);
app.use('/api/queues',         require('./routes/queues'));

// Queue join — stricter rate limit
app.use('/api/tickets',        queueJoinLimiter, require('./routes/tickets'));

app.use('/api/staff',          require('./routes/staff'));
app.use('/api/assignments',    require('./routes/assignments'));
app.use('/api/analytics',      require('./routes/analytics'));
app.use('/api/predictions',    require('./routes/predictions'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/history',        require('./routes/history'));
app.use('/api/saved',          require('./routes/saved'));

// OCR — strict rate limit + larger body size for image uploads
app.use('/api/ocr', ocrLimiter, express.json({ limit: '10mb' }), require('./routes/ocr'));

// Audit log — internal read access for managers/executives
app.use('/api/audit',          require('./routes/audit'));

// Staff invite — invite-code-based staff onboarding (no self-registration)
app.use('/api/staff-invite',   require('./routes/staff-invite'));

// Health check
app.get('/health', (_req, res) => res.json({
  status:    'ok',
  service:   'qme-now-backend',
  timestamp: new Date().toISOString(),
  uptime:    Math.round(process.uptime()),
}));

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// Error handler
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
  console.log(`Q ME NOW backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
