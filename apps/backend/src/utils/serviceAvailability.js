/**
 * serviceAvailability.js — can this branch serve this service at this time?
 *
 * One answer for every place that promises a future visit (Line Helper's quote
 * and its scheduling), so the app is never offered a time the server would
 * then refuse.
 *
 * A branch OFFERS a service if it has an active counter for it — the same
 * source of truth ensureQueuesForToday() opens each day's queue from. Whether
 * a queue row already exists is NOT the test: queues are created day by day,
 * so for any future day there is none yet, and treating that as "not running"
 * is the bug this replaces.
 *
 * Hours are the branch's own opening_time / closing_time / open_days, read in
 * the server's timezone (TZ=America/Jamaica in production), the same frame
 * predictWait() uses for day-of-week and hour.
 */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
}

function clock(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
}

/**
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} db
 * @param {string} branchId
 * @param {string} serviceId
 * @param {Date} at  when the customer would be served
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'not_offered'|'closed_day'|'closed_hours', message: string }>}
 */
async function serviceAvailableAt(db, branchId, serviceId, at) {
  const [[row]] = await db.query(
    `SELECT b.name AS branch_name, b.opening_time, b.closing_time, b.open_days,
            s.name AS service_name,
            EXISTS (SELECT 1 FROM counters c
                     WHERE c.branch_id = b.id AND c.service_id = s.id AND c.is_active = 1) AS offered
       FROM branches b
       JOIN services s ON s.id = ? AND s.business_id = b.business_id AND s.is_active = 1
      WHERE b.id = ? AND b.is_active = 1
      LIMIT 1`,
    [serviceId, branchId]
  );
  if (!row || !Number(row.offered)) {
    return { ok: false, reason: 'not_offered', message: `${row?.service_name || 'That service'} is not offered at ${row?.branch_name || 'this branch'}.` };
  }

  if (row.open_days) {
    const days = String(row.open_days).split(',').map((d) => parseInt(d, 10)).filter((d) => !Number.isNaN(d));
    if (days.length && !days.includes(at.getDay())) {
      return { ok: false, reason: 'closed_day', message: `${row.branch_name} is closed on ${DAY_NAMES[at.getDay()]}s.` };
    }
  }

  const open = toMinutes(row.opening_time);
  const close = toMinutes(row.closing_time);
  const mins = at.getHours() * 60 + at.getMinutes();
  if (open !== null && close !== null && (mins < open || mins >= close)) {
    return {
      ok: false,
      reason: 'closed_hours',
      message: `${row.branch_name} is open ${clock(open)} to ${clock(close)}. Pick a time in those hours.`,
    };
  }
  return { ok: true };
}

module.exports = { serviceAvailableAt };
