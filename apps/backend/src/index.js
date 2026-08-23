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
  sessionLookupLimiter,
  paymentLimiter,
  generalLimiter,
} = require('./middleware/rateLimiter');
const { refreshAnalyticsSummaries } = require('./jobs/refreshAnalytics');

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

/* Falling open is gated on an EXPLICIT development declaration, never on
   "not production".

   `NODE_ENV !== 'production'` is a negative test, and it passes for every way
   the variable can be wrong in a real deployment: unset, empty string, 'prod',
   'Production', or a typo. Any one of those combined with an unset
   ALLOWED_ORIGINS served every browser origin on earth — with
   `credentials: true`, so the browser would attach the session too. The
   failure was silent, because the app it was serving worked fine.

   Requiring the positive statement means a misconfigured environment fails
   closed: unknown NODE_ENV + empty allowlist now rejects browser origins
   rather than trusting them. */
class CorsError extends Error {
  constructor(origin) {
    super('Origin not allowed by CORS.');
    this.name = 'CorsError';
    this.origin = origin;
  }
}

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

if (!isDevelopment && allowedOrigins.length === 0) {
  console.warn(
    '[CORS] No ALLOWED_ORIGINS set and NODE_ENV is not development/test '
    + `(NODE_ENV=${JSON.stringify(process.env.NODE_ENV)}). Every browser origin `
    + 'will be rejected — native mobile clients still work, but the admin app '
    + 'and website will not. Set ALLOWED_ORIGINS to a comma-separated list.'
  );
}

// Security & performance middleware
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin(origin, callback) {
    // Native mobile clients do not send a browser Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (isDevelopment && allowedOrigins.length === 0) return callback(null, true);
    return callback(new CorsError(origin));
  },
  credentials: true,
}));

/* A rejected origin is a CLIENT error, and it has to say so.
   `cors` surfaces a refusal by handing an Error to next(), which fell through
   to the generic handler and came back 500. That is wrong twice: it reports our
   own correct security decision as a server fault, and at deploy time a missing
   ALLOWED_ORIGINS entry looks like the API is crashing rather than like the
   config problem it actually is. Registered here, immediately after the mount,
   so it catches the refusal before anything else sees it. */
