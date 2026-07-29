const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, requireBranchAccess, scopedBranchId } = require('../middleware/tenantAccess');

router.get('/', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.query.branch_id);
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });
    const conditions = ['c.branch_id = ?', 'c.is_active = TRUE'];
    const params = [branchId];
    if (req.query.service_id) {
      conditions.push('c.service_id = ?');
      params.push(req.query.service_id);
    }
    const [rows] = await pool.query(
      `SELECT c.*, s.name AS service_name
       FROM counters c
       LEFT JOIN services s ON s.id = c.service_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.counter_number`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counters.' });
  }
});

/**
 * POST /counters — add a service window to a branch.
 *
 * Counters could be read but never created through the API, so a new business
 * had no way to configure its windows: the setup wizard could not finish, and
 * the supervisor's desk board — which reads counters — had nothing to show.
 *
 * counter_number is allocated per branch rather than supplied, so two people
 * setting up at once cannot collide on it.
 */
router.post('/', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { branch_id, service_id, label } = req.body || {};
    const branchId = scopedBranchId(req, branch_id);
    if (!branchId || !service_id) {
      return res.status(400).json({ error: 'branch_id and service_id are required.' });
    }

    await conn.beginTransaction();
    const [[{ next_number }]] = await conn.query(
      'SELECT COALESCE(MAX(counter_number), 0) + 1 AS next_number FROM counters WHERE branch_id = ? FOR UPDATE',
      [branchId]
    );
    const [[service]] = await conn.query('SELECT name FROM services WHERE id = ?', [service_id]);
    if (!service) {
      await conn.rollback();
      return res.status(404).json({ error: 'That service does not exist.' });
    }

    const id = uuidv4();
    const finalLabel = (label && String(label).trim()) || `Counter ${next_number} - ${service.name}`;
    await conn.query(
      `INSERT INTO counters (id, branch_id, service_id, counter_number, label, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [id, branchId, service_id, next_number, finalLabel]
    );
    await conn.commit();

    const [[created]] = await pool.query('SELECT * FROM counters WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('POST /counters failed:', err);
    res.status(500).json({ error: 'Could not create the counter.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
