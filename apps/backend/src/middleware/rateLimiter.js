/**
 * rateLimiter.js — Rate limiting middleware for LYNE backend
 *
 * Applies per-endpoint rate limits to prevent abuse of public-facing
 * and sensitive endpoints. Uses express-rate-limit.
 *
 * Limits applied:
 *   - Login/signup:        10 requests per 15 minutes per IP
 *   - Queue join:          20 requests per 15 minutes per IP
 *   - OCR scan/upload:     5 requests per 15 minutes per IP
 *   - Public queue status: 60 requests per minute per IP
 *   - General API:         200 requests per 15 minutes per IP
 */
const rateLimit = require('express-rate-limit');

/* SCALING — see docs/SCALING.md §2 before changing any of this.
 *
 * Two known limitations, both deliberate, both fine at one API process:
 *
 *   1. These are FIXED WINDOW counters, so a caller can spend a full window in
 *      its last second and a fresh one immediately after. A TOKEN BUCKET
 *      refills continuously and removes that entirely. Worth adopting when a
 *      limit guards real money — paymentLimiter first, where the boundary turns
 *      ten card attempts an hour into twenty.
 *
 *   2. The store is IN MEMORY, so the counts live in one process. The day a
 *      SECOND API instance starts, every limit here silently doubles and stops
 *      meaning what it says. That is a hard trigger, not a judgement call:
 *      move to a shared store (rate-limit-redis) in the same change that adds
 *      the second instance.
 */

/**
 * Who a limit counts against.
 *
 * The default in express-rate-limit is the client IP, and for an anonymous
 * endpoint that is the only honest answer. For an AUTHENTICATED one it is the
 * wrong answer here, and the reason is specific to where this runs.
 *
 * Jamaica's mobile networks put large numbers of subscribers behind
 * carrier-grade NAT, so thousands of Digicel or Flow customers can share one
 * public address. An agency office is the same shape: every counter, every
 * clerk and every customer on the branch wifi leaves through a single IP. Key a
 * 20-per-15-minutes join limit on that and the twenty-first person at Half Way
 * Tree is told they are doing it too often, for something twenty strangers did.
 * It reads as the app being broken, which is the worst kind of bug — nobody
 * reports it, they just stop using it.
 *
 * So: count against the signed-in person when we know who they are, and fall
 * back to the address when we do not.
 *
 * Two things keep this from being a hole. A limiter using this key is mounted
 * AFTER requireAuth, so the identity is one Supabase has already verified —
 * never a header the caller can choose. And generalLimiter still applies
 * per-IP across the whole API, so an address cannot exceed its overall ceiling
 * by signing in as several people; it only stops innocent neighbours sharing
 * one person's budget for a specific action.
 */
function actorOrIp(req) {
  const actor = req.dbUser?.id || req.dbStaff?.id;
  /* `req.ip` is what this library uses by default, so the anonymous path here
     behaves exactly as it did before this key existed. */
  return actor ? `actor:${actor}` : `ip:${req.ip}`;
}

/* One knob, and it is deliberately narrow.
   The end-to-end suite signs in far more often in fifteen minutes than any
   person would, so it exhausts the auth budget partway through a run and the
   rest of the file fails on a 429 that looks exactly like a broken login. That
   is the suite's problem to solve, not a reason to loosen what ships: the
   default below is the shipped value, and only an explicit env var in a local
   test run changes it. Nothing sets this in production. */
const AUTH_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;

// ── Login / Signup ────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              AUTH_MAX,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

// ── Queue join ────────────────────────────────────────────────
const queueJoinLimiter = rateLimit({
  keyGenerator:     actorOrIp,
  windowMs:         15 * 60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many queue join requests. Please try again in 15 minutes.' },
});

// ── OCR scan / upload ─────────────────────────────────────────
const ocrLimiter = rateLimit({
  keyGenerator:     actorOrIp,
  windowMs:         15 * 60 * 1000,
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many OCR scan requests. Please try again in 15 minutes.' },
});

// ── Public queue status ───────────────────────────────────────
const publicQueueLimiter = rateLimit({
  windowMs:         60 * 1000, // 1 minute
  max:              60,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many queue status requests. Please slow down.' },
});

// ── General API fallback ──────────────────────────────────────
// The admin dashboards legitimately poll ~15 analytics endpoints on a 60s
// refresh cycle (~15 req/min at idle, more while navigating), so the ceiling
// must clear that comfortably while still stopping real abuse/scraping.
// ── Payment intents ───────────────────────────────────────────────────────
// POST /api/payments/create-intent used to sit behind nothing but the global
// 1000-per-15-minutes ceiling, which is a card-testing budget, not a limit: a
// script can validate stolen cards against a real Stripe account all day inside
// it. The cost lands on us as failed-payment fees and, eventually, as Stripe
// questioning the account.
//
// A person subscribes once. Ten attempts an hour is already generous for
// somebody genuinely fighting a declined card, and it takes card testing from
// "free" to "pointless".
const paymentLimiter = rateLimit({
  keyGenerator:     actorOrIp,
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many payment attempts. Please try again later.' },
});

const generalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              1000,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ── Session eligibility portal ────────────────────────────────
// POST /api/sessions/public/:id/eligibility answers "is this reference listed
// today", from an UNAUTHENTICATED browser. That is an enumeration oracle by
// nature: given enough attempts it confirms which ticket numbers exist. The
// second factor raises the cost per guess; this caps the number of guesses.
//
// 15 in 15 minutes is deliberately tight. The honest user checks once, maybe
// mistypes twice, then registers. Nobody legitimately needs a sixteenth attempt,
// and a court's own staff use the authenticated staff route, not this one.
const sessionLookupLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              15,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many lookup attempts. Please wait 15 minutes, or contact the office directly.' },
});

module.exports = {
  actorOrIp,
  authLimiter,
  queueJoinLimiter,
  ocrLimiter,
  publicQueueLimiter,
  sessionLookupLimiter,
  paymentLimiter,
  generalLimiter,
};
