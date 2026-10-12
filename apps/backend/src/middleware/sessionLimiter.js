/**
 * sessionLimiter.js — Enforces per-user session limits and JWT revocation checks.
 *
 * Uses:
 *   requireAuth (from auth.js) must run BEFORE this middleware so req.supabaseUser
 *   is already populated.
 *
 * What it does:
 *   1. Checks token_revocations — rejects any token that has been explicitly revoked.
 *   2. Upserts a row in user_sessions for the current token, updating last_seen_at.
 *   3. After upsert, counts active (non-expired) sessions for this supabase_uid.
 *      If the count exceeds MAX_SESSIONS, the OLDEST sessions are evicted.
 *
 * Usage:
 *   // Apply after requireAuth on sensitive routes, or mount globally in index.js:
 *   app.use(requireAuth, sessionLimiter);
 *
 *   // Or per-route:
 *   router.get('/profile', requireAuth, sessionLimiter, handler);
 */

const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');

const MAX_SESSIONS_BY_TYPE = {
  user: 5,
  staff: 2,
};
// Session TTL matches Supabase default JWT expiry (1 hour), extended by refresh activity
const SESSION_TTL_HOURS = 1;

/**
 * Extract the JWT ID (jti) claim from a raw Bearer token without full re-verification.
 * We trust the signature was already verified by requireAuth.
 */
function extractTokenClaims(token) {
  try {
    return JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    );
  } catch {
    return {};
  }
}

async function sessionLimiter(req, res, next) {
  const user = req.supabaseUser;
  if (!user) return next(); // requireAuth didn't attach user — let requireAuth handle it

  const token     = (req.headers.authorization || '').split(' ')[1];
  const claims    = extractTokenClaims(token);
  const jti       = claims.jti || claims.session_id || null;
  const uid       = user.id;
  const ipAddress = req.ip || req.socket?.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  try {
    // ── 1. Check revocation list ────────────────────────────────
    const [revoked] = await pool.query(
      `SELECT id FROM token_revocations
       WHERE supabase_uid = ?
         AND (jti = ? OR jti IS NULL)
         AND expires_at > NOW()
       LIMIT 1`,
      [uid, jti || '']
    );
    if (revoked.length > 0) {
      return res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
    }

    // ── 2. Upsert session record ────────────────────────────────
    const fallbackExpiry = Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000;
    const expiresAt = new Date(claims.exp ? Math.min(claims.exp * 1000, fallbackExpiry) : fallbackExpiry);
    const actorId   = req.dbStaff?.id || req.dbUser?.id || null;
    const sessionType = req.dbStaff ? 'staff' : 'user';

    if (jti) {
      /* One atomic upsert by jti. It was SELECT-then-INSERT, and the app's
         parallel first requests (several sync-user calls at sign-in) all saw
         "not there" and all inserted, so all but one failed on the unique
         jti with "Duplicate entry" — and that error skipped the session cap
         below for those requests. */
      await pool.query(
        `INSERT INTO user_sessions
           (id, user_id, staff_id, session_type, supabase_uid, jti, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE last_seen_at = NOW(), expires_at = VALUES(expires_at)`,
        [
          uuidv4(),
          sessionType === 'user'  ? actorId : null,
          sessionType === 'staff' ? actorId : null,
          sessionType,
          uid, jti, ipAddress, userAgent, expiresAt,
        ]
      );
    }

    // ── 3. Enforce session cap — evict oldest if over limit ─────
    const [sessions] = await pool.query(
      `SELECT id FROM user_sessions
       WHERE supabase_uid = ? AND expires_at > NOW()
       ORDER BY last_seen_at DESC`,
      [uid]
    );

    const maxSessions = MAX_SESSIONS_BY_TYPE[sessionType] || 1;
    if (sessions.length > maxSessions) {
      const toEvict = sessions.slice(maxSessions).map(s => s.id);
      await pool.query(
        `DELETE FROM user_sessions WHERE id IN (${toEvict.map(() => '?').join(',')})`,
        toEvict
      );
    }

    next();
  } catch (err) {
    console.error('[SessionLimiter] Error:', err.message);
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Session verification unavailable. Please try again.' });
    }
    next();
  }
}

/**
 * createRevocation — call this on logout or forced sign-out.
 * @param {string} supabaseUid
 * @param {string|null} jti — null to revoke ALL active tokens for this user
 * @param {string} reason
 * @param {Date} expiresAt — when the JWT would have expired naturally
 * @param {string|null} revokedBy — staff.id who forced the revocation
 */
async function createRevocation(supabaseUid, jti, reason, expiresAt, revokedBy = null) {
  await pool.query(
    `INSERT INTO token_revocations (id, supabase_uid, jti, reason, revoked_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), supabaseUid, jti || null, reason, revokedBy, expiresAt]
  );
  // Also delete the matching session rows immediately
  if (jti) {
    await pool.query('DELETE FROM user_sessions WHERE jti = ?', [jti]);
  } else {
    await pool.query('DELETE FROM user_sessions WHERE supabase_uid = ?', [supabaseUid]);
  }
}

module.exports = { sessionLimiter, createRevocation };
