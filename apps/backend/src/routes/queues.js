/**
 * queues.js
 *
 * GET  /api/queues?branch_id=&service_id=&date=  — get queue(s) for a branch/service/date
 * GET  /api/queues/:id                            — get one queue with live ticket counts
 * POST /api/queues                                — create/open a queue (staff/manager)
 * PUT  /api/queues/:id/close                      — close a queue (manager/executive)
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { projectedWaitMinutes } = require('../utils/etaMath');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  requireStaffRole,
  requireBranchAccess,
  requireQueueAccess,
} = require('../middleware/tenantAccess');


/**
 * Open today's queues if nobody has yet.
 *
 * Queues are keyed by queue_date, and until this existed nothing created them
 * for a new day — so at midnight every live screen emptied and stayed empty
 * until a manager manually opened each service. First thing on a Monday that
 * reads as a broken system, not as "the day hasn't started".
 *
 * Done lazily on read rather than by a scheduler: it is self-healing (a missed
 * cron, a restart, a server that was off overnight all resolve themselves the
 * first time anyone opens the app) and it costs one cheap INSERT..SELECT that
 * does nothing once the day is open.
 *
 * A branch offers a service if it has a counter for it, so that is the source
 * of truth for which queues a branch should have.
 */
async function ensureQueuesForToday(businessId, branchId) {
  if (!businessId) return;
  await pool.query(
    `INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
     SELECT UUID(), x.branch_id, x.service_id, CURDATE(), 200, TRUE
       FROM (SELECT DISTINCT c.branch_id, c.service_id
               FROM counters c
               JOIN branches b ON b.id = c.branch_id
               JOIN services s ON s.id = c.service_id
              WHERE c.is_active = 1 AND s.is_active = 1
                AND b.business_id = ?
                AND (? IS NULL OR b.id = ?)) x
      WHERE NOT EXISTS (
        SELECT 1 FROM queues q
         WHERE q.branch_id = x.branch_id AND q.service_id = x.service_id
           AND q.queue_date = CURDATE())`,
    [businessId, branchId || null, branchId || null]
  );
}

