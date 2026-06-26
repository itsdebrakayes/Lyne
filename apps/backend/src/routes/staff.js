/**
 * staff.js
 *
 * GET  /api/staff?business_id=&branch_id=  — list staff (manager/executive)
 * GET  /api/staff/:id                      — get one staff member
 * POST /api/staff                          — create staff (manager/executive)
 * PUT  /api/staff/:id                      — update staff (manager/executive)
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
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
    const { business_id, branch_id, role_id, full_name, email, phone, supabase_uid, assigned_service_id } = req.body;
    if (!business_id || !role_id || !full_name || !email) {
      return res.status(400).json({ error: 'business_id, role_id, full_name, and email are required.' });
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
      `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email, phone, assigned_service_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, scopedBusinessId(req, business_id), scopedBranchId(req, branch_id) || null, role_id, supabase_uid || null, staffCode, full_name, email, phone || null, assigned_service_id || null]
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
    const { branch_id, role_id, full_name, email, phone, assigned_service_id, is_active, supabase_uid } = req.body;
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
         is_active           = COALESCE(?, is_active),
         supabase_uid        = COALESCE(?, supabase_uid),
         updated_at          = NOW()
       WHERE id = ?`,
      [scopedBranchId(req, branch_id), role_id, full_name, email, phone, assigned_service_id, is_active, supabase_uid, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update staff member.' });
  }
});

module.exports = router;
