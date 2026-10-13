/**
 * The App Review simulator — makes the fictional review organisation behave
 * like a busy branch, so a reviewer can see a line move.
 *
 * Lyne runs in tandem with counter staff using the admin application. Before
 * any organisation is live, nobody is at a counter to call the next person, so
 * a reviewer who joins a line would watch a number that never changes. This
 * job plays the counter's part, and ONLY for:
 *
 *   - the review organisation (REVIEW_BUSINESS_ID, the fictional Blue Harbour
 *     Civic Centre seeded by database/review_tenant_seed.sql), and
 *   - tickets belonging to the review account (REVIEW_ACCOUNT_EMAIL).
 *
 * Nothing outside that organisation is read or written. It is OFF unless the
 * server sets REVIEW_SIMULATOR=true, and turning that off stops it at once,
 * with no app release. The app runs exactly the same code for the reviewer as
 * for anyone else; only the speed of the line differs.
 *
 * Each tick (every 15 seconds):
 *   1. today's lines at every review branch are open, with a few made-up
 *      walk-in visitors waiting in each;
 *   2. the reviewer's Line Helper, if booked, joins within a minute rather
 *      than on the booked day (its times shift together, so the plan stays
 *      consistent);
 *   3. a reviewer's ticket moves: the person ahead is served every
 *      STEP_SECONDS; at the front it is called (with the real push), then put
 *      at the counter, then served — the same status changes and
 *      notifications staff would cause.
 */
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { issueTicketSlot } = require('../utils/ticketSlot');
const { ensureQueuesForToday } = require('../routes/queues');
const { sendPushToUser } = require('../utils/pushSender');

/** Marks the made-up visitors, so they are never mistaken for people. */
const DEMO_VISITOR = 'Review demo visitor';
/** Visitors kept waiting in each review line. */
const MIN_WAITING = 4;
/** Seconds between each step of a reviewer's visit. */
const STEP_SECONDS = 25;
const CALLED_SECONDS = 40;
const SERVING_SECONDS = 50;

function settings(env = process.env) {
  return {
    enabled: String(env.REVIEW_SIMULATOR || '').toLowerCase() === 'true',
    businessId: env.REVIEW_BUSINESS_ID || 'biz-review-demo-0001',
    email: (env.REVIEW_ACCOUNT_EMAIL || 'appreview@uselyne.com').toLowerCase(),
  };
}

const secondsSince = (t, now) => (t ? (now - new Date(t).getTime()) / 1000 : Infinity);

/* Late-bound: routes/tickets.js loads the whole router, which this job must
   not pull in at module load (it would form a cycle through index.js). */
const ticketsRoute = () => require('../routes/tickets');

/** 1 — every review line open today, with people in it. */
async function keepLinesBusy(businessId) {
  const [branches] = await pool.query(
    `SELECT id FROM branches WHERE business_id = ? AND is_active = 1`, [businessId]);
  for (const b of branches) {
    await ensureQueuesForToday(businessId, b.id);
    const [queues] = await pool.query(
      `SELECT q.id, q.branch_id, q.service_id, s.ticket_prefix, s.base_avg_time_minutes,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting') AS waiting
         FROM queues q JOIN services s ON s.id = q.service_id
        WHERE q.branch_id = ? AND q.queue_date = CURDATE() AND q.is_active = 1`, [b.id]);
    for (const q of queues) {
      for (let n = Number(q.waiting); n < MIN_WAITING; n++) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const slot = await issueTicketSlot(conn, {
            queueId: q.id, branchId: q.branch_id, serviceId: q.service_id,
            prefix: q.ticket_prefix, avgTimeMinutes: Number(q.base_avg_time_minutes) || 8, waitingAhead: n,
          });
          await conn.query(
            `INSERT INTO queue_tickets
               (id, queue_id, guest_name, channel, ticket_number, verification_code, position, status,
                estimated_wait_minutes, joined_at)
             VALUES (?, ?, ?, 'walk_in', ?, ?, ?, 'waiting', ?, NOW())`,
            [uuidv4(), q.id, DEMO_VISITOR, slot.ticketNumber, slot.verificationCode, slot.position, slot.estimatedWait]);
          await conn.commit();
        } catch (err) {
          await conn.rollback().catch(() => {});
          throw err;
        } finally {
          conn.release();
        }
      }
    }
  }
}

/** 2 — the reviewer's helper joins within a minute. */
async function hurryReviewerHelper(businessId, email) {
  await pool.query(
    `UPDATE line_helper_requests h JOIN users u ON u.id = h.user_id
        SET h.leave_home_at    = NOW() + INTERVAL 5 MINUTE,
            h.target_served_at = NOW() + INTERVAL 30 MINUTE,
            h.scheduled_join_at = NOW()
      WHERE h.status = 'scheduled' AND h.business_id = ? AND LOWER(u.email) = ?
        AND h.created_at <= NOW() - INTERVAL 30 SECOND
        AND h.scheduled_join_at > NOW()`,
    [businessId, email]);
}

