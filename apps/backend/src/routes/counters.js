const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, requireBranchAccess, scopedBranchId } = require('../middleware/tenantAccess');

router.get('/', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.query.branch_id);
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });
    const [rows] = await pool.query(
      `SELECT c.*, s.name AS service_name
       FROM counters c
       LEFT JOIN services s ON s.id = c.service_id
       WHERE c.branch_id = ? AND c.is_active = TRUE
       ORDER BY c.counter_number`,
      [branchId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch counters.' });
  }
});

module.exports = router;
