/**
 * targets.js — Business operational targets.
 *
 * GET /api/targets?business_id=  — current targets (manager/executive)
 * PUT /api/targets               — set targets + horizon (executive only)
 *
 * Targets drive the efficiency scoring, drill-downs, and the executive
 * action plan, so the business decides what "on target" means and by when.
 */

const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { auditLog } = require('../middleware/auditLog');
const {
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  scopedBusinessId,
  scopedBranchId,
} = require('../middleware/tenantAccess');

const DEFAULTS = {
  target_wait_minutes: 20,
  target_completion_rate: 80,
  target_no_show_rate: 10,
  horizon_months: 6,
};

function clampInt(value, min, max, fallback) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function horizonDate(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

// The company target row, or the hardcoded defaults if the executive hasn't set
// one. Shared by the business route and the branch overlay below.
async function fetchBusinessTarget(businessId) {
  const [rows] = await pool.query(
    `SELECT t.*, s.full_name AS set_by_name
     FROM business_targets t
     LEFT JOIN staff s ON s.id = t.set_by_staff_id
     WHERE t.business_id = ?`,
    [businessId]
  );
  if (rows.length) return { ...rows[0], is_default: false };
  return {
    business_id: businessId,
    ...DEFAULTS,
    target_date: horizonDate(DEFAULTS.horizon_months),
    note: null,
    set_by_staff_id: null,
    set_by_name: null,
    is_default: true,
  };
}

router.get('/', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), requireBusinessAccess(), async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.query.business_id);
    if (!businessId) return res.status(400).json({ error: 'business_id is required.' });
    res.json(await fetchBusinessTarget(businessId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch business targets.' });
  }
});

router.put('/', requireAuth, requireStaffRole('executive'), requireBusinessAccess('body'), auditLog('targets_update', 'business_target'), validate(schemas.businessTargets), async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.body.business_id);
    if (!businessId) return res.status(400).json({ error: 'business_id is required.' });

    const targetWait = clampInt(req.body.target_wait_minutes, 1, 240, DEFAULTS.target_wait_minutes);
    const targetCompletion = clampInt(req.body.target_completion_rate, 1, 100, DEFAULTS.target_completion_rate);
    const targetNoShow = clampInt(req.body.target_no_show_rate, 0, 100, DEFAULTS.target_no_show_rate);
    const horizonMonths = clampInt(req.body.horizon_months, 1, 60, DEFAULTS.horizon_months);
    const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 255) : null;
    const targetDate = horizonDate(horizonMonths);

    await pool.query(
      `INSERT INTO business_targets
         (business_id, target_wait_minutes, target_completion_rate, target_no_show_rate,
          horizon_months, target_date, note, set_by_staff_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         target_wait_minutes = VALUES(target_wait_minutes),
         target_completion_rate = VALUES(target_completion_rate),
         target_no_show_rate = VALUES(target_no_show_rate),
         horizon_months = VALUES(horizon_months),
         target_date = VALUES(target_date),
         note = VALUES(note),
         set_by_staff_id = VALUES(set_by_staff_id)`,
      [businessId, targetWait, targetCompletion, targetNoShow, horizonMonths, targetDate, note, req.dbStaff?.id || null]
    );

    const [rows] = await pool.query(
      `SELECT t.*, s.full_name AS set_by_name
       FROM business_targets t
       LEFT JOIN staff s ON s.id = t.set_by_staff_id
       WHERE t.business_id = ?`,
      [businessId]
    );
    res.json({ ...rows[0], is_default: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save business targets.' });
  }
});

// ── Branch-level targets ─────────────────────────────────────────────────────
// A manager refines the company target for their OWN branch. The effective
// numbers a branch is measured against are the overlay: branch → company →
// default. We always return the company target alongside, so the UI can show a
// branch target "within" the company target it inherits from.

const BRANCH_METRICS = ['target_wait_minutes', 'target_completion_rate', 'target_no_show_rate'];

