/**
 * waitEstimator.js — Model-based wait ETA for a joining ticket.
 *
 * Historically the customer's "estimated wait" was a flat (position-1) ×
 * base_avg_time — arithmetic that ignored the time of day, how full the line
 * actually is, and how this service really behaves. The analytics pipeline now
 * publishes a `wait_eta_grid` insight (see apps/model/scripts/generate_insights.py):
 * per service, a surface of expected wait by hour × queue-length bucket, each
 * cell backed by real history where dense and the wait-time model where thin.
 *
 * This helper reads that grid (cached briefly per business) and returns an ETA
 * for a (service, hour, position). If no grid exists yet — a brand-new tenant,
 * or the worker hasn't run — callers fall back to the old formula, so joining a
 * queue never depends on the model being present.
 */
const pool = require('../db/pool');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // branch_id -> { grid, expires }

async function loadGridForBranch(branchId) {
  const cached = cache.get(branchId);
  if (cached && cached.expires > Date.now()) return cached.grid;

  const [rows] = await pool.query(
    `SELECT p.insight_data
       FROM predictive_results p
       JOIN branches b ON b.business_id = p.business_id
      WHERE b.id = ? AND p.insight_type = 'wait_eta_grid'
        AND (p.stale_after IS NULL OR p.stale_after > NOW())
      ORDER BY p.generated_at DESC
      LIMIT 1`,
    [branchId]
  );

  let grid = null;
  if (rows.length) {
    const data = typeof rows[0].insight_data === 'string'
      ? JSON.parse(rows[0].insight_data)
      : rows[0].insight_data;
    grid = new Map((data.services || []).map((s) => [s.service_id, s.cells || []]));
  }
  cache.set(branchId, { grid, expires: Date.now() + CACHE_TTL_MS });
  return grid;
}

/**
 * Estimate wait minutes for a ticket about to join.
 * Returns a number, or null when no grid cell applies (caller should fall back).
 */
async function estimateWaitMinutes({ branchId, serviceId, position, hour }) {
  try {
    const grid = await loadGridForBranch(branchId);
    if (!grid) return null;
    const cells = grid.get(serviceId);
    if (!cells || !cells.length) return null;

    const targetHour = Number.isInteger(hour) ? hour : new Date().getHours();
    const queueAhead = Math.max(0, (position || 1) - 1);

    // Prefer cells for this hour; otherwise use the nearest available hour.
    let hourCells = cells.filter((c) => c.hour === targetHour);
    if (!hourCells.length) {
      const hours = [...new Set(cells.map((c) => c.hour))];
      const nearest = hours.reduce((a, b) => (Math.abs(b - targetHour) < Math.abs(a - targetHour) ? b : a));
      hourCells = cells.filter((c) => c.hour === nearest);
    }

    // Smallest bucket whose upper bound covers the queue ahead of this ticket.
    hourCells.sort((a, b) => a.queue_max - b.queue_max);
    const cell = hourCells.find((c) => queueAhead <= c.queue_max) || hourCells[hourCells.length - 1];
    if (!cell || typeof cell.predicted_wait !== 'number') return null;
    return Math.round(cell.predicted_wait);
  } catch (err) {
    console.error('waitEstimator: falling back to formula —', err.message);
    return null;
  }
}

function _clearCache() { cache.clear(); }

module.exports = { estimateWaitMinutes, _clearCache };
