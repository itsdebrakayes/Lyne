/**
 * queues.js
 *
 * GET  /api/queues?branch_id=&service_id=&date=  — get queue(s) for a branch/service/date
 * GET  /api/queues/:id                            — get one queue with live ticket counts
 * POST /api/queues                                — create/open a queue (staff/manager)
 * PUT  /api/queues/:id/close                      — close a queue (manager/executive)
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const {
  requireStaffRole,
  requireBranchAccess,
  requireQueueAccess,
} = require('../middleware/tenantAccess');

// Get queues — public (used by user website to show live wait times)
router.get('/', async (req, res) => {
  try {
    const { branch_id, service_id, date } = req.query;
    const conditions = ['q.is_active = TRUE'];
    const params = [];

    if (branch_id)  { conditions.push('q.branch_id = ?');  params.push(branch_id); }
    if (service_id) { conditions.push('q.service_id = ?'); params.push(service_id); }
    if (date)       { conditions.push('q.queue_date = ?'); params.push(date); }
    else            { conditions.push('q.queue_date = CURDATE()'); }

    const [rows] = await pool.query(
      `SELECT q.*,
              b.name  AS branch_name,
              s.name  AS service_name,
              s.ticket_prefix,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting')  AS waiting_count,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'in_service') AS serving_count,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id)                           AS total_count,
              (SELECT AVG(t.estimated_wait_minutes) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting') AS avg_wait_minutes
       FROM queues q
       JOIN branches b  ON q.branch_id  = b.id
       JOIN services s  ON q.service_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queues.' });
  }
});

// ── GET /api/queues/live?branch_id=&service_id= ─────────────
// Returns live queue stats for the pre-join screen on mobile.
// MUST be declared before /:id to prevent Express matching 'live' as a UUID.
router.get('/live', async (req, res) => {
  try {
    const { branch_id, service_id } = req.query;
    if (!branch_id || !service_id) {
      return res.status(400).json({ error: 'branch_id and service_id are required.' });
    }
    const [rows] = await pool.query(
      `SELECT q.id,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting') AS waiting_count,
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, t.created_at, t.completed_at))
                FROM queue_tickets t
                WHERE t.queue_id = q.id AND t.status = 'served'
                ORDER BY t.completed_at DESC LIMIT 20
              ), s.base_avg_time_minutes) AS avg_service_minutes
       FROM queues q
       JOIN services s ON q.service_id = s.id
       WHERE q.branch_id = ? AND q.service_id = ? AND q.is_active = TRUE AND q.queue_date = CURDATE()
       LIMIT 1`,
      [branch_id, service_id]
    );
    if (!rows.length) {
      return res.json({ id: null, waiting_count: 0, estimated_wait_minutes: 0 });
    }
    const row = rows[0];
    const estimated_wait_minutes = Math.round(row.waiting_count * (row.avg_service_minutes || 15));
    res.json({ id: row.id, waiting_count: row.waiting_count, estimated_wait_minutes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live queue info.' });
  }
});

// Get single queue with full ticket list
router.get('/:id', async (req, res) => {
  try {
    const [queues] = await pool.query(
      `SELECT q.*,
              b.name AS branch_name,
              s.name AS service_name,
              s.ticket_prefix
       FROM queues q
       JOIN branches b ON q.branch_id  = b.id
       JOIN services s ON q.service_id = s.id
       WHERE q.id = ?`,
      [req.params.id]
    );
    if (!queues.length) return res.status(404).json({ error: 'Queue not found.' });

    const [tickets] = await pool.query(
      `SELECT t.*, u.full_name AS user_name
       FROM queue_tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.queue_id = ?
       ORDER BY t.position`,
      [req.params.id]
    );

    res.json({ ...queues[0], tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queue.' });
  }
});

// Create / open a queue for today
router.post('/', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const { branch_id, service_id, queue_date, max_capacity } = req.body;
    if (!branch_id || !service_id) return res.status(400).json({ error: 'branch_id and service_id are required.' });
    const [ownership] = await pool.query(
      `SELECT b.business_id AS branch_business_id, s.business_id AS service_business_id
       FROM branches b
       JOIN services s ON s.id = ?
       WHERE b.id = ?
       LIMIT 1`,
      [service_id, branch_id]
    );
    if (!ownership.length || ownership[0].branch_business_id !== ownership[0].service_business_id) {
      return res.status(400).json({ error: 'Branch and service must belong to the same business.' });
    }

    const date = queue_date || new Date().toISOString().slice(0, 10);
    const id = uuidv4();

    await pool.query(
      `INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_active = TRUE`,
      [id, branch_id, service_id, date, max_capacity || 50]
    );

    const [created] = await pool.query(
      'SELECT * FROM queues WHERE branch_id = ? AND service_id = ? AND queue_date = ?',
      [branch_id, service_id, date]
    );
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create queue.' });
  }
});

// Close a queue
router.put('/:id/close', requireAuth, requireStaffRole('manager', 'executive'), requireQueueAccess, async (req, res) => {
  try {
    await pool.query('UPDATE queues SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Queue closed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to close queue.' });
  }
});

module.exports = router;