async function branchWithBusiness(branchId) {
  const [rows] = await pool.query('SELECT id, business_id FROM branches WHERE id = ? LIMIT 1', [branchId]);
  return rows[0] || null;
}

// GET /api/targets/branch?branch_id= — effective targets for one branch.
router.get('/branch', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.query.branch_id);
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });
    const branch = await branchWithBusiness(branchId);
    if (!branch) return res.status(404).json({ error: 'Branch not found.' });

    const company = await fetchBusinessTarget(branch.business_id);
    const [rows] = await pool.query(
      `SELECT bt.*, s.full_name AS set_by_name
       FROM branch_targets bt
       LEFT JOIN staff s ON s.id = bt.set_by_staff_id
       WHERE bt.branch_id = ?`,
      [branchId]
    );
    const branchRow = rows[0] || null;

    // Overlay: a branch metric that hasn't been set falls back to the company
    // value (which itself falls back to the hardcoded default).
    const effective = { target_wait_minutes: company.target_wait_minutes, target_completion_rate: company.target_completion_rate, target_no_show_rate: company.target_no_show_rate };
    if (branchRow) {
      for (const m of BRANCH_METRICS) if (branchRow[m] != null) effective[m] = branchRow[m];
    }

    res.json({
      branch_id: branchId,
      business_id: branch.business_id,
      ...effective,
      // The strategic horizon stays a company concept; a branch inherits it.
      horizon_months: company.horizon_months,
      target_date: company.target_date,
      note: branchRow?.note ?? null,
      set_by_name: branchRow?.set_by_name ?? null,
      updated_at: branchRow?.updated_at ?? null,
      is_default: !branchRow,          // true = inheriting the company target verbatim
      company,                          // the target this branch works within
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branch targets.' });
  }
});

// PUT /api/targets/branch — a manager sets their own branch's targets (an
// executive may set any branch in their business). scopedBranchId pins a
// manager/supervisor to their own branch regardless of the body.
router.put('/branch', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, auditLog('branch_targets_update', 'branch_target'), validate(schemas.branchTargets), async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.body.branch_id);
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });
    const branch = await branchWithBusiness(branchId);
    if (!branch) return res.status(404).json({ error: 'Branch not found.' });

    const targetWait = clampInt(req.body.target_wait_minutes, 1, 240, DEFAULTS.target_wait_minutes);
    const targetCompletion = clampInt(req.body.target_completion_rate, 1, 100, DEFAULTS.target_completion_rate);
    const targetNoShow = clampInt(req.body.target_no_show_rate, 0, 100, DEFAULTS.target_no_show_rate);
    const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 255) : null;

    await pool.query(
      `INSERT INTO branch_targets
         (branch_id, business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, note, set_by_staff_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         target_wait_minutes = VALUES(target_wait_minutes),
         target_completion_rate = VALUES(target_completion_rate),
         target_no_show_rate = VALUES(target_no_show_rate),
         note = VALUES(note),
         set_by_staff_id = VALUES(set_by_staff_id)`,
      [branchId, branch.business_id, targetWait, targetCompletion, targetNoShow, note, req.dbStaff?.id || null]
    );

    // Return the same effective shape the GET produces.
    const company = await fetchBusinessTarget(branch.business_id);
    const [rows] = await pool.query(
      `SELECT bt.*, s.full_name AS set_by_name
       FROM branch_targets bt LEFT JOIN staff s ON s.id = bt.set_by_staff_id
       WHERE bt.branch_id = ?`,
      [branchId]
    );
    const branchRow = rows[0];
    res.json({
      branch_id: branchId,
      business_id: branch.business_id,
      target_wait_minutes: branchRow.target_wait_minutes,
      target_completion_rate: branchRow.target_completion_rate,
      target_no_show_rate: branchRow.target_no_show_rate,
      horizon_months: company.horizon_months,
      target_date: company.target_date,
      note: branchRow.note,
      set_by_name: branchRow.set_by_name,
      updated_at: branchRow.updated_at,
      is_default: false,
      company,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save branch targets.' });
  }
});

module.exports = router;
