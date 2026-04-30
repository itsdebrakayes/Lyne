/**
 * tickets.js — Core queue ticket operations
 *
 * POST /api/tickets                    — join a queue (authenticated user)
 * GET  /api/tickets/queue/:queue_id    — get all tickets for a queue (staff)
 * GET  /api/tickets/:id                — get ticket status (public, by ticket id)
 * PUT  /api/tickets/:id/status         — update ticket status (staff only)
 *
 * NOTE: /queue/:queue_id MUST be declared before /:id to prevent Express
 *       from matching the literal string "queue" as a UUID parameter.
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── POST /api/tickets — Join a queue ─────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { queue_id, form_data } = req.body;
    if (!queue_id) return res.status(400).json({ error: 'queue_id is required.' });

    // Verify queue exists and is open
    const [queues] = await conn.query(
      'SELECT * FROM queues WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [queue_id]
    );
    if (!queues.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Queue not found or is closed.' });
    }
    const queue = queues[0];

    // Check capacity
    const [countRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status IN ('waiting','serving')",
      [queue_id]
    );
    if (countRows[0].cnt >= queue.max_capacity) {
      await conn.rollback();
      return res.status(409).json({ error: 'Queue is at full capacity.' });
    }

    // Get next position
    const [posRows] = await conn.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM queue_tickets WHERE queue_id = ?',
      [queue_id]
    );
    const position = posRows[0].next_pos;

    // Get service ticket prefix
    const [svcRows] = await conn.query(
      'SELECT ticket_prefix, base_avg_time_minutes FROM services WHERE id = ?',
      [queue.service_id]
    );
    const prefix = svcRows[0]?.ticket_prefix || 'Q';
    const avgTime = svcRows[0]?.base_avg_time_minutes || 15;
    const ticketNumber = `${prefix}-${String(position).padStart(3, '0')}`;
    const estimatedWait = (position - 1) * avgTime;

    // Save intake form if provided
    let intakeFormId = null;
    if (form_data) {
      intakeFormId = uuidv4();
      await conn.query(
        'INSERT INTO intake_forms (id, service_id, user_id, form_data) VALUES (?, ?, ?, ?)',
        [intakeFormId, queue.service_id, req.dbUser?.id || null, JSON.stringify(form_data)]
      );
    }

    // Create ticket
    const ticketId = uuidv4();
    await conn.query(
      `INSERT INTO queue_tickets
         (id, queue_id, user_id, intake_form_id, ticket_number, position, status, estimated_wait_minutes)
       VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?)`,
      [ticketId, queue_id, req.dbUser?.id || null, intakeFormId, ticketNumber, position, estimatedWait]
    );

    // Log event
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status)
       VALUES (?, ?, NULL, 'waiting')`,
      [uuidv4(), ticketId]
    );

    await conn.commit();

    const [ticket] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticketId]);
    res.status(201).json(ticket[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to join queue.' });
  } finally {
    conn.release();
  }
});

// ── GET /api/tickets/queue/:queue_id — All tickets for a queue ─
// IMPORTANT: Declared BEFORE /:id to prevent Express matching "queue" as a UUID.
router.get('/queue/:queue_id', requireAuth, requireRole('line_staff', 'manager', 'executive'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, u.full_name AS user_name, u.phone AS user_phone
       FROM queue_tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.queue_id = ?
       ORDER BY t.position`,
      [req.params.queue_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tickets.' });
  }
});

// ── GET /api/tickets/:id — Get ticket status ─────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*,
              q.branch_id, q.service_id, q.queue_date,
              b.name  AS branch_name,
              s.name  AS service_name,
              (SELECT COUNT(*) FROM queue_tickets t2
               WHERE t2.queue_id = t.queue_id AND t2.status = 'waiting' AND t2.position < t.position)
                      AS people_ahead
       FROM queue_tickets t
       JOIN queues   q ON t.queue_id   = q.id
       JOIN branches b ON q.branch_id  = b.id
       JOIN services s ON q.service_id = s.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ticket.' });
  }
});

// ── PUT /api/tickets/:id/status — Update ticket status ───────
// Valid transitions: waiting→serving, serving→completed, *→cancelled, *→no_show
router.put('/:id/status', requireAuth, requireRole('line_staff', 'manager', 'executive'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { new_status, notes } = req.body;
    const validStatuses = ['serving', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const [tickets] = await conn.query('SELECT * FROM queue_tickets WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!tickets.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket = tickets[0];
    const prevStatus = ticket.status;

    // Build timestamp updates
    const now = new Date();
    let extraFields = '';
    const extraParams = [];

    if (new_status === 'serving') {
      extraFields = ', called_at = ?, started_serving_at = ?, served_by_staff_id = ?';
      extraParams.push(now, now, req.dbStaff?.id || null);
    } else if (new_status === 'completed') {
      extraFields = ', completed_at = ?';
      extraParams.push(now);

      // Write wait-time record for analytics
      const [queueRows] = await conn.query('SELECT * FROM queues WHERE id = ?', [ticket.queue_id]);
      const queue = queueRows[0];
      const joinedAt = ticket.joined_at ? new Date(ticket.joined_at) : null;
      const startedAt = ticket.started_serving_at ? new Date(ticket.started_serving_at) : null;
      const waitMin = joinedAt && startedAt ? (startedAt - joinedAt) / 60000 : null;
      const svcMin  = startedAt ? (now - startedAt) / 60000 : null;

      const [qLen] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status IN ('waiting','serving')",
        [ticket.queue_id]
      );
      const [staffCnt] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM staff_assignments WHERE counter_id IN (SELECT id FROM counters WHERE branch_id = ?) AND assignment_date = CURDATE()',
        [queue.branch_id]
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

      // Write visit history for the user
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

    // Log event
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, triggered_by_staff_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), ticket.id, prevStatus, new_status, req.dbStaff?.id || null, notes || null]
    );

    // ── Dynamic wait-time recalculation ─────────────────────────────────────
    // After any terminal status change (completed, cancelled, no_show),
    // recalculate estimated_wait_minutes for all remaining 'waiting' tickets
    // in this queue. This ensures users always see an accurate estimate.
    if (['completed', 'cancelled', 'no_show'].includes(new_status)) {
      // Get the real-time average service duration from the last 20 completions
      const [avgRows] = await conn.query(
        `SELECT AVG(service_time_minutes) AS avg_svc
         FROM wait_time_records
         WHERE queue_id = ? AND status = 'completed'
         ORDER BY created_at DESC LIMIT 20`,
        [ticket.queue_id]
      );
      // Fall back to the service's base average if no history yet
      const [svcBase] = await conn.query(
        `SELECT s.base_avg_time_minutes
         FROM queues q JOIN services s ON q.service_id = s.id
         WHERE q.id = ?`,
        [ticket.queue_id]
      );
      const dynamicAvg = avgRows[0]?.avg_svc || svcBase[0]?.base_avg_time_minutes || 15;

      // Recalculate position-based waits for all remaining waiting tickets
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
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket status.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
