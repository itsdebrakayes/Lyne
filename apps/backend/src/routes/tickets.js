/**
 * tickets.js — Core queue ticket operations
 *
 * POST /api/tickets                    — join a queue (authenticated user)
 * GET  /api/tickets/queue/:queue_id    — get all tickets for a queue (staff)
 * GET  /api/tickets/:id                — get ticket + position (public, by ticket id)
 * PUT  /api/tickets/:id/status         — update ticket status (staff only)
 * PUT  /api/tickets/:id/move-up        — move waiting ticket up one position (staff)
 * PUT  /api/tickets/:id/move-down      — move waiting ticket down one position (staff)
 * GET  /api/tickets/:id/position       — get customer position among WAITING only
 *
 * STATUS VALUES:
 *   waiting    — customer is in line
 *   called     — staff called customer forward; code still needs verification
 *   in_service — customer is currently being served at the counter
 *   served     — service completed
 *   no_show    — customer did not arrive after being called
 *   left       — customer joined but abandoned the queue
 *   cancelled  — ticket invalidated intentionally
 *
 * QUEUE COUNT RULE: Visible queue length counts WAITING tickets only.
 *   in_service tickets are being served and must NOT be included in the
 *   visible queue count shown to users.
 */
const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { requireStaffRole, requireQueueAccess, requireTicketAccess } = require('../middleware/tenantAccess');
const { sendPushToUser } = require('../utils/pushSender');

const { estimateWaitMinutes } = require('../utils/waitEstimator');
const { remoteJoinBlockedUntil, REMOTE_JOIN_BUFFER } = require('../utils/joinWindow');
const { projectedWaitMinutes } = require('../utils/etaMath');
const { issueTicketSlot } = require('../utils/ticketSlot');

const DEFAULT_CALL_TIMEOUT_SECONDS = 120;
const MIN_CALL_TIMEOUT_SECONDS = 30;
const MAX_CALL_TIMEOUT_SECONDS = 30 * 60;

function validationMessage(error) {
  return error.issues?.[0]?.message || 'Invalid request data.';
}

/**
 * The wait a customer sees on their live ticket, recomputed from the CURRENT
 * line — not the value frozen at join. It shrinks as people ahead are served,
 * and is counter-aware (see utils/etaMath.js), so a passport queue that once
 * read a frozen "245m" now shows the honest, falling estimate. Requires the
 * waiting_position / active_counters / service_minutes columns to be selected.
 */
function liveTicketWait(ticket) {
  if (ticket.status !== 'waiting') return 0; // called / in service — you're up
  const ahead = Math.max(0, (Number(ticket.waiting_position) || 1) - 1);
  return projectedWaitMinutes({
    ahead,
    perServiceMinutes: ticket.service_minutes,
    counters: ticket.active_counters,
  });
}

// Lazy-load to avoid circular dependency at startup
function broadcast(queueId, ticket) {
  try {
    const { broadcastQueueUpdate } = require('./sse');
    broadcastQueueUpdate(queueId, ticket).catch(() => {});
  } catch { /* sse module not yet loaded */ }
}

// Validation schemas
const joinQueueSchema = z.object({
  queue_id:               z.string().min(1).max(64),
  form_data:              z.record(z.unknown()).optional(),
  readiness_acknowledged: z.boolean().optional(),
});

// A kiosk clerk adds a walk-in (someone at the branch without the app). They
// pick a service; the branch is the clerk's own. Name is required so line staff
// have someone to call; phone is optional (used for an SMS follow-up later).
const walkInSchema = z.object({
  service_id:  z.string().min(1).max(64),
  guest_name:  z.string().trim().min(1, 'A name is required to add a walk-in.').max(120),
  guest_phone: z.string().trim().max(30).optional(),
});

const updateStatusSchema = z.object({
  new_status: z.enum(['called', 'in_service', 'served', 'left', 'cancelled', 'no_show'], {
    errorMap: () => ({ message: 'new_status must be one of: called, in_service, served, left, cancelled, no_show' }),
  }),
  verification_code: z.string().max(12).optional(),
  call_timeout_seconds: z.number().int().min(MIN_CALL_TIMEOUT_SECONDS).max(MAX_CALL_TIMEOUT_SECONDS).optional(),
  notes: z.string().max(1000).optional(),
  readiness_outcome: z.enum(['ready', 'incomplete']).optional(),
  readiness_note: z.string().trim().max(255).optional(),
});

function periodCondition(period, month) {
  if (period === 'this_week') {
    return { sql: 'YEARWEEK(COALESCE(t.completed_at, t.called_at, t.joined_at), 1) = YEARWEEK(CURDATE(), 1)', params: [] };
  }
  if (period === 'last_week') {
    return { sql: 'YEARWEEK(COALESCE(t.completed_at, t.called_at, t.joined_at), 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)', params: [] };
  }
  if (period === 'month') {
    const safeMonth = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
    return { sql: "DATE_FORMAT(COALESCE(t.completed_at, t.called_at, t.joined_at), '%Y-%m') = ?", params: [safeMonth] };
  }
  return { sql: 'DATE(COALESCE(t.completed_at, t.called_at, t.joined_at)) = CURDATE()', params: [] };
}

function safeCallTimeout(seconds) {
  const value = Number(seconds || DEFAULT_CALL_TIMEOUT_SECONDS);
  if (!Number.isFinite(value)) return DEFAULT_CALL_TIMEOUT_SECONDS;
  return Math.max(MIN_CALL_TIMEOUT_SECONDS, Math.min(MAX_CALL_TIMEOUT_SECONDS, Math.round(value)));
}

