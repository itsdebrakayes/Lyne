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
const { auditLog } = require('../middleware/auditLog');
const {
  requireStaffRole,
  requireBusinessAccess,
  scopedBusinessId,
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

router.get('/', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.query.business_id);
    if (!businessId) return res.status(400).json({ error: 'business_id is required.' });

    const [rows] = await pool.query(
      `SELECT t.*, s.full_name AS set_by_name
       FROM business_targets t
       LEFT JOIN staff s ON s.id = t.set_by_staff_id
       WHERE t.business_id = ?`,
      [businessId]
    );
    if (rows.length) return res.json({ ...rows[0], is_default: false });
    res.json({
      business_id: businessId,
      ...DEFAULTS,
      target_date: horizonDate(DEFAULTS.horizon_months),
      note: null,
      set_by_staff_id: null,
      set_by_name: null,
      is_default: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch business targets.' });
  }
});

router.put('/', requireAuth, requireStaffRole('executive'), requireBusinessAccess('body'), auditLog('targets_update', 'business_target'), async (req, res) => {
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

module.exports = router;
