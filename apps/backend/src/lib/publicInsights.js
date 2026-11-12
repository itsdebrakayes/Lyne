/**
 * publicInsights.js — how much timing detail an organisation lets the public see.
 *
 * One answer per organisation, set by its executive (migration 051):
 *
 *   'full'    — today's behaviour: best times, heatmap, week planner, busiest
 *               hour, personal recommendations.
 *   'limited' — the old free tier: the headline best time and today's shape,
 *               nothing deeper.
 *
 * Read on public, unauthenticated routes, so it is cached briefly. A change made
 * through the settings route clears the cache in this process at once; other
 * processes catch up within CACHE_MS.
 *
 * Fail OPEN to 'full' only when the column does not exist yet (code deployed
 * before migration 051, which is exactly today's behaviour). Any other database
 * error fails CLOSED to 'limited': if we cannot tell whether an organisation
 * asked us to hold its detail back, we hold it back.
 */
const pool = require('../db/pool');

const CACHE_MS = 30_000;
const LEVELS = ['full', 'limited'];
const cache = new Map();

async function publicInsightsLevel(businessId) {
  if (!businessId) return 'full';
  const hit = cache.get(businessId);
  if (hit && hit.expires > Date.now()) return hit.level;
  let level;
  try {
    const [rows] = await pool.query('SELECT public_insights FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    level = LEVELS.includes(rows[0]?.public_insights) ? rows[0].public_insights : 'full';
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      level = 'full';
    } else {
      console.error('[public-insights] unreadable, holding detail back:', err && err.message);
      return 'limited';
    }
  }
  cache.set(businessId, { level, expires: Date.now() + CACHE_MS });
  return level;
}

/** True when the organisation shares the full detail with the public. */
async function sharesFullDetail(businessId) {
  return (await publicInsightsLevel(businessId)) === 'full';
}

function forget(businessId) {
  if (businessId) cache.delete(businessId); else cache.clear();
}

module.exports = { publicInsightsLevel, sharesFullDetail, forget, LEVELS, CACHE_MS };