async function inferActiveCounter(conn, staffId, queueId) {
  if (!staffId) return null;
  const [rows] = await conn.query(
    `SELECT c.id
     FROM staff_assignments sa
     JOIN counters c ON c.id = sa.counter_id
     JOIN queues q ON q.id = ?
     WHERE sa.staff_id = ?
       AND sa.assignment_date = CURDATE()
       AND c.branch_id = q.branch_id
       AND c.service_id = q.service_id
       AND c.is_active = TRUE
     ORDER BY sa.shift_start IS NULL, sa.shift_start DESC, c.counter_number
     LIMIT 1`,
    [queueId, staffId]
  );
  return rows[0]?.id || null;
}

/* Lock-screen copy is deliberately vague. Lyne serves government agencies,
   clinics and immigration desks, so the SERVICE NAME alone — "HIV Clinic",
   "Unemployment Benefits", "Passport Renewal" — is the leak the moment it lands
   on a lock screen somebody else can read. The push used to carry the full
   detailed message, which for a call read "A-014 is being called for
   {service}."

   The detail still exists; it goes to the in-app notification row, which sits
   behind authentication. The push only says something changed. */
const PUSH_TITLES = {
  called: 'Your queue update',
  no_show: 'Your queue update',
};

const NEUTRAL_PUSH_BODIES = {
  called: 'It is your turn. Open Lyne for the details.',
  no_show: 'Your place in line has changed. Open Lyne for the details.',
  queue_update: 'Your queue status has changed. Open Lyne for the details.',
};

/**
 * Records an in-app notification row inside the caller's transaction and
 * returns the matching push payload. The caller must deliver the push with
 * sendPushToUser AFTER the transaction commits, so a rollback never
 * produces a phantom notification on the customer's phone.
 */
async function notifyTicketUser(conn, ticket, notificationType, message) {
  if (!ticket?.user_id) return null;
  await conn.query(
    `INSERT INTO notifications (id, user_id, ticket_id, notification_type, channel, message)
     VALUES (?, ?, ?, ?, 'push', ?)`,
    [uuidv4(), ticket.user_id, ticket.id, notificationType, message]
  );
  return {
    userId: ticket.user_id,
    title: PUSH_TITLES[notificationType] || 'Your queue update',
    // Never `message` — that is the detailed in-app text inserted just above.
    body: NEUTRAL_PUSH_BODIES[notificationType] || NEUTRAL_PUSH_BODIES.queue_update,
    data: { ticketId: ticket.id, type: notificationType },
  };
}

