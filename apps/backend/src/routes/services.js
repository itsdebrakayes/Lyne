/**
 * services.js
 *
 * GET  /api/services?business_id=  — list services for a business (public)
 * GET  /api/services/:id           — get one service (public)
 * POST /api/services               — create (manager/executive)
 * PUT  /api/services/:id           — update (manager/executive)
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    const conditions = ['s.is_active = TRUE'];
    const params = [];
    if (business_id) { conditions.push('s.business_id = ?'); params.push(business_id); }
    if (branch_id)   { conditions.push('s.branch_id = ?');   params.push(branch_id); }
    const where = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await pool.query(
      `SELECT s.*,
              b.name AS business_name,
              -- live waiting count for this service across open queues
              COALESCE((
                SELECT COUNT(*)
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  AND q.is_active = TRUE
                  AND qt.status = 'waiting'
              ), 0) AS waiting_count,
              -- rolling avg wait from last 50 completed tickets
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, qt.created_at, qt.completed_at))
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  AND qt.status = 'completed'
                  AND qt.completed_at IS NOT NULL
                ORDER BY qt.completed_at DESC
                LIMIT 50
              ), s.base_avg_time_minutes) AS avg_wait_minutes
       FROM services s
       JOIN businesses b ON s.business_id = b.id
       ${where}
       ORDER BY s.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch services.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, b.name AS business_name,
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, qt.created_at, qt.completed_at))
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  AND qt.status = 'completed'
                  AND qt.completed_at IS NOT NULL
                ORDER BY qt.completed_at DESC
                LIMIT 50
              ), s.base_avg_time_minutes) AS avg_wait_minutes
       FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found.' });
    const svc = rows[0];
    // Parse intake_schema if stored as JSON string
    if (svc.intake_schema && typeof svc.intake_schema === 'string') {
      try { svc.intake_schema = JSON.parse(svc.intake_schema); } catch { svc.intake_schema = []; }
    }
    if (svc.required_profile_fields && typeof svc.required_profile_fields === 'string') {
      try { svc.required_profile_fields = JSON.parse(svc.required_profile_fields); } catch { svc.required_profile_fields = []; }
    }
    res.json(svc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch service.' });
  }
});

router.post('/', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { business_id, name, description, ticket_prefix, base_avg_time_minutes } = req.body;
    if (!business_id || !name) return res.status(400).json({ error: 'business_id and name are required.' });
    const id = uuidv4();
    await pool.query(
      `INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, business_id, name, description || null, ticket_prefix || null, base_avg_time_minutes || 15]
    );
    const [created] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

router.put('/:id', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { name, description, ticket_prefix, base_avg_time_minutes, is_active } = req.body;
    await pool.query(
      `UPDATE services SET
         name                  = COALESCE(?, name),
         description           = COALESCE(?, description),
         ticket_prefix         = COALESCE(?, ticket_prefix),
         base_avg_time_minutes = COALESCE(?, base_avg_time_minutes),
         is_active             = COALESCE(?, is_active),
         updated_at            = NOW()
       WHERE id = ?`,
      [name, description, ticket_prefix, base_avg_time_minutes, is_active, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

module.exports = router;
