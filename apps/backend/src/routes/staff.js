/**
 * staff.js
 *
 * GET  /api/staff?business_id=&branch_id=  — list staff (manager/executive)
 * GET  /api/staff/:id                      — get one staff member
 * POST /api/staff                          — create staff (manager/executive)
 * PUT  /api/staff/:id                      — update staff (manager/executive)
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const {
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  scopedBusinessId,
  scopedBranchId,
  assertBusinessAccess,
  assertBranchAccess,
} = require('../middleware/tenantAccess');

const STAFF_AVAILABILITY_STATUSES = new Set(['active', 'on_leave', 'inactive']);

router.get('/', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    const conditions = ['s.is_active = TRUE'];
    const params = [];
    const scopedBusiness = scopedBusinessId(req, business_id);
    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBusiness) { conditions.push('s.business_id = ?'); params.push(scopedBusiness); }
    if (scopedBranch)   { conditions.push('s.branch_id = ?');   params.push(scopedBranch); }

    const [rows] = await pool.query(
      `SELECT s.*, r.name AS role_name, r.label AS role_label,
              b.name AS branch_name, svc.name AS assigned_service_name
       FROM staff s
       JOIN roles r ON s.role_id = r.id
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN services svc ON s.assigned_service_id = svc.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.name, s.full_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff.' });
  }
});

function presenceStatus(row) {
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  const now = Date.now();
  const minutesSinceSeen = lastSeen ? (now - lastSeen) / 60000 : Infinity;
  if (minutesSinceSeen <= 5) return 'online';
  if (minutesSinceSeen <= 30) return 'recent';
  if (row.assignment_id) return 'scheduled';
  return 'offline';
}

router.get('/presence', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.query.business_id);
    const branchId = scopedBranchId(req, req.query.branch_id);
    const conditions = ['s.is_active = TRUE', 's.business_id = ?', "r.name IN ('line_staff', 'manager')"];
    const params = [businessId];
    if (branchId) {
      conditions.push('s.branch_id = ?');
      params.push(branchId);
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.staff_code, s.email, s.phone,
              s.branch_id, b.name AS branch_name,
              r.name AS role_name, r.label AS role_label,
              sa.id AS assignment_id, sa.shift_start, sa.shift_end,
              c.id AS counter_id, c.label AS counter_label, c.counter_number,
              svc.id AS service_id, svc.name AS service_name,
              sessions.last_seen_at
       FROM staff s
       JOIN roles r ON r.id = s.role_id
       LEFT JOIN branches b ON b.id = s.branch_id
       LEFT JOIN staff_assignments sa ON sa.staff_id = s.id AND sa.assignment_date = CURDATE()
       LEFT JOIN counters c ON c.id = sa.counter_id
       LEFT JOIN services svc ON svc.id = c.service_id
       LEFT JOIN (
         SELECT staff_id, MAX(last_seen_at) AS last_seen_at
         FROM user_sessions
         WHERE session_type = 'staff' AND expires_at > NOW()
         GROUP BY staff_id
       ) sessions ON sessions.staff_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.name, s.full_name`,
      params
    );

    res.json(rows.map(row => ({
      ...row,
      presence_status: presenceStatus(row),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff presence.' });
  }
});

router.get('/on-shift-managers', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.query.branch_id || req.dbStaff.branch_id);
    if (!branchId) return res.json([]);
    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.staff_code, s.email, s.phone,
              b.name AS branch_name,
              sessions.last_seen_at
       FROM staff s
       JOIN roles r ON r.id = s.role_id AND r.name = 'manager'
       JOIN branches b ON b.id = s.branch_id
       LEFT JOIN (
         SELECT staff_id, MAX(last_seen_at) AS last_seen_at
         FROM user_sessions
         WHERE session_type = 'staff' AND expires_at > NOW()
         GROUP BY staff_id
       ) sessions ON sessions.staff_id = s.id
       WHERE s.is_active = TRUE
         AND s.business_id = ?
         AND s.branch_id = ?
       ORDER BY sessions.last_seen_at IS NULL, sessions.last_seen_at DESC, s.full_name`,
      [req.dbStaff.business_id, branchId]
    );
    res.json(rows.map(row => ({ ...row, presence_status: presenceStatus(row) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch on-shift managers.' });
  }
});

router.get('/:id', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, r.name AS role_name, r.label AS role_label,
              b.name AS branch_name, svc.name AS assigned_service_name
       FROM staff s
       JOIN roles r ON s.role_id = r.id
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN services svc ON s.assigned_service_id = svc.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Staff member not found.' });
    if (!assertBusinessAccess(req, rows[0].business_id) || !assertBranchAccess(req, rows[0].branch_id)) {
      return res.status(403).json({ error: 'You do not have access to this staff member.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff member.' });
  }
});

router.post('/', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess('body'), requireBranchAccess, auditLog('create_staff', 'staff'), async (req, res) => {
  try {
    const { business_id, branch_id, role_id, full_name, email, phone, supabase_uid, assigned_service_id, availability_status } = req.body;
    if (!business_id || !role_id || !full_name || !email) {
      return res.status(400).json({ error: 'business_id, role_id, full_name, and email are required.' });
    }
    const availabilityStatus = availability_status || 'active';
    if (!STAFF_AVAILABILITY_STATUSES.has(availabilityStatus)) {
      return res.status(400).json({ error: 'Invalid availability_status.' });
    }

    // Auto-generate staff code
    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM staff WHERE business_id = ?',
      [scopedBusinessId(req, business_id)]
    );
    const [bizRows] = await pool.query('SELECT slug FROM businesses WHERE id = ?', [scopedBusinessId(req, business_id)]);
    const prefix = (bizRows[0]?.slug || 'STF').toUpperCase().slice(0, 4);
    const staffCode = `${prefix}-${String(countRows[0].cnt + 1).padStart(4, '0')}`;

    const id = uuidv4();
    await pool.query(
      `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email, phone, assigned_service_id, availability_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, scopedBusinessId(req, business_id), scopedBranchId(req, branch_id) || null, role_id, supabase_uid || null, staffCode, full_name, email, phone || null, assigned_service_id || null, availabilityStatus]
    );
    const [created] = await pool.query('SELECT * FROM staff WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create staff member.' });
  }
});

router.put('/:id', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, auditLog('update_staff', 'staff'), async (req, res) => {
  try {
    const { branch_id, role_id, full_name, email, phone, assigned_service_id, availability_status, is_active, supabase_uid } = req.body;
    if (availability_status && !STAFF_AVAILABILITY_STATUSES.has(availability_status)) {
      return res.status(400).json({ error: 'Invalid availability_status.' });
    }
    const [existing] = await pool.query('SELECT business_id, branch_id FROM staff WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Staff member not found.' });
    if (!assertBusinessAccess(req, existing[0].business_id) || !assertBranchAccess(req, existing[0].branch_id)) {
      return res.status(403).json({ error: 'You do not have access to this staff member.' });
    }
    await pool.query(
      `UPDATE staff SET
         branch_id           = COALESCE(?, branch_id),
         role_id             = COALESCE(?, role_id),
         full_name           = COALESCE(?, full_name),
         email               = COALESCE(?, email),
         phone               = COALESCE(?, phone),
         assigned_service_id = COALESCE(?, assigned_service_id),
         availability_status = COALESCE(?, availability_status),
         is_active           = COALESCE(?, is_active),
         supabase_uid        = COALESCE(?, supabase_uid),
         updated_at          = NOW()
       WHERE id = ?`,
      [scopedBranchId(req, branch_id), role_id, full_name, email, phone, assigned_service_id, availability_status, is_active, supabase_uid, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update staff member.' });
  }
});

module.exports = router;