// Staff-scoped queues for the administration dashboard.
router.get('/mine', requireAuth, requireStaffRole('line_staff', 'supervisor', 'manager', 'executive'), async (req, res) => {
  try {
    const role = req.dbStaff.role_name;
    // Opens the day on first read so nobody ever meets a blank morning.
    await ensureQueuesForToday(req.dbStaff.business_id, req.dbStaff.branch_id);
    const conditions = ['q.is_active = TRUE', 'q.queue_date = CURDATE()', 'b.business_id = ?'];
    const params = [req.dbStaff.business_id];
    if (role === 'manager' && req.dbStaff.branch_id) {
      conditions.push('q.branch_id = ?');
      params.push(req.dbStaff.branch_id);
    }
    if (role === 'line_staff') {
      conditions.push('q.branch_id = ?');
      params.push(req.dbStaff.branch_id);
      conditions.push(`(
        q.service_id = ? OR EXISTS (
          SELECT 1 FROM staff_assignments sa
          JOIN counters c ON c.id = sa.counter_id
          WHERE sa.staff_id = ? AND sa.assignment_date = CURDATE()
            AND c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE
        )
      )`);
      params.push(req.dbStaff.assigned_service_id || '', req.dbStaff.id);
    }
    const [rows] = await pool.query(
      `SELECT q.*, b.name AS branch_name, s.name AS service_name,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting') AS waiting_count,
              (SELECT COUNT(*) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'in_service') AS serving_count,
              (SELECT AVG(t.estimated_wait_minutes) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting') AS avg_wait_minutes,
              -- How many windows this line HAS, and how many are actually manned.
              -- The dashboards read these to answer "does this line need a
              -- window opened?" — without them every branch reported "0 of 0",
              -- which reads as fully covered and produced the opposite advice.
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id
                  AND c.is_active = TRUE) AS counters_total,
              -- "Open" matches /analytics/counters exactly: staff_assignments is
              -- the source of truth, ticket history only a fallback for a desk
              -- with no assignment. Two screens must never disagree on this.
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id
                  AND c.is_active = TRUE
                  AND (EXISTS (SELECT 1 FROM staff_assignments sa
                                WHERE sa.counter_id = c.id
                                  AND sa.assignment_date = CURDATE())
                    OR EXISTS (SELECT 1 FROM queue_tickets t
                                 JOIN queues q2 ON q2.id = t.queue_id
                                              AND q2.queue_date = CURDATE()
                                WHERE t.served_at_counter_id = c.id
                                  AND t.served_by_staff_id IS NOT NULL))
              ) AS counters_open,
              -- The single longest wait in the line right now. This is the
              -- number a manager is judged on; the average hides it.
              (SELECT MAX(TIMESTAMPDIFF(MINUTE, t.joined_at, NOW()))
                 FROM queue_tickets t
                WHERE t.queue_id = q.id AND t.status = 'waiting') AS longest_wait_minutes,
              -- Per-person SERVICE time, the input to the projected ETA. This is
              -- deliberately the SAME expression /services uses, so the minutes a
              -- manager reads off the floor board are the minutes the customer is
              -- being shown on their phone. A manager who cannot defend the number
              -- at the counter stops trusting the board.
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE,
                             COALESCE(qt.started_serving_at, qt.called_at, qt.joined_at),
                             qt.completed_at))
                  FROM queue_tickets qt
                  JOIN queues q2 ON q2.id = qt.queue_id
                 WHERE q2.service_id = q.service_id AND q2.branch_id = q.branch_id
                   AND q2.queue_date = CURDATE()
                   AND qt.status = 'served' AND qt.completed_at IS NOT NULL
              ), s.base_avg_time_minutes) AS service_minutes
       FROM queues q
       JOIN branches b ON b.id = q.branch_id
       JOIN services s ON s.id = q.service_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.name, s.name`,
      params
    );
    // The live, counter-aware projection — the one number the floor board and
    // the customer's phone must agree on. Same helper and same inputs as
    // /services, deliberately: divergence here is what made a manager read 106
    // minutes off a line the member had been quoted 20 for.
    res.json(rows.map((r) => ({
      ...r,
      projected_wait_minutes: projectedWaitMinutes({
        ahead: r.waiting_count,
        perServiceMinutes: r.service_minutes,
        counters: r.counters_total,
      }),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assigned queues.' });
  }
});

// Get queues — public (used by user website to show live wait times)
router.get('/', async (req, res) => {
  try {
    const { business_id, branch_id, service_id, date } = req.query;
    const conditions = ['q.is_active = TRUE'];
    const params = [];

    if (business_id) { conditions.push('b.business_id = ?'); params.push(business_id); }
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
              (SELECT AVG(t.estimated_wait_minutes) FROM queue_tickets t WHERE t.queue_id = q.id AND t.status = 'waiting') AS avg_wait_minutes,
              /* How many windows this line HAS, and how many are actually being
                 worked. Both were missing from this payload entirely, and the
                 manager's overview reads them: with nothing to read it decided
                 every line had zero counters and told the manager "this line has
                 no windows set up at all — add its counters before anyone can be
                 put on it." That is alarming, wrong, and was on the main screen.

                 Open means somebody is ON it: rostered to the counter today,
                 clocked in, and not on a break. The same definition the section
                 board and the window-closed notification use, so the three
                 cannot disagree about whether a window is being worked. */
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id
                  AND c.is_active = TRUE)                                       AS counters_total,
              (SELECT COUNT(DISTINCT c.id) FROM counters c
                 JOIN staff_assignments sa ON sa.counter_id = c.id AND sa.assignment_date = CURDATE()
                 JOIN staff_shifts sh ON sh.staff_id = sa.staff_id
                  AND sh.clocked_out_at IS NULL AND sh.on_break_since IS NULL
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id
                  AND c.is_active = TRUE)                                       AS counters_open
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
                SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(t.started_serving_at, t.called_at, t.joined_at), t.completed_at))
                FROM queue_tickets t
                WHERE t.queue_id = q.id AND t.status = 'served' AND t.completed_at IS NOT NULL
              ), s.base_avg_time_minutes) AS avg_service_minutes,
              (SELECT COUNT(*) FROM counters c
                WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE) AS active_counters
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
    // Counter-aware and IDENTICAL to the /services projection, so the Branch
    // screen and this pre-join screen never disagree. See utils/etaMath.js.
    const estimated_wait_minutes = projectedWaitMinutes({
      ahead: row.waiting_count,
      perServiceMinutes: row.avg_service_minutes,
      counters: row.active_counters,
    });
    res.json({
      id: row.id,
      waiting_count: row.waiting_count,
      active_counters: row.active_counters,
      estimated_wait_minutes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch live queue info.' });
  }
});

// Get single queue with full ticket list
router.get(
  '/:id',
  requireAuth,
  requireStaffRole('line_staff', 'manager', 'executive'),
  requireQueueAccess,
  async (req, res) => {
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
      `SELECT t.id, t.queue_id, t.user_id, t.intake_form_id, t.ticket_number,
              t.position, t.status, t.estimated_wait_minutes, t.joined_at,
              t.called_at, t.call_timeout_seconds, t.call_expires_at,
              t.started_serving_at, t.completed_at, t.served_by_staff_id,
              t.served_at_counter_id, u.full_name AS user_name
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
  }
);

// Create / open a queue for today
router.post('/', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), requireBranchAccess, validate(schemas.createQueue), async (req, res) => {
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
module.exports.ensureQueuesForToday = ensureQueuesForToday;
