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
const { requireAuth }    = require('./middleware/auth');
const { sessionLimiter } = require('./middleware/sessionLimiter');
const { refreshAnalyticsSummaries } = require('./jobs/refreshAnalytics');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Security & performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin(origin, callback) {
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS.'));
  },
  credentials: true,
}));

// Body parsing — limit OCR uploads separately (see /api/ocr route)
app.use(express.json({ limit: '1mb' }));

// Global rate limiter
app.use(generalLimiter);

// Session limiter — applied to all authenticated routes.
// Must run after requireAuth so req.supabaseUser is populated.
// We apply it inline per-route group rather than globally so unauthenticated
// public routes (e.g. /api/queues/live) are unaffected.
const withSession = [requireAuth, sessionLimiter];

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
app.use('/api/pipeline',       require('./routes/pipeline'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/history',        require('./routes/history'));
app.use('/api/saved',          require('./routes/saved'));

// OCR — strict rate limit + larger body size for image uploads
app.use('/api/ocr', ocrLimiter, express.json({ limit: '10mb' }), require('./routes/ocr'));

// Audit log — internal read access for managers/executives
app.use('/api/audit',          require('./routes/audit'));

// Staff invite — invite-code-based staff onboarding (no self-registration)
app.use('/api/staff-invite',   require('./routes/staff-invite'));

// SSE — live queue updates (no auth for public stream; staff stream auth handled in route)
app.use('/api/sse',            require('./routes/sse'));

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

  // Schedule daily analytics summary refresh at 01:00
  const now   = new Date();
  const next1am = new Date(now);
  next1am.setHours(1, 0, 0, 0);
  if (next1am <= now) next1am.setDate(next1am.getDate() + 1);
  const msUntil1am = next1am - now;

  setTimeout(() => {
    refreshAnalyticsSummaries().catch(err =>
      console.error('[Analytics] Scheduled refresh failed:', err.message)
    );
    setInterval(() => {
      refreshAnalyticsSummaries().catch(err =>
        console.error('[Analytics] Scheduled refresh failed:', err.message)
      );
    }, 24 * 60 * 60 * 1000);
  }, msUntil1am);

  console.log(`[Analytics] Daily refresh scheduled in ${Math.round(msUntil1am / 60000)} minutes.`);
});
