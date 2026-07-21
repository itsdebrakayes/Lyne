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
    // Native mobile clients do not send a browser Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS.'));
  },
  credentials: true,
}));

// Stripe webhook needs the RAW body for signature verification — mount it
// before express.json() so the parser doesn't consume the body.
const { router: paymentsRouter, webhookHandler } = require('./routes/payments');
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookHandler);

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

// Queue join — stricter rate limit on joining only. Staff serve operations
// (status updates, reorder, skip) run on the same router and must not be
// throttled by the customer join limit.
app.post('/api/tickets',       queueJoinLimiter);
app.use('/api/tickets',        require('./routes/tickets'));

app.use('/api/staff',          require('./routes/staff'));
app.use('/api/assignments',    require('./routes/assignments'));
app.use('/api/counters',       require('./routes/counters'));
app.use('/api/analytics',      require('./routes/analytics'));
app.use('/api/targets',        require('./routes/targets'));
app.use('/api/predictions',    require('./routes/predictions'));
app.use('/api/pipeline',       require('./routes/pipeline'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/history',        require('./routes/history'));
app.use('/api/saved',          require('./routes/saved'));
app.use('/api/payments',       paymentsRouter);

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

  // Analytics summaries refresh EVERY 2 HOURS. The dashboards tell users
  // "numbers recalculate automatically every 2 hours", so this must actually be
  // true — it previously ran once daily at 01:00, making that claim false.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  const runRefresh = (why) =>
    refreshAnalyticsSummaries()
      .then(() => console.log(`[Analytics] Refresh complete (${why}).`))
      .catch(err => console.error(`[Analytics] Refresh failed (${why}):`, err.message));

  // Refresh once on boot so a freshly started/deployed server is never stale.
  runRefresh('startup');

  // Then align to the next even hour so runs land at predictable clock times
  // (00:00, 02:00, 04:00 …) instead of drifting from whenever the process began.
  const now = new Date();
  const nextEvenHour = new Date(now);
  nextEvenHour.setMinutes(0, 0, 0);
  nextEvenHour.setHours(nextEvenHour.getHours() + 1);
  if (nextEvenHour.getHours() % 2 !== 0) nextEvenHour.setHours(nextEvenHour.getHours() + 1);
  const msUntilAligned = nextEvenHour - now;

  setTimeout(() => {
    runRefresh('scheduled');
    setInterval(() => runRefresh('scheduled'), TWO_HOURS_MS);
  }, msUntilAligned);

  console.log(
    `[Analytics] Refreshing every 2 hours; next aligned run at ${nextEvenHour.toTimeString().slice(0, 5)} `
    + `(in ${Math.round(msUntilAligned / 60000)} minutes).`
  );
});
