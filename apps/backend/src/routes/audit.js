/**
 * audit.js — Audit log read route for Q ME NOW
 *
 * GET /api/audit              — List audit log entries (manager/executive only)
 * GET /api/audit/:id          — Get a single audit log entry
 *
 * SECURITY:
 *   - Requires authentication + manager or executive role
 *   - Managers can only view audit logs for their own business
 *   - Executives can view audit logs across all businesses they manage
 *   - Supports filtering by actor_id, resource_type, action, date range
 *   - Pagination required (max 100 per page)
 */
const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, isPlatformAdmin } = require('../middleware/tenantAccess');

// GET /api/audit
router.get('/', requireAuth, requireStaffRole('manager', 'executive', 'platform_admin'), async (req, res) => {
  try {
    const {
      actor_id,
      resource_type,
      action,
      from_date,
      to_date,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset   = (pageNum - 1) * limitNum;

    const conditions = [];
    const params     = [];
    if (!isPlatformAdmin(req)) {
      conditions.push('al.business_id = ?');
      params.push(req.dbStaff.business_id);
    }

    if (actor_id) {
      conditions.push('al.actor_id = ?');
      params.push(actor_id);
    }
    if (resource_type) {
      conditions.push('al.resource_type = ?');
      params.push(resource_type);
    }
    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }
    if (from_date) {
      conditions.push('al.created_at >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('al.created_at <= ?');
      params.push(to_date + ' 23:59:59');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT al.id, al.actor_id, al.actor_type, al.action,
              al.resource_type, al.resource_id,
              al.ip_address, al.user_agent, al.created_at,
              COALESCE(u.full_name, s.full_name) AS actor_name
       FROM audit_logs al
       LEFT JOIN users u  ON al.actor_id = u.id  AND al.actor_type = 'user'
       LEFT JOIN staff s  ON al.actor_id = s.id  AND al.actor_type = 'staff'
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs al ${where}`,
      params
    );

    res.json({
      data:       rows,
      pagination: {
        page:        pageNum,
        limit:       limitNum,
        total:       total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// GET /api/audit/:id
router.get('/:id', requireAuth, requireStaffRole('manager', 'executive', 'platform_admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT al.*, COALESCE(u.full_name, s.full_name) AS actor_name
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id AND al.actor_type = 'user'
       LEFT JOIN staff s ON al.actor_id = s.id AND al.actor_type = 'staff'
       WHERE al.id = ? AND (? = TRUE OR al.business_id = ?)`,
      [req.params.id, isPlatformAdmin(req), req.dbStaff.business_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Audit log entry not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit log entry.' });
  }
});

module.exports = router;