/** One status change on the reviewer's ticket, through the same code staff use. */
async function moveReviewerTicket(ticketId, newStatus, now) {
  const { applyStatusChange, notifyTicketUser, broadcast } = ticketsRoute();
  const conn = await pool.getConnection();
  let push = null;
  let ticket;
  try {
    await conn.beginTransaction();
    const [[row]] = await conn.query(
      `SELECT t.*, q.branch_id, q.service_id FROM queue_tickets t JOIN queues q ON q.id = t.queue_id
        WHERE t.id = ? FOR UPDATE`, [ticketId]);
    if (!row) { await conn.rollback(); return; }
    ticket = row;
    const fields = {
      called:     [', called_at = ?, call_timeout_seconds = ?, call_expires_at = ?', [now, 300, new Date(now.getTime() + 300000)]],
      in_service: [', started_serving_at = ?', [now]],
      served:     [', completed_at = ?, readiness_outcome = ?', [now, 'ready']],
    }[newStatus];
    await applyStatusChange(conn, ticket, {
      newStatus, prevStatus: ticket.status, extraFields: fields[0], extraParams: fields[1],
      staffId: null, notes: 'App Review simulator', now,
    });
    if (newStatus === 'called') {
      push = await notifyTicketUser(conn, ticket, 'called',
        `It is your turn. ${ticket.ticket_number}, please go to the counter and show your code.`);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  const [[updated]] = await pool.query('SELECT * FROM queue_tickets WHERE id = ?', [ticketId]);
  if (updated) {
    const { verification_code: _c, ...safe } = updated;
    broadcast(ticket.queue_id, safe);
  }
  if (push) sendPushToUser(push.userId, push).catch(() => {});
}

/** 3 — the reviewer's line moves. */
async function moveReviewerLines(businessId, email, now = new Date()) {
  const { broadcast } = ticketsRoute();
  const [tickets] = await pool.query(
    `SELECT t.id, t.queue_id, t.position, t.status, t.joined_at, t.called_at, t.started_serving_at,
            (SELECT MAX(x.completed_at) FROM queue_tickets x
              WHERE x.queue_id = t.queue_id AND x.guest_name = ? AND x.completed_at IS NOT NULL) AS last_step
       FROM queue_tickets t
       JOIN users u ON u.id = t.user_id
       JOIN queues q ON q.id = t.queue_id
       JOIN branches b ON b.id = q.branch_id
      WHERE b.business_id = ? AND LOWER(u.email) = ?
        AND t.status IN ('waiting','called','in_service')`,
    [DEMO_VISITOR, businessId, email]);

  let moved = 0;
  for (const t of tickets) {
    if (t.status === 'waiting') {
      const lastMove = Math.min(secondsSince(t.last_step, now), secondsSince(t.joined_at, now));
      if (lastMove < STEP_SECONDS) continue;
      const [[ahead]] = await pool.query(
        `SELECT id FROM queue_tickets
          WHERE queue_id = ? AND status = 'waiting' AND position < ? ORDER BY position ASC LIMIT 1`,
        [t.queue_id, t.position]);
      if (ahead) {
        /* Only made-up visitors are ever served on the reviewer's behalf; a
           real person ahead (another tester) is left for real staff. */
        const [res] = await pool.query(
          `UPDATE queue_tickets
              SET status = 'served', started_serving_at = NOW() - INTERVAL 6 MINUTE, completed_at = NOW()
            WHERE id = ? AND guest_name = ? AND status = 'waiting'`,
          [ahead.id, DEMO_VISITOR]);
        if (res.affectedRows) {
          moved += 1;
          broadcast(t.queue_id, { id: ahead.id, status: 'served' });
        }
      } else {
        await moveReviewerTicket(t.id, 'called', now);
        moved += 1;
      }
    } else if (t.status === 'called' && secondsSince(t.called_at, now) >= CALLED_SECONDS) {
      await moveReviewerTicket(t.id, 'in_service', now);
      moved += 1;
    } else if (t.status === 'in_service' && secondsSince(t.started_serving_at, now) >= SERVING_SECONDS) {
      await moveReviewerTicket(t.id, 'served', now);
      moved += 1;
    }
  }
  return moved;
}

/** Yesterday's made-up visitors are removed; they are not people. */
async function clearOldVisitors(businessId) {
  await pool.query(
    `DELETE t FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id JOIN branches b ON b.id = q.branch_id
      WHERE b.business_id = ? AND t.guest_name = ? AND t.joined_at < CURDATE()`,
    [businessId, DEMO_VISITOR]);
}

async function runReviewSimulatorTick(env = process.env) {
  const s = settings(env);
  if (!s.enabled) return { enabled: false };
  await clearOldVisitors(s.businessId);
  await keepLinesBusy(s.businessId);
  await hurryReviewerHelper(s.businessId, s.email);
  const moved = await moveReviewerLines(s.businessId, s.email);
  return { enabled: true, moved };
}

module.exports = {
  runReviewSimulatorTick, settings, DEMO_VISITOR,
  STEP_SECONDS, CALLED_SECONDS, SERVING_SECONDS,
};
