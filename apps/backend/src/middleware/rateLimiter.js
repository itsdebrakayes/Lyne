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

// ── Login / Signup ────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
});

// ── Queue join ────────────────────────────────────────────────
const queueJoinLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many queue join requests. Please try again in 15 minutes.' },
});

// ── OCR scan / upload ─────────────────────────────────────────
const ocrLimiter = rateLimit({
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
  authLimiter,
  queueJoinLimiter,
  ocrLimiter,
  publicQueueLimiter,
  sessionLookupLimiter,
  generalLimiter,
};