// POST /api/tickets — Join a queue
router.post('/', requireAuth, async (req, res) => {
  const parsed = joinQueueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { queue_id, form_data, readiness_acknowledged } = parsed.data;

    const [queues] = await conn.query(
      'SELECT * FROM queues WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [queue_id]
    );
    if (!queues.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Queue not found or is closed.' });
    }
    const queue = queues[0];

    // Walk-ins first — this route is the customer app (channel 'app'), so remote
    // joining opens a few minutes after the branch does. See utils/joinWindow.js.
    const [branchRows] = await conn.query(
      'SELECT opening_time, open_days FROM branches WHERE id = ?',
      [queue.branch_id]
    );
    const remoteOpensAt = remoteJoinBlockedUntil(branchRows[0]);
    if (remoteOpensAt) {
      await conn.rollback();
      return res.status(409).json({
        error: `Remote joining opens at ${remoteOpensAt.toTimeString().slice(0, 5)}. `
          + `The first ${REMOTE_JOIN_BUFFER} minutes are reserved for customers already at the branch.`,
      });
    }

    // One live ticket per customer — a person cannot hold places in several
    // lines at once, and the apps are built around a single active ticket.
    if (req.dbUser?.id) {
      const [activeRows] = await conn.query(
        `SELECT t.ticket_number, s.name AS service_name
         FROM queue_tickets t
         JOIN queues q ON q.id = t.queue_id
         LEFT JOIN services s ON s.id = q.service_id
         WHERE t.user_id = ? AND t.status IN ('waiting', 'called', 'in_service')
         LIMIT 1`,
        [req.dbUser.id]
      );
      if (activeRows.length) {
        await conn.rollback();
        return res.status(409).json({
          error: `You are already in line (${activeRows[0].ticket_number} · ${activeRows[0].service_name || 'current queue'}). Leave or finish that queue before joining another.`,
        });
      }
    }

    // Count WAITING only — in_service are being served and should not block capacity
    const [countRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'",
      [queue_id]
    );
    if (countRows[0].cnt >= queue.max_capacity) {
      await conn.rollback();
      return res.status(409).json({ error: 'Queue is at full capacity.' });
    }

    const [svcRows] = await conn.query(
      `SELECT ticket_prefix, base_avg_time_minutes,
              (SELECT COUNT(*) FROM service_readiness sr
                WHERE sr.service_id = services.id AND sr.is_active = TRUE) AS readiness_count
       FROM services WHERE id = ?`,
      [queue.service_id]
    );
    const prefix  = svcRows[0]?.ticket_prefix || 'Q';
    const avgTime = svcRows[0]?.base_avg_time_minutes || 15;
    const hasReadinessChecklist = Number(svcRows[0]?.readiness_count || 0) > 0;
    if (hasReadinessChecklist && readiness_acknowledged !== true) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Review and confirm the service checklist before joining this queue.',
      });
    }
    const { position, ticketNumber, estimatedWait, verificationCode } = await issueTicketSlot(conn, {
      queueId: queue_id,
      branchId: queue.branch_id,
      serviceId: queue.service_id,
      prefix,
      avgTimeMinutes: avgTime,
      waitingAhead: countRows[0].cnt,
    });

    let intakeFormId = null;
    if (form_data) {
      intakeFormId = uuidv4();
      await conn.query(
        'INSERT INTO intake_forms (id, service_id, user_id, form_data) VALUES (?, ?, ?, ?)',
        [intakeFormId, queue.service_id, req.dbUser?.id || null, JSON.stringify(form_data)]
      );
    }

    const ticketId = uuidv4();
    await conn.query(
      // channel is explicit ('app' is also the column default): this route is the
      // customer app, and the walk-in buffer above depends on that distinction.
      `INSERT INTO queue_tickets
         (id, queue_id, user_id, intake_form_id, ticket_number, verification_code, position, status,
          estimated_wait_minutes, channel, readiness_shown_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, 'app', ?)`,
      [
        ticketId, queue_id, req.dbUser?.id || null, intakeFormId, ticketNumber,
        verificationCode, position, estimatedWait, hasReadinessChecklist ? new Date() : null,
      ]
    );

    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status)
       VALUES (?, ?, NULL, 'waiting')`,
      [uuidv4(), ticketId]
    );

    await conn.commit();
    const [ticket] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticketId]);
    broadcast(queue_id, ticket[0]);
    res.status(201).json(ticket[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to join queue.' });
  } finally {
    conn.release();
  }
});

// POST /api/tickets/walk-in — a kiosk clerk adds a walk-in customer
//
// This is the counterpart to POST / (the customer app). It exists so a branch
// can put someone WITHOUT the app into the same line, on their behalf. Key
// differences from the app join:
//   • Actor is a kiosk_clerk, and the branch is theirs — not caller-supplied.
//   • The ticket is a guest (user_id NULL, name/phone carried on the row).
//   • channel = 'kiosk', so the walk-in-vs-online analytics can tell them apart.
//   • The remote-join buffer does NOT apply — walk-ins are physically present;
//     that buffer exists to protect them, so applying it here would be backwards.
router.post('/walk-in', requireAuth, requireStaffRole('kiosk_clerk'), async (req, res) => {
  const parsed = walkInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }
  const branchId = req.dbStaff?.branch_id;
  if (!branchId) {
    return res.status(403).json({ error: 'This kiosk account is not assigned to a branch.' });
  }
  const { service_id, guest_name, guest_phone } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // The service must be one this branch actually offers (has an active counter
    // for) — this both validates the pick and enforces tenant isolation, since
    // counters are branch-scoped and the branch is the clerk's own.
    const [svcRows] = await conn.query(
      `SELECT s.id, s.ticket_prefix, s.base_avg_time_minutes
       FROM services s
       WHERE s.id = ?
         AND EXISTS (
           SELECT 1 FROM counters c
           WHERE c.service_id = s.id AND c.branch_id = ? AND c.is_active = TRUE
         )
       LIMIT 1`,
      [service_id, branchId]
    );
    if (!svcRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'That service is not offered at this branch.' });
    }
    const prefix  = svcRows[0].ticket_prefix || 'Q';
    const avgTime = svcRows[0].base_avg_time_minutes || 15;

    // Ensure today's queue exists for this branch+service, then lock it. Mirrors
    // the queue-ensure in queues.js so a walk-in can open the day's first line.
    const today = new Date().toISOString().slice(0, 10);
    await conn.query(
      `INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity)
       VALUES (?, ?, ?, ?, 50)
       ON DUPLICATE KEY UPDATE is_active = TRUE`,
      [uuidv4(), branchId, service_id, today]
    );
    const [queues] = await conn.query(
      'SELECT * FROM queues WHERE branch_id = ? AND service_id = ? AND queue_date = ? FOR UPDATE',
      [branchId, service_id, today]
    );
    const queue = queues[0];

    const [countRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'",
      [queue.id]
    );
    if (countRows[0].cnt >= queue.max_capacity) {
      await conn.rollback();
      return res.status(409).json({ error: 'Queue is at full capacity.' });
    }

    // Identical arithmetic to the app join — same daily reset, same counter-aware
    // ETA — so a walk-in's estimate agrees with what the app would show for the
    // same spot in line.
    const { position, ticketNumber, estimatedWait, verificationCode } = await issueTicketSlot(conn, {
      queueId: queue.id,
      branchId,
      serviceId: service_id,
      prefix,
      avgTimeMinutes: avgTime,
      waitingAhead: countRows[0].cnt,
    });

    const ticketId = uuidv4();
    await conn.query(
      `INSERT INTO queue_tickets
         (id, queue_id, user_id, guest_name, guest_phone, ticket_number, verification_code, position, status, estimated_wait_minutes, channel)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'waiting', ?, 'kiosk')`,
      [ticketId, queue.id, guest_name, guest_phone || null, ticketNumber, verificationCode, position, estimatedWait]
    );
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status)
       VALUES (?, ?, NULL, 'waiting')`,
      [uuidv4(), ticketId]
    );

    await conn.commit();
    const [ticket] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticketId]);
    broadcast(queue.id, ticket[0]);
    res.status(201).json(ticket[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to add walk-in.' });
  } finally {
    conn.release();
  }
});

