/**
 * predictionsEnabled.js — the kill switch for the prediction layer.
 *
 * Three tiers, resolved MOST-RESTRICTIVE-WINS: a prediction is served only when
 * the platform, the business and the user all allow it. Any one of them saying
 * no is enough, and no tier can override another — that is the whole point. A
 * business cannot force predictions back on after the platform has pulled them,
 * and a user opt-out is not something a tenant can undo.
 *
 * The platform tier is cached, because it is read on the hot path (every wait
 * estimate) and changes roughly never. TTL is short enough that flipping the
 * switch during an incident takes effect within a few seconds across every
 * process, without a restart and without a deploy — which is the reason it
 * lives in the database rather than in an environment variable.
 *
 * Fail CLOSED on a database error. If we cannot establish that the switch is on
 * we do not serve a prediction: the failure mode of showing a stale or wrong
 * estimate to somebody deciding when to leave the house is worse than the
 * failure mode of showing them no estimate at all. Every caller already has a
 * formula fallback for exactly this.
 */
const pool = require('../db/pool');

const PLATFORM_TTL_MS = 10_000;

let platformCache = { value: null, expires: 0 };

/** Clears the platform cache — for tests, and for an admin toggle that wants
    its own change reflected immediately rather than up to a TTL later. */
function resetCache() {
  platformCache = { value: null, expires: 0 };
}

async function platformAllows() {
  const now = Date.now();
  if (platformCache.value !== null && now < platformCache.expires) {
    return platformCache.value;
  }
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = 'predictions_enabled' LIMIT 1"
    );
    // An absent row means the migration has not run here yet. Treat that as ON,
    // so deploying this file ahead of the migration does not silently disable
    // the feature everywhere.
    const value = rows.length ? rows[0].setting_value !== 'false' : true;
    platformCache = { value, expires: now + PLATFORM_TTL_MS };
    return value;
  } catch (err) {
    console.error('[predictions] platform switch unreadable:', err.message);
    return false;
  }
}

/**
 * @param {object} opts
 * @param {string} [opts.businessId] omit to skip the business tier
 * @param {string} [opts.userId]     omit to skip the user tier
 * @returns {Promise<boolean>}
 */
async function predictionsEnabled({ businessId, userId } = {}) {
  if (!(await platformAllows())) return false;

  try {
    if (businessId) {
      const [rows] = await pool.query(
        'SELECT predictions_enabled FROM businesses WHERE id = ? LIMIT 1',
        [businessId]
      );
      // A business we cannot find is not a business that opted out — but it is
      // also not one we can serve a prediction for, so let the caller's own
      // "unknown business" handling deal with it rather than inventing consent.
      if (rows.length && rows[0].predictions_enabled === 0) return false;
    }

    if (userId) {
      const [rows] = await pool.query(
        'SELECT predictions_enabled FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      if (rows.length && rows[0].predictions_enabled === 0) return false;
    }
  } catch (err) {
    console.error('[predictions] tier switch unreadable:', err.message);
    return false;
  }

  return true;
}

module.exports = { predictionsEnabled, resetCache, PLATFORM_TTL_MS };
