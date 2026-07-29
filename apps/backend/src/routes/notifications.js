/**
 * notifications.js
 *
 * GET  /api/notifications          — get notifications for current user
 * POST /api/notifications          — send a notification (staff/system)
 * PUT  /api/notifications/:id/read — mark as read
 * PUT  /api/notifications/read-all — mark all as read
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, requireTicketAccess } = require('../middleware/tenantAccess');

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId  = req.dbUser?.id || null;
    const staffId = req.dbStaff?.id || null;
    if (!userId && !staffId) return res.status(403).json({ error: 'User account required.' });

    // Addressed to me as a customer OR as a member of staff. Staff-addressed
    // rows are how a manager asks a supervisor to staff a counter.
    const [rows] = await pool.query(
      `SELECT n.*, t.ticket_number, sender.full_name AS sent_by_name
       FROM notifications n
       LEFT JOIN queue_tickets t ON n.ticket_id = t.id
       LEFT JOIN staff sender    ON n.sent_by_staff_id = sender.id
       WHERE (? IS NOT NULL AND n.user_id  = ?)
          OR (? IS NOT NULL AND n.staff_id = ?)
       ORDER BY n.sent_at DESC
       LIMIT 50`,
      [userId, userId, staffId, staffId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

router.post('/register-device', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(403).json({ error: 'User account required.' });
    const { expo_push_token, platform, device_name } = req.body;
    if (!expo_push_token) return res.status(400).json({ error: 'expo_push_token is required.' });
    const id = uuidv4();
    await pool.query(
      `INSERT INTO device_push_tokens
         (id, user_id, expo_push_token, platform, device_name, is_active, last_seen_at)
       VALUES (?, ?, ?, ?, ?, TRUE, NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         platform = VALUES(platform),
         device_name = VALUES(device_name),
         is_active = TRUE,
         last_seen_at = NOW()`,
      [id, userId, expo_push_token, platform || null, device_name || null]
    );
    const [rows] = await pool.query('SELECT * FROM device_push_tokens WHERE expo_push_token = ?', [expo_push_token]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register device.' });
  }
});

router.post('/', requireAuth, requireStaffRole('line_staff', 'manager', 'executive', 'platform_admin'), requireTicketAccess, async (req, res) => {
  try {
    const { user_id, ticket_id, notification_type, channel, message } = req.body;
    if (!user_id || !ticket_id || !notification_type || !message) {
      return res.status(400).json({ error: 'user_id, ticket_id, notification_type, and message are required.' });
    }
    const [ticketRows] = await pool.query('SELECT user_id FROM queue_tickets WHERE id = ? LIMIT 1', [ticket_id]);
    if (!ticketRows.length || ticketRows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Notification recipient must own the authorized ticket.' });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO notifications (id, user_id, ticket_id, notification_type, channel, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user_id, ticket_id, notification_type, channel || 'push', message]
    );
    const [created] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});


/**
 * POST /api/notifications/staff-request
 *
 * A manager asking the supervisor of a branch to do something that is the
 * supervisor's job — staffing a counter, principally. Managers deliberately
 * cannot move people onto desks themselves; the section board belongs to the
 * supervisor, and two people rearranging the same floor is how a queue stalls.
 *
 * Addressed to every active supervisor at the branch, because "the supervisor"
 * is a shift, not a person.
 */
router.post('/staff-request', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  try {
    const { branch_id: branchId, message, request_type: requestType } = req.body || {};
    const from = req.dbStaff;
    if (!from) return res.status(403).json({ error: 'Staff account required.' });

    const targetBranch = branchId || from.branch_id;
    if (!targetBranch) return res.status(400).json({ error: 'branch_id is required.' });
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    // Scoped to the sender's own business — a manager cannot page another
    // organisation's floor.
    const [supervisors] = await pool.query(
      `SELECT s.id
         FROM staff s
         JOIN roles r ON s.role_id = r.id
         JOIN branches b ON s.branch_id = b.id
        WHERE r.name = 'supervisor'
          AND s.is_active = TRUE
          AND s.branch_id = ?
          AND b.business_id = ?`,
      [targetBranch, from.business_id]
    );

    if (!supervisors.length) {
      // Say so plainly rather than reporting a send that reached nobody.
      return res.status(404).json({ error: 'No active supervisor is assigned to this branch.' });
    }

    const type = requestType === 'staffing' ? 'staffing_alert' : 'assignment_request';
    const values = supervisors.map((sup) => [
      uuidv4(), null, sup.id, from.id, null, type, 'in_app', String(message).trim(), false, new Date(),
    ]);

    await pool.query(
      `INSERT INTO notifications
         (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at)
       VALUES ?`,
      [values]
    );

    res.status(201).json({ message: 'Request sent.', recipients: supervisors.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the request.' });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
        WHERE id = ?
          AND ((? IS NOT NULL AND user_id = ?) OR (? IS NOT NULL AND staff_id = ?))`,
      [req.params.id, req.dbUser?.id || null, req.dbUser?.id || null,
       req.dbStaff?.id || null, req.dbStaff?.id || null]
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
});

router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE
        WHERE (? IS NOT NULL AND user_id = ?) OR (? IS NOT NULL AND staff_id = ?)`,
      [req.dbUser?.id || null, req.dbUser?.id || null,
       req.dbStaff?.id || null, req.dbStaff?.id || null]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all as read.' });
  }
});

module.exports = router;