// GET /api/tickets/queue/:queue_id — All tickets for a queue (staff)
// MUST be declared before /:id
router.get('/queue/:queue_id', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireQueueAccess, async (req, res) => {
  try {
    const [tickets] = await pool.query(
      `SELECT t.id, t.queue_id, t.user_id, t.ticket_number, t.position, t.status,
              t.estimated_wait_minutes, t.joined_at, t.called_at, t.started_serving_at,
              t.completed_at, t.call_timeout_seconds, t.call_expires_at,
              t.served_by_staff_id, t.served_at_counter_id,
              t.readiness_shown_at, t.readiness_outcome, t.readiness_note,
              (SELECT COUNT(*) FROM service_readiness sr
                WHERE sr.service_id = q.service_id AND sr.is_active = TRUE) AS readiness_item_count,
              u.full_name AS user_name, u.phone AS user_phone,
              c.label AS counter_label, c.counter_number
       FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN counters c ON c.id = t.served_at_counter_id
       WHERE t.queue_id = ?
       ORDER BY t.position`,
      [req.params.queue_id]
    );
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

// GET /api/tickets/history?period=today|this_week|last_week|month&month=YYYY-MM
// Staff see their own served/no-show tickets; managers/executives see their scoped branch/business.
router.get('/history', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), async (req, res) => {
  try {
    const period = ['today', 'this_week', 'last_week', 'month'].includes(req.query.period)
      ? req.query.period
      : 'today';
    const dateFilter = periodCondition(period, req.query.month);
    const conditions = [
      "t.status IN ('served', 'no_show')",
      dateFilter.sql,
      'b.business_id = ?',
    ];
    const params = [...dateFilter.params, req.dbStaff.business_id];

    if (req.dbStaff.role_name === 'line_staff') {
      conditions.push('t.served_by_staff_id = ?');
      params.push(req.dbStaff.id);
    } else if (req.dbStaff.role_name === 'manager' && req.dbStaff.branch_id) {
      conditions.push('q.branch_id = ?');
      params.push(req.dbStaff.branch_id);
    } else if (req.query.branch_id) {
      conditions.push('q.branch_id = ?');
      params.push(req.query.branch_id);
    }

    if (req.query.service_id) {
      conditions.push('q.service_id = ?');
      params.push(req.query.service_id);
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.ticket_number, t.status, t.position, t.joined_at, t.called_at,
              t.started_serving_at, t.completed_at, t.call_timeout_seconds, t.call_expires_at,
              u.full_name AS user_name,
              q.id AS queue_id, q.queue_date,
              b.id AS branch_id, b.name AS branch_name,
              s.id AS service_id, s.name AS service_name,
              st.id AS staff_id, st.full_name AS staff_name, st.staff_code,
              c.label AS counter_label, c.counter_number,
              ROUND(TIMESTAMPDIFF(SECOND, t.joined_at, COALESCE(t.started_serving_at, t.called_at, t.completed_at)) / 60, 1) AS wait_minutes,
              ROUND(TIMESTAMPDIFF(SECOND, t.started_serving_at, t.completed_at) / 60, 1) AS service_minutes
       FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id
       JOIN branches b ON b.id = q.branch_id
       JOIN services s ON s.id = q.service_id
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN staff st ON st.id = t.served_by_staff_id
       LEFT JOIN counters c ON c.id = t.served_at_counter_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY COALESCE(t.completed_at, t.called_at, t.joined_at) DESC
       LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ticket history.' });
  }
});

// GET /api/tickets/active — recover the authenticated user's current ticket
router.get('/active', requireAuth, async (req, res) => {
  try {
    if (!req.dbUser?.id) return res.status(403).json({ error: 'User account required.' });

    const [rows] = await pool.query(
      `SELECT t.*,
              q.branch_id, q.service_id, q.queue_date,
              b.name AS branch_name,
              s.name AS service_name,
              (SELECT COUNT(*) + 1
               FROM queue_tickets t2
               WHERE t2.queue_id = t.queue_id
                 AND t2.status = 'waiting'
                 AND t2.position < t.position) AS waiting_position,
              (SELECT COUNT(*)
               FROM queue_tickets t3
               WHERE t3.queue_id = t.queue_id
                 AND t3.status = 'waiting') AS total_waiting,
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE) AS active_counters,
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(t4.started_serving_at, t4.called_at, t4.joined_at), t4.completed_at))
                FROM queue_tickets t4
                WHERE t4.queue_id = t.queue_id AND t4.status = 'served' AND t4.completed_at IS NOT NULL
              ), s.base_avg_time_minutes) AS service_minutes
       FROM queue_tickets t
       JOIN queues   q ON t.queue_id   = q.id
       JOIN branches b ON q.branch_id  = b.id
       JOIN services s ON q.service_id = s.id
       WHERE t.user_id = ? AND t.status IN ('waiting', 'called', 'in_service')
       ORDER BY t.joined_at DESC
       LIMIT 1`,
      [req.dbUser.id]
    );

    if (!rows.length) return res.json(null);

    const ticket = rows[0];
    const isNext = ticket.status === 'waiting' && ticket.waiting_position === 1;
    res.json({
      ...ticket,
      estimated_wait_minutes: liveTicketWait(ticket),
      is_next: isNext,
      status_message: isNext ? "You're next!" : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to recover active ticket.' });
  }
});

// GET /api/tickets/:id/position — Customer position among WAITING only
// MUST be declared before /:id
router.get('/:id/position', requireAuth, requireTicketAccess, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.status, t.queue_id,
              (SELECT COUNT(*) + 1
               FROM queue_tickets t2
               WHERE t2.queue_id = t.queue_id
                 AND t2.status = 'waiting'
                 AND t2.position < t.position) AS waiting_position,
              (SELECT COUNT(*)
               FROM queue_tickets t3
               WHERE t3.queue_id = t.queue_id
                 AND t3.status = 'waiting') AS total_waiting
       FROM queue_tickets t
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });

    const row = rows[0];
    const isNext = row.status === 'waiting' && row.waiting_position === 1;

    res.json({
      ticket_id:        row.id,
      status:           row.status,
      waiting_position: row.status === 'waiting' ? row.waiting_position : null,
      total_waiting:    row.total_waiting,
      is_next:          isNext,
      status_message:   isNext ? "You're next!" : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch position.' });
  }
});

// GET /api/tickets/guest/:token — a guest re-opens their own ticket
//
// MUST be declared before /:id.
//
// Migration 023 added guest_access_token so somebody who joined from a browser
// could come back to their own ticket without an account — and then nothing
// ever read it. The session portal made that gap load-bearing: a motorist checks
// in from the portal, is handed a token, and until now had nowhere to spend it.
// Their only other option was GET /:id, which requires a Supabase session they
// were deliberately never asked to create.
//
// The token IS the authorisation. It is 43 random characters, unique-indexed,
// issued server-side and returned exactly once, so possession proves ownership
// of this one ticket and grants nothing else. Note what is NOT selected:
// verification_code stays server-side, because a token that leaked would
// otherwise let somebody answer for a person at the counter.
router.get('/guest/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '');
    // Cheap shape check before touching the database — this endpoint is
    // unauthenticated, so it should not turn every stray request into a query.
    if (token.length < 32 || token.length > 64) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const [rows] = await pool.query(
      `SELECT t.id, t.queue_id, t.ticket_number, t.status, t.position,
              t.joined_at, t.called_at, t.guest_name,
              q.branch_id, q.service_id,
              b.name AS branch_name, b.address AS branch_address,
              biz.name AS business_name,
              s.name AS service_name,
              (SELECT COUNT(*) + 1
                 FROM queue_tickets t2
                WHERE t2.queue_id = t.queue_id AND t2.status = 'waiting'
                  AND t2.position < t.position) AS waiting_position,
              (SELECT COUNT(*) FROM queue_tickets t3
                WHERE t3.queue_id = t.queue_id AND t3.status = 'waiting') AS total_waiting,
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE) AS active_counters,
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(t4.started_serving_at, t4.called_at, t4.joined_at), t4.completed_at))
                  FROM queue_tickets t4
                 WHERE t4.queue_id = t.queue_id AND t4.status = 'served' AND t4.completed_at IS NOT NULL
              ), s.base_avg_time_minutes) AS service_minutes
         FROM queue_tickets t
         JOIN queues     q   ON t.queue_id    = q.id
         JOIN branches   b   ON q.branch_id   = b.id
         JOIN businesses biz ON b.business_id = biz.id
         JOIN services   s   ON q.service_id  = s.id
        WHERE t.guest_access_token = ?
        LIMIT 1`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });

    const ticket = rows[0];
    const isNext = ticket.status === 'waiting' && ticket.waiting_position === 1;
    res.json({
      ...ticket,
      estimated_wait_minutes: liveTicketWait(ticket),
      is_next: isNext,
      status_message: isNext ? "You're next!" : null,
    });
  } catch (err) {
    console.error('tickets/guest:', err);
    res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// GET /api/tickets/:id — Get ticket status
router.get('/:id', requireAuth, requireTicketAccess, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*,
              q.branch_id, q.service_id, q.queue_date,
              b.business_id,
              b.name AS branch_name,
              biz.name AS business_name,
              s.name AS service_name,
              (SELECT COUNT(*) + 1
               FROM queue_tickets t2
               WHERE t2.queue_id = t.queue_id
                 AND t2.status = 'waiting'
                 AND t2.position < t.position) AS waiting_position,
              (SELECT COUNT(*)
               FROM queue_tickets t3
               WHERE t3.queue_id = t.queue_id
                 AND t3.status = 'waiting') AS total_waiting,
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE) AS active_counters,
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(t4.started_serving_at, t4.called_at, t4.joined_at), t4.completed_at))
                FROM queue_tickets t4
                WHERE t4.queue_id = t.queue_id AND t4.status = 'served' AND t4.completed_at IS NOT NULL
              ), s.base_avg_time_minutes) AS service_minutes
       FROM queue_tickets t
       JOIN queues     q   ON t.queue_id   = q.id
       JOIN branches   b   ON q.branch_id  = b.id
       JOIN businesses biz ON b.business_id = biz.id
       JOIN services   s   ON q.service_id = s.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });

    const ticket = rows[0];
    const isNext = ticket.status === 'waiting' && ticket.waiting_position === 1;

    if (req.dbStaff) {
      delete ticket.verification_code;
    }

    res.json({
      ...ticket,
      estimated_wait_minutes: liveTicketWait(ticket),
      is_next:       isNext,
      status_message: isNext ? "You're next!" : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// PUT /api/tickets/:id/status — Update ticket status
// Transitions: waiting->in_service, in_service->served, *->left, *->cancelled
router.put('/:id/leave', requireAuth, requireTicketAccess, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tickets] = await conn.query(
      'SELECT * FROM queue_tickets WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket = tickets[0];
    if (!['waiting', 'called'].includes(ticket.status)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Only waiting or called tickets can leave the queue.' });
    }
    await conn.query('UPDATE queue_tickets SET status = ? WHERE id = ?', ['left', ticket.id]);
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, notes)
       VALUES (?, ?, ?, 'left', 'Customer left queue from mobile app')`,
      [uuidv4(), ticket.id, ticket.status]
    );
    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM queue_tickets WHERE id = ?', [ticket.id]);
    broadcast(ticket.queue_id, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to leave queue.' });
  } finally {
    conn.release();
  }
});

router.put('/:id/status', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireTicketAccess, async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { new_status, verification_code, notes, readiness_outcome, readiness_note } = parsed.data;

    const [tickets] = await conn.query(
      `SELECT t.*, q.branch_id, q.service_id, b.business_id, b.name AS branch_name, s.name AS service_name,
              (SELECT COUNT(*) FROM service_readiness sr
                WHERE sr.service_id = q.service_id AND sr.is_active = TRUE) AS readiness_item_count
       FROM queue_tickets t
       JOIN queues q ON t.queue_id = q.id
       JOIN branches b ON q.branch_id = b.id
       JOIN services s ON q.service_id = s.id
       WHERE t.id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket     = tickets[0];
    const prevStatus = ticket.status;
    const activeCounterId = await inferActiveCounter(conn, req.dbStaff?.id, ticket.queue_id);

    if (new_status === 'called' && prevStatus !== 'waiting') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only waiting tickets can be called.' });
    }
    if (new_status === 'in_service' && !['called', 'waiting'].includes(prevStatus)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Only called or waiting tickets can be moved to in_service.' });
    }
    if (new_status === 'served' && prevStatus !== 'in_service') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only in_service tickets can be marked served.' });
    }
    if (new_status === 'served' && Number(ticket.readiness_item_count || 0) > 0 && !readiness_outcome) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Record whether the member was ready before completing this visit.',
      });
    }
    if (readiness_outcome === 'incomplete' && (!readiness_note || readiness_note.trim().length < 3)) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Add a short note about what was missing or not completed.',
      });
    }
    if (new_status === 'no_show' && !['called', 'waiting'].includes(prevStatus)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Only called or waiting tickets can be marked no_show.' });
    }
    if (new_status === 'in_service' && !verification_code) {
      await conn.rollback();
      return res.status(400).json({ error: 'Ticket verification code is required to start service.' });
    }
    if (new_status === 'in_service' && verification_code.trim().toUpperCase() !== ticket.verification_code) {
      await conn.rollback();
      return res.status(403).json({ error: 'Invalid ticket verification code.' });
    }

    const now = new Date();
    let extraFields = '';
    let extraParams = [];

    if (new_status === 'called') {
      const callTimeout = safeCallTimeout(parsed.data.call_timeout_seconds);
      const callExpiresAt = new Date(now.getTime() + callTimeout * 1000);
      extraFields = ', called_at = ?, call_timeout_seconds = ?, call_expires_at = ?, served_by_staff_id = ?, served_at_counter_id = COALESCE(?, served_at_counter_id)';
      extraParams = [now, callTimeout, callExpiresAt, req.dbStaff?.id || null, activeCounterId];
    } else if (new_status === 'in_service') {
      extraFields = ', started_serving_at = ?, served_by_staff_id = ?, served_at_counter_id = COALESCE(?, served_at_counter_id)';
      extraParams = [now, req.dbStaff?.id || null, activeCounterId];
    } else if (new_status === 'served') {
      extraFields = ', completed_at = ?';
      extraParams = [now];
      if (readiness_outcome) {
        extraFields += ', readiness_outcome = ?, readiness_note = ?';
        extraParams.push(readiness_outcome, readiness_outcome === 'incomplete' ? readiness_note.trim() : null);
      }
    } else if (new_status === 'no_show') {
      extraFields = ', completed_at = ?';
      extraParams = [now];
    }

    // Record analytics for terminal statuses
    if (['served', 'left', 'cancelled', 'no_show'].includes(new_status)) {
      const joinedAt  = ticket.joined_at ? new Date(ticket.joined_at) : null;
      const startedAt = ticket.started_serving_at ? new Date(ticket.started_serving_at) : null;
      const calledAt  = ticket.called_at ? new Date(ticket.called_at) : null;
      const waitEndAt = startedAt || calledAt || now;
      const waitMin   = joinedAt && waitEndAt ? (waitEndAt - joinedAt) / 60000 : null;
      const svcMin    = new_status === 'served' && startedAt ? (now - startedAt) / 60000 : null;

      const [qLen] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'",
        [ticket.queue_id]
      );
      const [staffCnt] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM staff_assignments WHERE counter_id IN (SELECT id FROM counters WHERE branch_id = ?) AND assignment_date = CURDATE()',
        [ticket.branch_id]
      );
      const [activeCounters] = await conn.query(
        `SELECT COUNT(DISTINCT c.id) AS cnt
         FROM counters c
         JOIN staff_assignments sa ON sa.counter_id = c.id AND sa.assignment_date = CURDATE()
         WHERE c.branch_id = ? AND c.service_id = ? AND c.is_active = TRUE`,
        [ticket.branch_id, ticket.service_id]
      );

      await conn.query(
        `INSERT INTO wait_time_records
           (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, month_of_year,
            wait_time_minutes, service_time_minutes, status, channel, staff_count_at_time, queue_length_at_time, active_counters_at_time)
         SELECT ?, ?, b.business_id, b.id, q.service_id, CURDATE(),
                DAYOFWEEK(NOW())-1, HOUR(NOW()), MONTH(NOW()),
                ?, ?, ?, ?, ?, ?, ?
         FROM queues q JOIN branches b ON q.branch_id = b.id WHERE q.id = ?`,
        [uuidv4(), ticket.id, waitMin, svcMin, new_status, ticket.channel || 'app', staffCnt[0].cnt, qLen[0].cnt, activeCounters[0].cnt, ticket.queue_id]
      );

      if (ticket.user_id) {
        const [qInfo] = await conn.query(
          `SELECT br.name AS branch_name, biz.name AS business_name, biz.id AS business_id,
                  s.name AS service_name, br.id AS branch_id, s.id AS service_id
           FROM queues q
           JOIN branches br ON q.branch_id = br.id
           JOIN businesses biz ON br.business_id = biz.id
           JOIN services s ON q.service_id = s.id
           WHERE q.id = ?`,
          [ticket.queue_id]
        );
        if (qInfo.length) {
          await conn.query(
            `INSERT INTO visit_history
               (id, user_id, ticket_id, business_id, branch_id, service_id,
                business_name, branch_name, service_name, ticket_number, visit_date,
                wait_time_minutes, service_time_minutes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
            [uuidv4(), ticket.user_id, ticket.id, qInfo[0].business_id, qInfo[0].branch_id,
             qInfo[0].service_id, qInfo[0].business_name, qInfo[0].branch_name,
             qInfo[0].service_name, ticket.ticket_number,
             Math.round(waitMin || 0), Math.round(svcMin || 0), new_status]
          );
        }
      }
    }

    await conn.query(
      `UPDATE queue_tickets SET status = ? ${extraFields} WHERE id = ?`,
      [new_status, ...extraParams, ticket.id]
    );

    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, triggered_by_staff_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), ticket.id, prevStatus, new_status, req.dbStaff?.id || null, notes || null]
    );

    let pendingPush = null;
    if (new_status === 'called') {
      pendingPush = await notifyTicketUser(
        conn,
        ticket,
        'called',
        `${ticket.ticket_number} is being called for ${ticket.service_name}. Please come to the front and show your verification code.`
      );
    } else if (new_status === 'no_show') {
      pendingPush = await notifyTicketUser(
        conn,
        ticket,
        'no_show',
        `${ticket.ticket_number} was marked as a no-show because the call window expired, and your place in line was released. You can rejoin the queue from the app, or speak with staff at the branch if you are on site.`
      );
    }

    // Recalculate wait times for remaining WAITING tickets after terminal events.
    // Prefer the model-based grid (same source as the join-time ETA) so the
    // number a customer sees doesn't revert to a naive formula on the next
    // queue update; fall back to position × recent-average service time.
    if (['served', 'left', 'cancelled', 'no_show'].includes(new_status)) {
      const [avgRows] = await conn.query(
        `SELECT AVG(service_time_minutes) AS avg_svc
         FROM wait_time_records w
         JOIN queue_tickets recent_ticket ON recent_ticket.id = w.ticket_id
         WHERE recent_ticket.queue_id = ? AND w.status = 'served'
         ORDER BY w.created_at DESC LIMIT 20`,
        [ticket.queue_id]
      );
      const [qInfo] = await conn.query(
        `SELECT q.branch_id, q.service_id, s.base_avg_time_minutes
         FROM queues q JOIN services s ON q.service_id = s.id
         WHERE q.id = ?`,
        [ticket.queue_id]
      );
      const dynamicAvg = avgRows[0]?.avg_svc || qInfo[0]?.base_avg_time_minutes || 15;

      const [waiting] = await conn.query(
        `SELECT id, position FROM queue_tickets
         WHERE queue_id = ? AND status = 'waiting' ORDER BY position`,
        [ticket.queue_id]
      );
      if (waiting.length) {
        const hour = new Date().getHours();
        const updates = [];
        for (let i = 0; i < waiting.length; i++) {
          const modelWait = await estimateWaitMinutes({
            branchId: qInfo[0]?.branch_id,
            serviceId: qInfo[0]?.service_id,
            position: i + 1,          // rank among remaining waiters
            hour,
          });
          updates.push({ id: waiting[i].id, wait: modelWait ?? Math.round(i * dynamicAvg) });
        }
        const cases = updates.map(() => 'WHEN ? THEN ?').join(' ');
        const params = updates.flatMap((u) => [u.id, u.wait]);
        await conn.query(
          `UPDATE queue_tickets SET estimated_wait_minutes = CASE id ${cases} END
           WHERE id IN (${updates.map(() => '?').join(',')})`,
          [...params, ...updates.map((u) => u.id)]
        );
      }
    }

    await conn.commit();

    // Deliver the push only after the transaction is durable.
    if (pendingPush) {
      sendPushToUser(pendingPush.userId, pendingPush).catch(() => {});
    }

    const [updated] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticket.id]);
    broadcast(ticket.queue_id, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket status.' });
  } finally {
    conn.release();
  }
});

// PUT /api/tickets/:id/move-up — Move waiting ticket up one position
router.put('/:id/move-up', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireTicketAccess, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tickets] = await conn.query(
      "SELECT * FROM queue_tickets WHERE id = ? AND status = 'waiting' FOR UPDATE",
      [req.params.id]
    );
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Waiting ticket not found.' });
    }
    const ticket = tickets[0];

    const [above] = await conn.query(
      "SELECT * FROM queue_tickets WHERE queue_id = ? AND status = 'waiting' AND position < ? ORDER BY position DESC LIMIT 1 FOR UPDATE",
      [ticket.queue_id, ticket.position]
    );
    if (!above.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Ticket is already at the front of the queue.' });
    }

    await conn.query('UPDATE queue_tickets SET position = ? WHERE id = ?', [above[0].position, ticket.id]);
    await conn.query('UPDATE queue_tickets SET position = ? WHERE id = ?', [ticket.position, above[0].id]);

    await conn.commit();
    const [updated] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticket.id]);
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to move ticket up.' });
  } finally {
    conn.release();
  }
});

// PUT /api/tickets/:id/move-down — Move waiting ticket down one position
router.put('/:id/move-down', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireTicketAccess, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tickets] = await conn.query(
      "SELECT * FROM queue_tickets WHERE id = ? AND status = 'waiting' FOR UPDATE",
      [req.params.id]
    );
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Waiting ticket not found.' });
    }
    const ticket = tickets[0];

    const [below] = await conn.query(
      "SELECT * FROM queue_tickets WHERE queue_id = ? AND status = 'waiting' AND position > ? ORDER BY position ASC LIMIT 1 FOR UPDATE",
      [ticket.queue_id, ticket.position]
    );
    if (!below.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Ticket is already at the back of the queue.' });
    }

    await conn.query('UPDATE queue_tickets SET position = ? WHERE id = ?', [below[0].position, ticket.id]);
    await conn.query('UPDATE queue_tickets SET position = ? WHERE id = ?', [ticket.position, below[0].id]);

    await conn.commit();
    const [updated] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticket.id]);
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to move ticket down.' });
  } finally {
    conn.release();
  }
});

// PUT /api/tickets/:id/skip — Staff skips a waiting ticket
// disposition: 'remove' (cancel) | 'requeue' (place right after current in_service ticket)
router.put('/:id/skip', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireTicketAccess, validate(schemas.skipTicket), async (req, res) => {
  const { disposition = 'requeue' } = req.body;
  if (!['remove', 'requeue'].includes(disposition)) {
    return res.status(400).json({ error: "disposition must be 'remove' or 'requeue'." });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tickets] = await conn.query(
      "SELECT * FROM queue_tickets WHERE id = ? AND status = 'waiting' FOR UPDATE",
      [req.params.id]
    );
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Waiting ticket not found.' });
    }
    const ticket = tickets[0];

    if (disposition === 'remove') {
      // Cancel the ticket outright
      await conn.query(
        "UPDATE queue_tickets SET status = 'cancelled' WHERE id = ?",
        [ticket.id]
      );
      await conn.query(
        `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, triggered_by_staff_id, notes)
         VALUES (?, ?, 'waiting', 'cancelled', ?, 'Skipped by staff — removed from queue')`,
        [uuidv4(), ticket.id, req.dbStaff?.id || null]
      );
    } else {
      // requeue: move to position immediately after the highest in_service ticket
      // If no in_service ticket exists, move to position 1
      const [inService] = await conn.query(
        "SELECT MAX(position) AS max_pos FROM queue_tickets WHERE queue_id = ? AND status = 'in_service'",
        [ticket.queue_id]
      );
      const insertAfter = inService[0]?.max_pos ?? 0;
      const newPosition = insertAfter + 1;

      // Shift all waiting tickets at or above the target position down by 1
      await conn.query(
        `UPDATE queue_tickets
         SET position = position + 1
         WHERE queue_id = ? AND status = 'waiting' AND position >= ? AND id != ?`,
        [ticket.queue_id, newPosition, ticket.id]
      );

      await conn.query(
        'UPDATE queue_tickets SET position = ? WHERE id = ?',
        [newPosition, ticket.id]
      );

      await conn.query(
        `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, triggered_by_staff_id, notes)
         VALUES (?, ?, 'waiting', 'waiting', ?, ?)`,
        [uuidv4(), ticket.id, req.dbStaff?.id || null,
          `Skipped by staff — moved to position ${newPosition}`]
      );
    }

    const pendingPush = await notifyTicketUser(
      conn,
      ticket,
      'queue_update',
      disposition === 'remove'
        ? `${ticket.ticket_number} was removed from the line by staff. Please speak with staff or rejoin the queue if you still need service.`
        : `${ticket.ticket_number} was skipped for now but kept near the front of the line. Head to the counter so you don't miss the next call.`
    );

    await conn.commit();

    if (pendingPush) {
      sendPushToUser(pendingPush.userId, pendingPush).catch(() => {});
    }

    const [updated] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticket.id]);
    broadcast(ticket.queue_id, updated[0]);
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to skip ticket.' });
  } finally {
    conn.release();
  }
});

