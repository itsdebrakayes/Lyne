/**
 * branches.js
 *
 * GET  /api/branches?business_id=  — list branches for a business (public)
 * GET  /api/branches/:id           — get one branch (public)
 * POST /api/branches               — create (manager/executive)
 * PUT  /api/branches/:id           — update (manager/executive)
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const {
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  scopedBusinessId,
  assertBusinessAccess,
  assertBranchAccess,
} = require('../middleware/tenantAccess');

router.get('/', async (req, res) => {
  try {
    const { business_id } = req.query;
    const where = business_id ? 'WHERE br.business_id = ? AND br.is_active = TRUE' : 'WHERE br.is_active = TRUE';
    const params = business_id ? [business_id] : [];
    const [rows] = await pool.query(
      `SELECT br.*, b.name AS business_name, b.slug AS business_slug
       FROM branches br
       JOIN businesses b ON br.business_id = b.id
       ${where}
       ORDER BY br.is_main_branch DESC, br.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branches.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT br.*, b.name AS business_name, b.slug AS business_slug
       FROM branches br
       JOIN businesses b ON br.business_id = b.id
       WHERE br.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Branch not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branch.' });
  }
});

// ── GET /api/branches/:id/stats ───────────────────────────
// Returns live stats for the mobile BranchScreen header row.
router.get('/:id/stats', async (req, res) => {
  try {
    const branchId = req.params.id;
    const [rows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN qt.status = 'waiting' THEN 1 ELSE 0 END), 0)  AS total_waiting,
         COALESCE(AVG(CASE WHEN qt.status = 'waiting' THEN qt.estimated_wait_minutes END), 0) AS avg_wait_minutes,
         COUNT(DISTINCT q.id) AS open_queues
       FROM queues q
       LEFT JOIN queue_tickets qt ON qt.queue_id = q.id
       WHERE q.branch_id = ? AND q.is_active = TRUE AND q.queue_date = CURDATE()`,
      [branchId]
    );
    res.json({
      total_waiting:    rows[0].total_waiting    || 0,
      avg_wait_minutes: Math.round(rows[0].avg_wait_minutes || 0),
      open_queues:      rows[0].open_queues      || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branch stats.' });
  }
});

router.post('/', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess('body'), async (req, res) => {
  try {
    const { business_id, name, address, city, parish, phone, latitude, longitude, is_main_branch } = req.body;
    if (!business_id || !name) return res.status(400).json({ error: 'business_id and name are required.' });
    const id = uuidv4();
    await pool.query(
      `INSERT INTO branches (id, business_id, name, address, city, parish, phone, latitude, longitude, is_main_branch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, scopedBusinessId(req, business_id), name, address || null, city || null, parish || null, phone || null, latitude || null, longitude || null, is_main_branch || false]
    );
    const [created] = await pool.query('SELECT * FROM branches WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create branch.' });
  }
});

router.put('/:id', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const { name, address, city, parish, phone, latitude, longitude, is_main_branch, is_active } = req.body;
    const [existing] = await pool.query('SELECT business_id FROM branches WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Branch not found.' });
    if (!assertBusinessAccess(req, existing[0].business_id) || !assertBranchAccess(req, req.params.id)) {
      return res.status(403).json({ error: 'You do not have access to this branch.' });
    }
    await pool.query(
      `UPDATE branches SET
         name           = COALESCE(?, name),
         address        = COALESCE(?, address),
         city           = COALESCE(?, city),
         parish         = COALESCE(?, parish),
         phone          = COALESCE(?, phone),
         latitude       = COALESCE(?, latitude),
         longitude      = COALESCE(?, longitude),
         is_main_branch = COALESCE(?, is_main_branch),
         is_active      = COALESCE(?, is_active),
         updated_at     = NOW()
       WHERE id = ?`,
      [name, address, city, parish, phone, latitude, longitude, is_main_branch, is_active, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM branches WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update branch.' });
  }
});

module.exports = router;
