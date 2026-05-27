/**
 * rateLimiter.js — Rate limiting middleware for Q ME NOW backend
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
const generalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  message: { error: 'Too many requests. Please try again later.' },
});

module.exports = {
  authLimiter,
  queueJoinLimiter,
  ocrLimiter,
  publicQueueLimiter,
  generalLimiter,
};