// POST /api/tickets/:id/rating — customer rates a completed visit.
// The only place customer-experience data is captured; feeds CX reporting and
// future satisfaction modelling (see migration 014 / apps/model).
const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  wait_ok: z.boolean().optional(),
  comment: z.string().max(500).optional(),
});

router.post('/:id/rating', requireAuth, async (req, res) => {
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }
  const { rating, wait_ok, comment } = parsed.data;
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.user_id, t.status, q.service_id, b.id AS branch_id, b.business_id
         FROM queue_tickets t
         JOIN queues q   ON q.id = t.queue_id
         JOIN branches b ON b.id = q.branch_id
        WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });
    const ticket = rows[0];
    if (req.dbUser?.id && ticket.user_id && ticket.user_id !== req.dbUser.id) {
      return res.status(403).json({ error: 'You can only rate your own visit.' });
    }
    if (!['served', 'no_show', 'left', 'cancelled'].includes(ticket.status)) {
      return res.status(409).json({ error: 'You can rate a visit once it is complete.' });
    }
    await pool.query(
      `INSERT INTO ticket_ratings
         (id, ticket_id, user_id, business_id, branch_id, service_id, rating, wait_ok, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), wait_ok = VALUES(wait_ok), comment = VALUES(comment)`,
      [uuidv4(), ticket.id, req.dbUser?.id || null, ticket.business_id, ticket.branch_id,
       ticket.service_id, rating, wait_ok ?? null, comment ?? null]
    );
    res.status(201).json({ message: 'Thanks for your feedback.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save rating.' });
  }
});

module.exports = router;
