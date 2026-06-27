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
const crypto = require('crypto');
const { randomUUID: uuidv4 } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, requireQueueAccess, requireTicketAccess } = require('../middleware/tenantAccess');

// Lazy-load to avoid circular dependency at startup
function broadcast(queueId, ticket) {
  try {
    const { broadcastQueueUpdate } = require('./sse');
    broadcastQueueUpdate(queueId, ticket).catch(() => {});
  } catch { /* sse module not yet loaded */ }
}

// Validation schemas
const joinQueueSchema = z.object({
  queue_id:  z.string().uuid('queue_id must be a valid UUID'),
  form_data: z.record(z.unknown()).optional(),
});

const updateStatusSchema = z.object({
  new_status: z.enum(['called', 'in_service', 'served', 'left', 'cancelled', 'no_show'], {
    errorMap: () => ({ message: 'new_status must be one of: called, in_service, served, left, cancelled, no_show' }),
  }),
  verification_code: z.string().max(12).optional(),
  notes: z.string().max(1000).optional(),
});

function createVerificationCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// POST /api/tickets — Join a queue
router.post('/', requireAuth, async (req, res) => {
  const parsed = joinQueueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { queue_id, form_data } = parsed.data;

    const [queues] = await conn.query(
      'SELECT * FROM queues WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [queue_id]
    );
    if (!queues.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Queue not found or is closed.' });
    }
    const queue = queues[0];

    // Count WAITING only — in_service are being served and should not block capacity
    const [countRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'",
      [queue_id]
    );
    if (countRows[0].cnt >= queue.max_capacity) {
      await conn.rollback();
      return res.status(409).json({ error: 'Queue is at full capacity.' });
    }

    const [posRows] = await conn.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM queue_tickets WHERE queue_id = ?',
      [queue_id]
    );
    const position = posRows[0].next_pos;

    const [svcRows] = await conn.query(
      'SELECT ticket_prefix, base_avg_time_minutes FROM services WHERE id = ?',
      [queue.service_id]
    );
    const prefix  = svcRows[0]?.ticket_prefix || 'Q';
    const avgTime = svcRows[0]?.base_avg_time_minutes || 15;
    const ticketNumber  = `${prefix}-${String(position).padStart(3, '0')}`;
    const estimatedWait = (position - 1) * avgTime;
    const verificationCode = createVerificationCode();

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
      `INSERT INTO queue_tickets
         (id, queue_id, user_id, intake_form_id, ticket_number, verification_code, position, status, estimated_wait_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?)`,
      [ticketId, queue_id, req.dbUser?.id || null, intakeFormId, ticketNumber, verificationCode, position, estimatedWait]
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

// GET /api/tickets/queue/:queue_id — All tickets for a queue (staff)
// MUST be declared before /:id
router.get('/queue/:queue_id', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireQueueAccess, async (req, res) => {
  try {
    const [tickets] = await pool.query(
      `SELECT t.id, t.queue_id, t.user_id, t.ticket_number, t.position, t.status,
              t.estimated_wait_minutes, t.joined_at, t.called_at, t.started_serving_at,
              u.full_name AS user_name, u.phone AS user_phone
       FROM queue_tickets t
       LEFT JOIN users u ON t.user_id = u.id
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

// GET /api/tickets/:id — Get ticket status
router.get('/:id', requireAuth, requireTicketAccess, async (req, res) => {
  try {
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
                 AND t3.status = 'waiting') AS total_waiting
       FROM queue_tickets t
       JOIN queues   q ON t.queue_id   = q.id
       JOIN branches b ON q.branch_id  = b.id
       JOIN services s ON q.service_id = s.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });

    const ticket = rows[0];
    const isNext = ticket.status === 'waiting' && ticket.waiting_position === 1;

    res.json({
      ...ticket,
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
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { new_status, verification_code, notes } = parsed.data;

    const [tickets] = await conn.query(
      'SELECT t.*, q.branch_id FROM queue_tickets t JOIN queues q ON t.queue_id = q.id WHERE t.id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket     = tickets[0];
    const prevStatus = ticket.status;

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
    if (new_status === 'no_show' && !['called', 'waiting'].includes(prevStatus)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Only called or waiting tickets can be marked no_show.' });
    }
    if (new_status === 'in_service' && verification_code && verification_code.toUpperCase() !== ticket.verification_code) {
      await conn.rollback();
      return res.status(403).json({ error: 'Invalid ticket verification code.' });
    }

    const now = new Date();
    let extraFields = '';
    let extraParams = [];

    if (new_status === 'called') {
      extraFields = ', called_at = ?, served_by_staff_id = ?';
      extraParams = [now, req.dbStaff?.id || null];
    } else if (new_status === 'in_service') {
      extraFields = ', started_serving_at = ?, served_by_staff_id = ?';
      extraParams = [now, req.dbStaff?.id || null];
    } else if (new_status === 'served') {
      extraFields = ', completed_at = ?';
      extraParams = [now];
    }

    // Record analytics for terminal statuses
    if (['served', 'left', 'cancelled', 'no_show'].includes(new_status)) {
      const joinedAt  = ticket.joined_at ? new Date(ticket.joined_at) : null;
      const startedAt = ticket.started_serving_at ? new Date(ticket.started_serving_at) : null;
      const waitMin   = joinedAt && startedAt ? (startedAt - joinedAt) / 60000 : null;
      const svcMin    = startedAt ? (now - startedAt) / 60000 : null;

      const [qLen] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'",
        [ticket.queue_id]
      );
      const [staffCnt] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM staff_assignments WHERE counter_id IN (SELECT id FROM counters WHERE branch_id = ?) AND assignment_date = CURDATE()',
        [ticket.branch_id]
      );

      await conn.query(
        `INSERT INTO wait_time_records
           (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, month_of_year,
            wait_time_minutes, service_time_minutes, status, staff_count_at_time, queue_length_at_time)
         SELECT ?, ?, b.business_id, b.id, q.service_id, CURDATE(),
                DAYOFWEEK(NOW())-1, HOUR(NOW()), MONTH(NOW()),
                ?, ?, ?, ?, ?
         FROM queues q JOIN branches b ON q.branch_id = b.id WHERE q.id = ?`,
        [uuidv4(), ticket.id, waitMin, svcMin, new_status, staffCnt[0].cnt, qLen[0].cnt, ticket.queue_id]
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

    // Recalculate wait times for remaining WAITING tickets after terminal events
    if (['served', 'left', 'cancelled', 'no_show'].includes(new_status)) {
      const [avgRows] = await conn.query(
        `SELECT AVG(service_time_minutes) AS avg_svc
         FROM wait_time_records w
         JOIN queue_tickets recent_ticket ON recent_ticket.id = w.ticket_id
         WHERE recent_ticket.queue_id = ? AND w.status = 'served'
         ORDER BY w.created_at DESC LIMIT 20`,
        [ticket.queue_id]
      );
      const [svcBase] = await conn.query(
        `SELECT s.base_avg_time_minutes
         FROM queues q JOIN services s ON q.service_id = s.id
         WHERE q.id = ?`,
        [ticket.queue_id]
      );
      const dynamicAvg = avgRows[0]?.avg_svc || svcBase[0]?.base_avg_time_minutes || 15;

      await conn.query(
        `UPDATE queue_tickets t
         JOIN (
           SELECT id,
                  (ROW_NUMBER() OVER (PARTITION BY queue_id ORDER BY position) - 1) * ? AS new_wait
           FROM queue_tickets
           WHERE queue_id = ? AND status = 'waiting'
         ) ranked ON t.id = ranked.id
         SET t.estimated_wait_minutes = ranked.new_wait`,
        [dynamicAvg, ticket.queue_id]
      );
    }

    await conn.commit();
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
router.put('/:id/skip', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireTicketAccess, async (req, res) => {
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

    await conn.commit();
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

module.exports = router;
