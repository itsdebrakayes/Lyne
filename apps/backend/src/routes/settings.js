/**
 * settings.js — the manager Settings tab, made real.
 *
 * That tab shipped as pure React state: three toggles backed by useState and two
 * dropdowns wired to `onChange={() => undefined}`. A manager could switch
 * "Text Customers When Called" off, watch it move, believe SMS was disabled, and
 * be wrong. A control that silently lies is worse than a disabled one.
 *
 * What lives here is only what has behaviour behind it:
 *
 *   • allow_overflow      — branch policy, ENFORCED in assertLineStaffQueueAccess.
 *                           This genuinely widens who may call from a queue.
 *   • idle_after_minutes  — per person; filters their own "needs attention" feed.
 *   • line_over_target    — per person; same feed.
 *
 * Two settings on that tab are deliberately absent, because the features they
 * describe do not exist yet (no SMS integration, no kiosk printer). They stay
 * visibly disabled in the UI with the reason shown. When either lands, add it
 * here — do not add storage first and hope.
 *
 * Scoping follows targets.js exactly: scopedBranchId pins a manager to their own
 * branch whatever the body says; an executive may address any branch in their
 * own business; requireBranchAccess rejects anything outside the tenant.
 */
const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { requireStaffRole, requireBranchAccess, scopedBranchId } = require('../middleware/tenantAccess');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

/** Absent rows mean defaults, so GET never 404s on a branch nobody has configured. */
const BRANCH_DEFAULTS = Object.freeze({ allow_overflow: false });
const ALERT_DEFAULTS = Object.freeze({ idle_after_minutes: 20, line_over_target: 'on' });

/** Only thresholds the UI offers. Anything else falls back rather than being stored. */
const IDLE_CHOICES = [10, 20];

function shapeBranch(row) {
  if (!row) return { ...BRANCH_DEFAULTS };
  return {
    allow_overflow: Boolean(row.allow_overflow),
    updated_by_name: row.updated_by_name || null,
    updated_at: row.updated_at || null,
  };
}

function shapeAlerts(row) {
  if (!row) return { ...ALERT_DEFAULTS };
  return {
    // NULL is meaningful: "never raise idle alerts". It must survive the round
    // trip rather than being coerced back to the 20-minute default.
    idle_after_minutes: row.idle_after_minutes === null ? null : Number(row.idle_after_minutes),
    line_over_target: row.line_over_target === 'off' ? 'off' : 'on',
  };
}

// ── GET /api/settings/branch?branch_id= ──────────────────────
// Both halves in one call: the tab renders them together, and two round trips
// would let the screen paint half-configured.
router.get('/branch', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.query.branch_id);
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });

    const [[branchRow], [alertRow], [hoursRow]] = await Promise.all([
      pool.query(
        `SELECT bs.*, s.full_name AS updated_by_name
           FROM branch_settings bs
           LEFT JOIN staff s ON s.id = bs.updated_by
          WHERE bs.branch_id = ?`,
        [branchId]
      ).then((r) => r[0]),
      pool.query('SELECT * FROM staff_alert_prefs WHERE staff_id = ?', [req.dbStaff?.id || null])
        .then((r) => r[0]),
      // The read-only half of the tab. It lives on `branches` and the manager
      // cannot change it, but the tab still has to SHOW it — it used to render
      // a hardcoded em-dash, which read as "not configured" on branches that
      // were configured perfectly well.
      pool.query(
        'SELECT name, opening_time, closing_time, open_days FROM branches WHERE id = ? LIMIT 1',
        [branchId]
      ).then((r) => r[0]),
    ]);

    res.json({
      branch_id: branchId,
      branch: shapeBranch(branchRow),
      alerts: shapeAlerts(alertRow),
      hours: hoursRow
        ? {
            name: hoursRow.name,
            opening_time: hoursRow.opening_time,
            closing_time: hoursRow.closing_time,
            open_days: hoursRow.open_days,
          }
        : null,
    });
  } catch (err) {
    console.error('settings/branch GET:', err);
    res.status(500).json({ error: 'Failed to load branch settings.' });
  }
});

// ── PUT /api/settings/branch ─────────────────────────────────
// Branch policy. Supervisors are read-only on this tab, so they are not admitted.
router.put('/branch', requireAuth, requireStaffRole('manager', 'executive'), requireBranchAccess, auditLog('branch_settings_update', 'branch_setting'), validate(schemas.branchSettings), async (req, res) => {
  try {
    const branchId = scopedBranchId(req, req.body.branch_id);
    if (!branchId) return res.status(400).json({ error: 'branch_id is required.' });

    const allowOverflow = req.body.allow_overflow ? 1 : 0;

    await pool.query(
      `INSERT INTO branch_settings (branch_id, allow_overflow, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         allow_overflow = VALUES(allow_overflow),
         updated_by = VALUES(updated_by)`,
      [branchId, allowOverflow, req.dbStaff?.id || null]
    );

    const [rows] = await pool.query(
      `SELECT bs.*, s.full_name AS updated_by_name
         FROM branch_settings bs
         LEFT JOIN staff s ON s.id = bs.updated_by
        WHERE bs.branch_id = ?`,
      [branchId]
    );
    res.json({ branch_id: branchId, branch: shapeBranch(rows[0]) });
  } catch (err) {
    console.error('settings/branch PUT:', err);
    res.status(500).json({ error: 'Failed to save branch settings.' });
  }
});

// ── PUT /api/settings/alerts ─────────────────────────────────
// "Alerts To Me" is per person by design: two managers at one branch may want
// different thresholds. No branch scoping — you may only ever set your own.
router.put('/alerts', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), validate(schemas.alertPrefs), async (req, res) => {
  try {
    const staffId = req.dbStaff?.id;
    if (!staffId) return res.status(403).json({ error: 'Staff account required.' });

    // null / 'off' both mean "never" — the client sends null, but tolerate the
    // string so a hand-made request cannot store a bogus threshold.
    const raw = req.body.idle_after_minutes;
    const idle = raw === null || raw === 'off' || raw === undefined
      ? null
      : (IDLE_CHOICES.includes(Number(raw)) ? Number(raw) : ALERT_DEFAULTS.idle_after_minutes);

    const lineOverTarget = req.body.line_over_target === 'off' ? 'off' : 'on';

    await pool.query(
      `INSERT INTO staff_alert_prefs (staff_id, idle_after_minutes, line_over_target)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         idle_after_minutes = VALUES(idle_after_minutes),
         line_over_target = VALUES(line_over_target)`,
      [staffId, idle, lineOverTarget]
    );

    const [rows] = await pool.query('SELECT * FROM staff_alert_prefs WHERE staff_id = ?', [staffId]);
    res.json({ alerts: shapeAlerts(rows[0]) });
  } catch (err) {
    console.error('settings/alerts PUT:', err);
    res.status(500).json({ error: 'Failed to save alert preferences.' });
  }
});

module.exports = router;
