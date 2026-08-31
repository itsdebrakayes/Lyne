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
 *   in_service → cancelled  Someone was at the counter and the clerk never
 *                          finished the ticket.
 *
 *                          This used to be reported and left alone, on the
 *                          reasoning that a manager should see it rather than
 *                          have a job tidy it away. That reasoning holds for an
 *                          hour and fails completely over days: six tickets sat
 *                          `in_service` on queues dated 2026-08-21 for five
 *                          days, nobody ever actioned them, and all the while
 *                          they counted as live — holding positions, feeding
 *                          waiting_position, and keeping a queue row alive
 *                          across dates so the next arrival could be numbered
 *                          on top of people already in it.
 *
 *                          `cancelled` rather than `served`, and the choice is
 *                          load-bearing. Every ETA in the product comes from
 *                          AVG(started_serving_at → completed_at) over SERVED
 *                          tickets. Marking one served with completed_at at
 *                          closing time books a service that ran from 10am to
 *                          4pm, and a handful of those drag the branch's
 *                          average service time — and therefore every wait
 *                          estimate shown to every customer — into nonsense.
 *                          That is the exact corruption this file was written
 *                          to stop, so it must not be reintroduced by the fix.
 *                          The branch loses credit for a visit it probably did
 *                          perform; closed_reason keeps that recoverable, and
 *                          a wrong ETA shown to everyone costs more than a
 *                          throughput count that can be recounted later.
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
/**
 * The branch's own closing time, or the business default when it has not stated
 * one. Migration 032 makes businesses.default_closing_time NOT NULL, so this
 * COALESCE always resolves and there is no branch the sweep can silently skip.
 *
 * The old query required branches.closing_time IS NOT NULL. Every demo branch
 * happens to have one, so it never showed — but nothing enforced it, and a
 * tenant onboarded without one would have had a queue that never emptied and
 * numbering that restarted on top of live people every morning.
 */
const CANDIDATE_SQL = `
  SELECT t.id,
         t.status,
         t.user_id,
         t.ticket_number,
         t.channel,
         t.joined_at,
         t.queue_id,
         q.queue_date,
         q.service_id,
         b.id   AS branch_id,
         bz.id  AS business_id,
         bz.name AS business_name,
         s.name  AS service_name,
         TIMESTAMP(q.queue_date, COALESCE(b.closing_time, bz.default_closing_time)) AS closed_at,
         b.name AS branch_name
    FROM queue_tickets t
    JOIN queues     q  ON q.id  = t.queue_id
    JOIN branches   b  ON b.id  = q.branch_id
    JOIN businesses bz ON bz.id = b.business_id
    JOIN services   s  ON s.id  = q.service_id
   WHERE t.status = ?
     AND TIMESTAMP(q.queue_date, COALESCE(b.closing_time, bz.default_closing_time))
         + INTERVAL ? MINUTE < NOW()
   LIMIT 5000
`;

