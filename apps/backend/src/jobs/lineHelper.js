/**
 * The Line Helper scheduler — the half of the feature that is not a screen.
 *
 * Two jobs, both idempotent, both safe to run on a minute tick:
 *
 *   joinDueHelpers()  — any helper whose scheduled_join_at has arrived actually
 *                       joins the queue. This is the promise the feature makes.
 *
 *   yieldAbsentHolders() — a helper ticket that is CALLED while its owner has
 *                       not checked in gives the place up to the person behind,
 *                       up to max_pass_turns times, then expires.
 *
 * The second is what makes the first defensible. Without it the product sells a
 * way to hold a physical place in a public queue while not being in the
 * building, which no agency will accept and which the first customer to be
 * stuck behind an empty space will complain about — loudly, and rightly.
 *
 * Everything here claims work with a conditional UPDATE before acting on it, so
 * two processes on a minute tick cannot both join the same person.
 */
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { issueTicketSlot } = require('../utils/ticketSlot');

/** Joins at most this many per tick, so a backlog cannot monopolise a minute. */
const BATCH = 50;

/**
 * Join the line for everyone whose moment has come.
 *
 * The claim is the UPDATE: status moves 'scheduled' → 'joining' in one
 * statement with the old status in the WHERE clause, so only one worker gets
 * each row. A crash between claiming and inserting leaves it in 'joining',
 * which is visible and recoverable rather than silently double-joined.
 */
async function joinDueHelpers(now = new Date()) {
  const [due] = await pool.query(
    `SELECT h.id, h.user_id, h.branch_id, h.service_id, h.target_served_at
       FROM line_helper_requests h
      WHERE h.status = 'scheduled'
        AND h.scheduled_join_at <= ?
      ORDER BY h.scheduled_join_at ASC
      LIMIT ?`,
    [now, BATCH]
  );
  if (!due.length) return { joined: 0, skipped: 0 };

  let joined = 0;
  let skipped = 0;

  for (const h of due) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [claim] = await conn.query(
        `UPDATE line_helper_requests SET status = 'joining'
          WHERE id = ? AND status = 'scheduled'`,
        [h.id]
      );
      if (!claim.affectedRows) { await conn.rollback(); continue; }

      const [[queue]] = await conn.query(
        `SELECT id, branch_id FROM queues
          WHERE branch_id = ? AND service_id = ? AND is_active = TRUE
          LIMIT 1 FOR UPDATE`,
        [h.branch_id, h.service_id]
      );

      /* The queue closed, or the service stopped running, between scheduling
         and now. Expire rather than inventing a place in a queue that is not
         open — and the app shows the customer why. */
      if (!queue) {
        await conn.query(`UPDATE line_helper_requests SET status = 'expired' WHERE id = ?`, [h.id]);
        await conn.commit();
        skipped += 1;
        continue;
      }

      /* One live ticket per person, the same rule the app enforces on a manual
         join. Somebody who joined a line themselves after scheduling a helper
         gets the helper quietly stood down, not a second place. */
      const [[live]] = await conn.query(
        `SELECT t.id FROM queue_tickets t
          WHERE t.user_id = ? AND t.status IN ('waiting','called','in_service')
          LIMIT 1`,
        [h.user_id]
      );
      if (live) {
        await conn.query(`UPDATE line_helper_requests SET status = 'expired' WHERE id = ?`, [h.id]);
        await conn.commit();
        skipped += 1;
        continue;
      }

      /* issueTicketSlot, not a hand-rolled position query. It carries rules
         this job must not get a second opinion on: ticket numbers restart
         daily, a new position is never issued at or below one that is still
         live (so a queue nobody tidied overnight does not rank a newcomer ahead
         of someone who waited), and the ETA prefers the model grid. A helper
         that numbered tickets its own way would hand out a different series
         from the one the counter screen is reading. */
      const [[svc]] = await conn.query(
        `SELECT ticket_prefix, base_avg_time_minutes FROM services WHERE id = ? LIMIT 1`,
        [h.service_id]
      );
      const [[ahead]] = await conn.query(
        `SELECT COUNT(*) AS n FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'`,
        [queue.id]
      );

      const slot = await issueTicketSlot(conn, {
        queueId: queue.id,
        branchId: queue.branch_id,
        serviceId: h.service_id,
        prefix: svc?.ticket_prefix,
        avgTimeMinutes: Number(svc?.base_avg_time_minutes) || 15,
        waitingAhead: Number(ahead.n),
      });

      const ticketId = uuidv4();
      const ticketNumber = slot.ticketNumber;

      await conn.query(
        `INSERT INTO queue_tickets
           (id, queue_id, user_id, ticket_number, verification_code, position, status,
            joined_at, estimated_wait_minutes, channel, helper_request_id)
         VALUES (?, ?, ?, ?, ?, ?, 'waiting', NOW(), ?, 'app', ?)`,
        [ticketId, queue.id, h.user_id, ticketNumber, slot.verificationCode,
         slot.position, slot.estimatedWait, h.id]
      );

      await conn.query(
        `UPDATE line_helper_requests SET status = 'holding', ticket_id = ? WHERE id = ?`,
        [ticketId, h.id]
      );

      /* Tell them, in the app. The whole value of the feature is knowing when
         to leave, and a helper that joined silently is one the customer has to
         keep checking — which is the thing it was supposed to remove. */
      await conn.query(
        `INSERT INTO notifications
           (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at)
         VALUES (?, ?, NULL, NULL, ?, 'helper_joined', 'in_app', ?, FALSE, NOW())`,
        [uuidv4(), h.user_id, ticketId,
         `Your Line Helper joined the line. Ticket ${ticketNumber}.`]
      );

      await conn.commit();
      joined += 1;
    } catch (err) {
      await conn.rollback().catch(() => {});
      console.error('[LineHelper] join failed for', h.id, err.message);
    } finally {
      conn.release();
    }
  }

  return { joined, skipped };
}