app.use((err, req, res, next) => {
  if (err instanceof CorsError) {
    console.warn(`[CORS] rejected origin ${err.origin}`);
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  return next(err);
});

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

// Scheduled sessions — a queue you had to be entitled to join. The /public
// half takes no token at all (a motorist under a court deadline will not create
// an account first), so the two write paths that an anonymous caller can reach
// carry their own limiter: eligibility because it answers "does this reference
// exist", register because it consumes a capped place.
app.post('/api/sessions/public/:id/eligibility', sessionLookupLimiter);
app.post('/api/sessions/public/:id/register',    sessionLookupLimiter);
app.use('/api/sessions',       require('./routes/sessions'));

app.use('/api/staff',          require('./routes/staff'));
app.use('/api/assignments',    require('./routes/assignments'));
app.use('/api/counters',       require('./routes/counters'));
app.use('/api/analytics',      require('./routes/analytics'));
app.use('/api/targets',        require('./routes/targets'));
app.use('/api/settings',       require('./routes/settings'));
app.use('/api/predictions',    require('./routes/predictions'));
app.use('/api/pipeline',       require('./routes/pipeline'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/history',        require('./routes/history'));
app.use('/api/saved',          require('./routes/saved'));
/* Card testing goes straight at create-intent, so the limiter is mounted on
   the write path only — the webhook above is Stripe calling us and is verified
   by signature, and GET /methods is a customer reading their own cards. */
app.post('/api/payments/create-intent', paymentLimiter);
app.post('/api/payments/methods',       paymentLimiter);
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
  service:   'lyne-backend',
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
  console.log(`LYNE backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);

  // Analytics summaries refresh EVERY 2 HOURS. The dashboards tell users
  // "numbers recalculate automatically every 2 hours", so this must actually be
  // true — it previously ran once daily at 01:00, making that claim false.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  const runRefresh = (why) =>
    refreshAnalyticsSummaries()
      .then(() => console.log(`[Analytics] Refresh complete (${why}).`))
      .catch(err => console.error(`[Analytics] Refresh failed (${why}):`, err.message));

  // ── Demo boxes only: keep the seeded demo day current ─────────────────────
  // Queues are per-day BY DESIGN (the app looks for queue_date = CURDATE()), so
  // demo data seeded yesterday leaves every live screen closed and empty today —
  // customers cannot join and the line-staff board reads 0. Re-seed just after
  // midnight so a demo box is always showing "today".
  //
  // Double-gated: an explicit opt-in flag AND a hard refusal in production,
  // because this writes demo businesses, branches, staff and tickets.
  const demoRefreshEnabled =
    process.env.ALLOW_DEMO_DATA_REFRESH === 'true' && process.env.NODE_ENV !== 'production';

  // The re-seed script ships on the demo branch only — production builds strip
  // it. Loading it lazily AND tolerating its absence means a production box
  // that somehow has the flag set logs a line and carries on serving, instead
  // of dying at boot on MODULE_NOT_FOUND.
  const runDemoSeed = (why) => {
    let refreshDemoData;
    try {
      ({ refreshDemoData } = require('../scripts/refresh-demo-data'));
    } catch {
      console.warn('[Demo] Re-seed requested but this build has no demo data. Skipping.');
      return Promise.resolve();
    }
    return refreshDemoData()
      .then((n) => console.log(`[Demo] Re-seeded the demo day (${why}) — ${n} statements.`))
      .catch((err) => console.error(`[Demo] Re-seed failed (${why}):`, err.message));
  };

  // Re-seed BEFORE analytics, never alongside it: the two touch the same tables,
  // and running them concurrently deadlocks. Sequencing is also the correct
  // order — the summaries should be built from the freshly re-dated day.
  const bootstrap = (why) =>
    (demoRefreshEnabled ? runDemoSeed(why) : Promise.resolve()).then(() => runRefresh(why));

  // Refresh once on boot so a freshly started/deployed server is never stale.
  bootstrap('startup');

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

  if (demoRefreshEnabled) {
    // Roll the demo day over just after midnight, then rebuild the summaries so
    // the dashboards open on the new day already populated.
    const justAfterMidnight = new Date();
    justAfterMidnight.setHours(24, 5, 0, 0); // 00:05 tomorrow
    const msUntilMidnight = justAfterMidnight - new Date();

    setTimeout(() => {
      bootstrap('daily');
      setInterval(() => bootstrap('daily'), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    console.log(`[Demo] Daily re-seed scheduled for 00:05 (in ${Math.round(msUntilMidnight / 60000)} minutes).`);
  } else if (process.env.NODE_ENV !== 'production') {
    console.log('[Demo] Daily re-seed is OFF (set ALLOW_DEMO_DATA_REFRESH=true on a demo box to enable).');
  }

  // ── Close off the lines after each branch shuts ───────────────────────────
  // Runs every 15 minutes rather than nightly: branches close at their own
  // local times, and each should be tidied shortly after its own grace window
  // instead of waiting for some global small-hours pass. Cheap query, indexed.
  const { runTicketExpiry, GRACE_MINUTES } = require('./jobs/expireStaleTickets');
  const expire = (why) =>
    runTicketExpiry()
      .then((out) => {
        if (!out.enabled) return;
        if (out.cancelled || out.noShow) {
          console.log(
            `[TicketExpiry] Closed out (${why}) — ${out.cancelled} never called, ${out.noShow} called but absent.`
          );
        }
        // Surfaced every pass, because it means a clerk left somebody at a
        // counter overnight. Silence here would hide a real floor problem.
        if (out.stuckInService) {
          console.warn(
            `[TicketExpiry] ${out.stuckInService} ticket(s) still IN SERVICE past closing at: `
            + `${out.stuckBranches.join(', ')} — a clerk did not finish them.`
          );
        }
      })
      .catch((err) => console.error(`[TicketExpiry] Failed (${why}):`, err.message));

  expire('startup');
  setInterval(() => expire('interval'), 15 * 60 * 1000);
  console.log(
    `[TicketExpiry] ${process.env.TICKET_EXPIRY_ENABLED === 'false' ? 'DISABLED' : 'Active'}; `
    + `tickets close ${GRACE_MINUTES} min after each branch's closing time.`
  );

  // ── Retention sweep ───────────────────────────────────────────────────────
  // The Privacy Policy publishes retention periods; this is what makes them
  // true. Runs at 03:00, away from the midnight demo re-seed and the even-hour
  // analytics runs so three jobs never contend for the same tables.
  //
  // Defaults to DRY RUN: a fresh deployment reports what it would remove and
  // removes nothing until RETENTION_ENABLED=true is set deliberately.
  const { runRetentionSweep } = require('./jobs/retention');
  const sweep = (why) =>
    runRetentionSweep()
      .then((out) => {
        if (out.dryRun) return;
        const total = out.results.reduce((sum, r) => sum + r.rows, 0);
        console.log(`[Retention] Enforced (${why}) — ${total} rows.`);
      })
      .catch((err) => console.error(`[Retention] Sweep failed (${why}):`, err.message));

  // Once on boot so the first log line tells you where you stand.
  sweep('startup');

  const nextThreeAM = new Date();
  nextThreeAM.setHours(3, 0, 0, 0);
  if (nextThreeAM <= new Date()) nextThreeAM.setDate(nextThreeAM.getDate() + 1);
  const msUntilThree = nextThreeAM - new Date();

  setTimeout(() => {
    sweep('daily');
    setInterval(() => sweep('daily'), 24 * 60 * 60 * 1000);
  }, msUntilThree);

  console.log(
    `[Retention] ${process.env.RETENTION_ENABLED === 'true' ? 'ENFORCING' : 'Dry run'}; `
    + `next sweep at 03:00 (in ${Math.round(msUntilThree / 60000)} minutes).`
  );
});