async function closeOut(conn, fromStatus, toStatus, note, reason) {
  const [rows] = await conn.query(CANDIDATE_SQL, [fromStatus, GRACE_MINUTES]);
  if (!rows.length) return 0;

  let closed = 0;
  for (const r of rows) {
    const [res] = await conn.query(
      `UPDATE queue_tickets
          SET status = ?,
              closed_reason = ?,
              completed_at = COALESCE(completed_at, ?)
        WHERE id = ? AND status = ?`,
      [toStatus, reason, r.closed_at, r.id, fromStatus]
    );
    // Lost the race to a clerk who touched the ticket between the SELECT and
    // here. Skip the history too, or the visit is recorded twice.
    if (!res.affectedRows) continue;
    closed += 1;

    /* The same history the status route writes, because this is the same event.
     *
     * PUT /tickets/:id/status records every terminal status into
     * wait_time_records and visit_history. This job bypasses that route
     * entirely — it issues its own UPDATE — so everything it closed was
     * dequeued and then vanished: absent from the analytics that measure
     * abandonment, and absent from the customer's own visit history. A person
     * who queued for two hours and was sent home when the branch shut had no
     * record they were ever there.
     *
     * The wait is measured to CLOSING TIME, not to now, for the same reason
     * completed_at is: stamping the current time would bake the overnight gap
     * into the recorded wait and reproduce the 900-minute figures this file
     * exists to prevent. service_time is NULL — nobody was served. */
    await conn.query(
      `INSERT INTO wait_time_records
         (id, ticket_id, business_id, branch_id, service_id, visit_date,
          day_of_week, hour_of_day, month_of_year,
          wait_time_minutes, service_time_minutes, status, channel,
          staff_count_at_time, queue_length_at_time, active_counters_at_time)
       SELECT UUID(), ?, ?, ?, ?, ?,
              DAYOFWEEK(?) - 1, HOUR(?), MONTH(?),
              GREATEST(0, TIMESTAMPDIFF(MINUTE, ?, ?)), NULL, ?, ?,
              (SELECT COUNT(*) FROM staff_assignments sa
                JOIN counters c2 ON c2.id = sa.counter_id
                WHERE c2.branch_id = ? AND sa.assignment_date = ?),
              (SELECT COUNT(*) FROM queue_tickets t2
                WHERE t2.queue_id = ? AND t2.status = 'waiting'),
              (SELECT COUNT(*) FROM counters c3
                WHERE c3.branch_id = ? AND c3.service_id = ? AND c3.is_active = TRUE)`,
      [r.id, r.business_id, r.branch_id, r.service_id, r.queue_date,
       r.queue_date, r.closed_at, r.queue_date,
       r.joined_at, r.closed_at, toStatus, r.channel || 'app',
       r.branch_id, r.queue_date, r.queue_id, r.branch_id, r.service_id]
    );

    // Only signed-in customers have a visit history to appear in; a walk-in
    // ticket has nobody to show it to.
    if (r.user_id) {
      await conn.query(
        `INSERT INTO visit_history
           (id, user_id, ticket_id, business_id, branch_id, service_id,
            business_name, branch_name, service_name, ticket_number, visit_date,
            wait_time_minutes, service_time_minutes, status)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 GREATEST(0, TIMESTAMPDIFF(MINUTE, ?, ?)), NULL, ?)`,
        [r.user_id, r.id, r.business_id, r.branch_id, r.service_id,
         r.business_name, r.branch_name, r.service_name, r.ticket_number,
         r.queue_date, r.joined_at, r.closed_at, toStatus]
      );
    }
    // An audit trail matters here: this is the system changing somebody's
    // ticket without a human touching it, and "why did my ticket cancel?" has
    // to be answerable.
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, event_timestamp, notes)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [r.id, fromStatus, toStatus, r.closed_at, note]
    );
  }
  return closed;
}

async function runTicketExpiry() {
  if (!ENABLED) return { enabled: false, cancelled: 0, noShow: 0, stuckInService: 0 };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const cancelled = await closeOut(
      conn, 'waiting', 'cancelled',
      'Branch closed before this number was called.',
      'branch_closed_before_called'
    );
    const noShow = await closeOut(
      conn, 'called', 'no_show',
      'Called, but the branch closed before they came forward.',
      'branch_closed_after_called'
    );
    // Still surfaced by name, because a clerk repeatedly leaving tickets open
    // IS worth a manager's attention. It is now reported AND closed, rather
    // than reported and left to accumulate.
    const [stuck] = await conn.query(CANDIDATE_SQL, ['in_service', GRACE_MINUTES]);
    const unfinished = await closeOut(
      conn, 'in_service', 'cancelled',
      'Service was never completed before the branch closed.',
      'service_not_finalised'
    );

    await conn.commit();
    return {
      enabled: true,
      cancelled,
      noShow,
      unfinished,
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