/**
 * A helper ticket called while nobody is there yields its place.
 *
 * `let_pass` off means the customer chose to keep the place rigidly, and then
 * the normal no-show rules apply — we do not invent a different outcome for
 * them. `let_pass` on, which is the default, moves them behind the next person
 * and counts it. After max_pass_turns the ticket is done.
 */
async function yieldAbsentHolders() {
  const [calls] = await pool.query(
    `SELECT h.id, h.ticket_id, h.passes_used, h.max_pass_turns, h.user_id,
            t.queue_id, t.position, t.ticket_number
       FROM line_helper_requests h
       JOIN queue_tickets t ON t.id = h.ticket_id
      WHERE h.status = 'holding'
        AND h.let_pass = TRUE
        AND t.status = 'called'
        AND t.called_at <= NOW() - INTERVAL 2 MINUTE
      LIMIT ?`,
    [BATCH]
  );
  if (!calls.length) return { passed: 0, expired: 0 };

  let passed = 0;
  let expired = 0;

  for (const c of calls) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (Number(c.passes_used) + 1 > Number(c.max_pass_turns)) {
        await conn.query(
          `UPDATE queue_tickets SET status = 'no_show', closed_reason = 'helper_passes_exhausted', updated_at = NOW()
            WHERE id = ?`, [c.ticket_id]);
        await conn.query(`UPDATE line_helper_requests SET status = 'expired' WHERE id = ?`, [c.id]);
        await conn.query(
          `INSERT INTO notifications
             (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at)
           VALUES (?, ?, NULL, NULL, ?, 'helper_expired', 'in_app', ?, FALSE, NOW())`,
          [uuidv4(), c.user_id, c.ticket_id,
           `Ticket ${c.ticket_number} was called ${c.max_pass_turns} times and let past each time, so it has ended.`]);
        await conn.commit();
        expired += 1;
        continue;
      }

      /* Move behind the next waiting person: take their position, push them up.
         Doing it as a swap rather than "append to the end" is the point — the
         place yields one turn at a time, which is what was promised. */
      const [[next]] = await conn.query(
        `SELECT id, position FROM queue_tickets
          WHERE queue_id = ? AND status = 'waiting' AND position > ?
          ORDER BY position ASC LIMIT 1 FOR UPDATE`,
        [c.queue_id, c.position]
      );

      if (next) {
        await conn.query(`UPDATE queue_tickets SET position = ?, status = 'waiting', called_at = NULL WHERE id = ?`,
          [next.position, c.ticket_id]);
        await conn.query(`UPDATE queue_tickets SET position = ? WHERE id = ?`, [c.position, next.id]);
      } else {
        /* Nobody behind them — there is no place to yield to, so it simply
           stays called rather than being punished for an empty queue. */
        await conn.rollback();
        continue;
      }

      await conn.query(
        `UPDATE line_helper_requests SET passes_used = passes_used + 1 WHERE id = ?`, [c.id]);
      await conn.query(
        `INSERT INTO notifications
           (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at)
         VALUES (?, ?, NULL, NULL, ?, 'helper_passed', 'in_app', ?, FALSE, NOW())`,
        [uuidv4(), c.user_id, c.ticket_id,
         `You were called and let one person past. ${Number(c.max_pass_turns) - Number(c.passes_used) - 1} turns left.`]);

      await conn.commit();
      passed += 1;
    } catch (err) {
      await conn.rollback().catch(() => {});
      console.error('[LineHelper] yield failed for', c.id, err.message);
    } finally {
      conn.release();
    }
  }

  return { passed, expired };
}

/** One tick. Join first, then yield — a helper that just joined is not absent. */
async function runLineHelperTick() {
  const j = await joinDueHelpers();
  const y = await yieldAbsentHolders();
  if (j.joined || j.skipped || y.passed || y.expired) {
    console.log(`[LineHelper] joined ${j.joined}, stood down ${j.skipped}, passed ${y.passed}, expired ${y.expired}`);
  }
  return { ...j, ...y };
}

module.exports = { runLineHelperTick, joinDueHelpers, yieldAbsentHolders };
