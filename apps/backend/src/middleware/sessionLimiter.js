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

const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const MAX_SESSIONS = 5;
// Session TTL matches Supabase default JWT expiry (1 hour), extended by refresh activity
const SESSION_TTL_HOURS = 1;

/**
 * Extract the JWT ID (jti) claim from a raw Bearer token without full re-verification.
 * We trust the signature was already verified by requireAuth.
 */
function extractJti(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
    );
    return payload.jti || null;
  } catch {
    return null;
  }
}

async function sessionLimiter(req, res, next) {
  const user = req.supabaseUser;
  if (!user) return next(); // requireAuth didn't attach user — let requireAuth handle it

  const token     = (req.headers.authorization || '').split(' ')[1];
  const jti       = extractJti(token);
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
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    const actorId   = req.dbStaff?.id || req.dbUser?.id || null;
    const sessionType = req.dbStaff ? 'staff' : 'user';

    if (jti) {
      // Upsert by jti (same token seen again → just update last_seen_at)
      const [existing] = await pool.query(
        'SELECT id FROM user_sessions WHERE jti = ? LIMIT 1',
        [jti]
      );

      if (existing.length > 0) {
        await pool.query(
          'UPDATE user_sessions SET last_seen_at = NOW(), expires_at = ? WHERE jti = ?',
          [expiresAt, jti]
        );
      } else {
        await pool.query(
          `INSERT INTO user_sessions
             (id, user_id, staff_id, session_type, supabase_uid, jti, ip_address, user_agent, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            sessionType === 'user'  ? actorId : null,
            sessionType === 'staff' ? actorId : null,
            sessionType,
            uid, jti, ipAddress, userAgent, expiresAt,
          ]
        );
      }
    }

    // ── 3. Enforce session cap — evict oldest if over limit ─────
    const [sessions] = await pool.query(
      `SELECT id FROM user_sessions
       WHERE supabase_uid = ? AND expires_at > NOW()
       ORDER BY last_seen_at DESC`,
      [uid]
    );

    if (sessions.length > MAX_SESSIONS) {
      const toEvict = sessions.slice(MAX_SESSIONS).map(s => s.id);
      await pool.query(
        `DELETE FROM user_sessions WHERE id IN (${toEvict.map(() => '?').join(',')})`,
        toEvict
      );
    }

    next();
  } catch (err) {
    // Never block a request due to a session bookkeeping failure
    console.error('[SessionLimiter] Error:', err.message);
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
