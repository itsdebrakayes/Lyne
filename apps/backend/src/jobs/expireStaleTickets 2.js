/**
 * expireStaleTickets.js — close off the lines after a branch shuts.
 *
 * Nothing ever ended a ticket that was still in the queue when the doors closed.
 * A ticket left `waiting` overnight kept accruing wait time against wall-clock,
 * so the next morning the system reported people who had "waited" 900+ minutes,
 * and the abandonment average read 221 minutes — figures no manager could act on
 * and no prospect would believe. The tickets were not wrong; nothing had ever
 * told them the day was over.
 *
 * ── What gets closed, and why each lands where it does ──────────────────────
 *
 *   waiting  → cancelled   Never called. The branch closed on them. This is NOT
 *                          a no-show (nobody called their number) and NOT
 *                          "left" (they did not choose to go), and filing it as
 *                          either would corrupt a metric the branch is judged
 *                          on. `cancelled` is the honest bucket: the visit did
 *                          not happen and nobody is at fault.
 *
 *   called   → no_show     Their number WAS called and they never came. That is
 *                          precisely what no_show means, so it counts.
 *
 *   in_service → untouched Someone was at the counter and the clerk never
 *                          finished the ticket. Guessing an outcome would
 *                          either invent a service that may not have completed
 *                          or discard one that did. These are counted and
 *                          reported instead: a customer left in service
 *                          overnight is an operational problem a manager should
 *                          see, not something a cleanup job should quietly tidy
 *                          away.
 *
 * ── The part that actually fixes the metric ─────────────────────────────────
 *
 * `completed_at` is set to the branch's CLOSING TIME, not to now. That is the
 * whole point. Stamping "now" would bake the entire overnight gap into the
 * recorded wait and leave the numbers exactly as wrong as before — just wrong
 * at a fixed moment instead of growing. Closing time is also the honest answer
 * to "how long did they wait?": until the branch shut.
 *
 * Runs on a short interval rather than once nightly, because branches close at
 * their own local times and each should be tidied shortly after its own grace
 * window, not at some global 3am.
 */
const pool = require('../db/pool');

/** How long after closing to wait before calling it. Long enough for staff to
 *  finish the people already in front of them; short enough that the next
 *  morning is clean. */
const GRACE_MINUTES = (() => {
  const raw = Number(process.env.TICKET_EXPIRY_GRACE_MINUTES);
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
})();

const ENABLED = process.env.TICKET_EXPIRY_ENABLED !== 'false';

/**
 * Candidates are scoped by the branch's OWN closing time on the queue's own
 * date, so a branch that shuts at 16:00 is tidied at 17:00 regardless of what
 * any other branch does. Branches with no closing_time recorded are skipped
 * deliberately — without it there is no defensible moment to expire anything,
 * and guessing would close tickets on a branch that is genuinely still open.
 */
const CANDIDATE_SQL = `
  SELECT t.id,
         t.status,
         TIMESTAMP(q.queue_date, b.closing_time) AS closed_at,
         b.name AS branch_name
    FROM queue_tickets t
    JOIN queues   q ON q.id = t.queue_id
    JOIN branches b ON b.id = q.branch_id
   WHERE t.status = ?
     AND b.closing_time IS NOT NULL
     AND TIMESTAMP(q.queue_date, b.closing_time) + INTERVAL ? MINUTE < NOW()
   LIMIT 5000
`;

async function closeOut(conn, fromStatus, toStatus, note) {
  const [rows] = await conn.query(CANDIDATE_SQL, [fromStatus, GRACE_MINUTES]);
  if (!rows.length) return 0;

  for (const r of rows) {
    await conn.query(
      `UPDATE queue_tickets
          SET status = ?,
              completed_at = COALESCE(completed_at, ?)
        WHERE id = ? AND status = ?`,
      [toStatus, r.closed_at, r.id, fromStatus]
    );
    // An audit trail matters here: this is the system changing somebody's
    // ticket without a human touching it, and "why did my ticket cancel?" has
    // to be answerable.
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, event_timestamp, notes)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [r.id, fromStatus, toStatus, r.closed_at, note]
    );
  }
  return rows.length;
}

async function runTicketExpiry() {
  if (!ENABLED) return { enabled: false, cancelled: 0, noShow: 0, stuckInService: 0 };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const cancelled = await closeOut(
      conn, 'waiting', 'cancelled',
      'Branch closed before this number was called.'
    );
    const noShow = await closeOut(
      conn, 'called', 'no_show',
      'Called, but the branch closed before they came forward.'
    );

    // Reported, never touched — see the header.
    const [stuck] = await conn.query(CANDIDATE_SQL, ['in_service', GRACE_MINUTES]);

    await conn.commit();
    return {
      enabled: true,
      cancelled,
      noShow,
      stuckInService: stuck.length,
      stuckBranches: [...new Set(stuck.map((r) => r.branch_name))],
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { runTicketExpiry, GRACE_MINUTES };
