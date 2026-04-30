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
    const { business_id } = req.query;
    const where = business_id ? 'WHERE s.business_id = ? AND s.is_active = TRUE' : 'WHERE s.is_active = TRUE';
    const params = business_id ? [business_id] : [];
    const [rows] = await pool.query(
      `SELECT s.*, b.name AS business_name
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
      `SELECT s.*, b.name AS business_name
       FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found.' });
    res.json(rows[0]);
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
