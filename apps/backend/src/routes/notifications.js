/**
 * notifications.js
 *
 * GET  /api/notifications          — get notifications for current user
 * POST /api/notifications          — send a notification (staff/system)
 * PUT  /api/notifications/:id/read — mark as read
 * PUT  /api/notifications/read-all — mark all as read
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole } = require('../middleware/tenantAccess');

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUser?.id;
    if (!userId) return res.status(403).json({ error: 'User account required.' });

    const [rows] = await pool.query(
      `SELECT n.*, t.ticket_number
       FROM notifications n
       LEFT JOIN queue_tickets t ON n.ticket_id = t.id
       WHERE n.user_id = ?
       ORDER BY n.sent_at DESC
       LIMIT 50`,
      [userId]
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

router.post('/', requireAuth, requireStaffRole('line_staff', 'manager', 'executive', 'platform_admin'), async (req, res) => {
  try {
    const { user_id, ticket_id, notification_type, channel, message } = req.body;
    if (!user_id || !notification_type || !message) {
      return res.status(400).json({ error: 'user_id, notification_type, and message are required.' });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO notifications (id, user_id, ticket_id, notification_type, channel, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user_id, ticket_id || null, notification_type, channel || 'push', message]
    );
    const [created] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});

router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.dbUser?.id]
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
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.dbUser?.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all as read.' });
  }
});

module.exports = router;
