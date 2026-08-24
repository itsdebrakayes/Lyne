/**
 * portalHandoff.js — the token that makes /account exist.
 *
 * Apple will not let the app sell a subscription, so buying and cancelling
 * happen on the website. But the website is a marketing site: there is no
 * "Log in" in the nav, and there should not be. Somebody who has never opened
 * the app has no business finding an account portal, and a login form sitting
 * on a public URL is an invitation to credential-stuff it.
 *
 * The honest constraint first: a URL cannot be secret in a browser. Anybody can
 * type /account. What this makes possible is that typing it gets you the same
 * 404 as any other unknown path — the route does not announce that it exists,
 * does not render a form, and does not confirm that the address is real.
 *
 * The token proves "you arrived from the app". It does NOT sign anyone in. The
 * customer still logs in on the website with the same credentials, because a
 * link that logs you in is a link that logs in whoever finds it — in a shared
 * browser, in a screenshot, in a URL pasted into a chat.
 *
 * Design notes that matter:
 *   • HMAC over (user id, expiry, nonce) — stateless, so no table to sweep and
 *     nothing to look up on a route that must answer fast and identically for
 *     valid and invalid input.
 *   • Ten minutes. Long enough to switch apps and fumble a password, short
 *     enough that a token in a browser history is dead by the time anyone
 *     reads it.
 *   • Delivered in the URL FRAGMENT by the caller, not the query string.
 *     Fragments are never sent to the server, never land in access logs, and
 *     are not forwarded in the Referer header.
 *   • Constant-time comparison, because a token check that leaks timing is a
 *     token check an attacker can walk.
 */
const { createHmac, randomBytes, timingSafeEqual } = require('crypto');

const TTL_MS = 10 * 60 * 1000;

/**
 * The signing secret. Deliberately not defaulted: a portal handoff signed with
 * a well-known fallback would be forgeable by anyone reading this repository,
 * and silently working in development is exactly how that ships. Callers treat
 * null as "the portal is not configured".
 */
function secret() {
  const value = process.env.PORTAL_HANDOFF_SECRET;
  if (!value || value.length < 32) return null;
  return value;
}

function sign(payload, key) {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/**
 * Mint a handoff token for a signed-in customer.
 * @returns {string|null} null when the portal has no secret configured.
 */
function issue(userId, now = Date.now()) {
  const key = secret();
  if (!key || !userId) return null;

  const expiresAt = now + TTL_MS;
  const nonce = randomBytes(9).toString('base64url');
  const payload = `${userId}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, key)}`;
}

/**
 * Verify a handoff token.
 *
 * Returns { valid, userId, reason }. Every failure looks the same to the
 * caller by design — the route it guards must not distinguish "expired" from
 * "forged" from "never existed" in what it renders.
 */
function verify(token, now = Date.now()) {
  const key = secret();
  if (!key) return { valid: false, reason: 'not_configured' };
  if (typeof token !== 'string' || token.length > 512) return { valid: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 4) return { valid: false, reason: 'malformed' };

  const [userId, expiresAtRaw, nonce, provided] = parts;
  const payload = `${userId}.${expiresAtRaw}.${nonce}`;
  const expected = sign(payload, key);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which is itself a signal.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad_signature' };
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, userId };
}

module.exports = { issue, verify, TTL_MS, secret };
