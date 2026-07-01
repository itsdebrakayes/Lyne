const router = require('express').Router();
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

module.exports = router;
