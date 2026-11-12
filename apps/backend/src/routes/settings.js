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
 *   • text_when_called    — branch policy, read by utils/smsAlerts.js. Off by
 *                           default, because each text costs money.
 *
 * Kiosk printing is deliberately absent: there is no printer driver, so it stays
 * visibly disabled in the UI with the reason shown.
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
const { smsAvailable } = require('../utils/smsSender');
const { randomUUID } = require('crypto');
const publicInsights = require('../lib/publicInsights');

const router = express.Router();

/** Absent rows mean defaults, so GET never 404s on a branch nobody has configured. */
const BRANCH_DEFAULTS = Object.freeze({ allow_overflow: false, line_helper_enabled: true, text_when_called: false });
const ALERT_DEFAULTS = Object.freeze({ idle_after_minutes: 20, line_over_target: 'on' });

/** Only thresholds the UI offers. Anything else falls back rather than being stored. */
const IDLE_CHOICES = [10, 20];

function shapeBranch(row) {
  if (!row) return { ...BRANCH_DEFAULTS, sms_available: smsAvailable() };
  return {
    allow_overflow: Boolean(row.allow_overflow),
    text_when_called: Boolean(row.text_when_called),
    /* Whether the switch can do anything: texting needs the provider connected. */
    sms_available: smsAvailable(),
    /* Read off the branches row, not branch_settings — the Line Helper join
       path reads branches.line_helper_enabled, and one column read by two
       places that could disagree is a bug waiting to happen. */
    line_helper_enabled: row.line_helper_enabled === undefined
      ? true : Boolean(row.line_helper_enabled),
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
        /* RIGHT JOIN from branches, because a branch that has never had its
           settings saved has no branch_settings row at all — and it still has a
           line_helper_enabled value that the UI must show. Starting from
           branch_settings returned nothing and the toggle rendered at its
           default regardless of the column. */
        `SELECT bs.*, s.full_name AS updated_by_name, b.line_helper_enabled
           FROM branches b
           LEFT JOIN branch_settings bs ON bs.branch_id = b.id
           LEFT JOIN staff s ON s.id = bs.updated_by
          WHERE b.id = ?`,
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


    /* Written to the branches row, which is where the Line Helper join path
       reads it. Only when it was actually sent: a settings save that only
       touched overflow must not silently switch Line Helper back on. */
    if (req.body.line_helper_enabled !== undefined) {
      await pool.query(
        'UPDATE branches SET line_helper_enabled = ?, updated_at = NOW() WHERE id = ?',
        [req.body.line_helper_enabled ? 1 : 0, branchId]
      );
    }

    await pool.query(
      `INSERT INTO branch_settings (branch_id, allow_overflow, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         allow_overflow = IF(? IS NULL, allow_overflow, VALUES(allow_overflow)),
         updated_by = VALUES(updated_by)`,
      /* Only what was sent: saving one toggle used to switch overflow off. */
      [branchId, req.body.allow_overflow ? 1 : 0, req.dbStaff?.id || null,
        req.body.allow_overflow === undefined ? null : 1]
    );

    /* Only when sent, as with Line Helper: saving another setting leaves it be. */
    if (req.body.text_when_called !== undefined) {
      await pool.query('UPDATE branch_settings SET text_when_called = ? WHERE branch_id = ?', [req.body.text_when_called ? 1 : 0, branchId]);
    }

    const [rows] = await pool.query(
      `SELECT bs.*, s.full_name AS updated_by_name, b.line_helper_enabled
         FROM branches b
         LEFT JOIN branch_settings bs ON bs.branch_id = b.id
         LEFT JOIN staff s ON s.id = bs.updated_by
        WHERE b.id = ?`,
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

// ── /api/settings/public-insights ────────────────────────────
// How much timing detail the public sees for this organisation (migration 051).
// Executive only: it is a decision about the whole organisation's exposure.
// Always the caller's own organisation; there is no business_id to send.
const PUBLIC_INSIGHT_LEVELS = {
  full: 'Best times, the hour-by-hour heatmap, the week planner and personal recommendations',
  limited: 'The best time for each service and today\'s shape only; no heatmap, week planner or personal recommendations',
};

async function publicInsightsState(businessId) {
  const level = await publicInsights.publicInsightsLevel(businessId);
  const [rows] = await pool.query(
    `SELECT a.created_at AS changed_at, s.full_name AS changed_by
       FROM audit_logs a LEFT JOIN staff s ON s.id = a.actor_id
      WHERE a.business_id = ? AND a.action LIKE 'public_insights_set_%'
      ORDER BY a.created_at DESC LIMIT 1`,
    [businessId]
  );
  return {
    level,
    levels: PUBLIC_INSIGHT_LEVELS,
    last_changed_at: rows[0]?.changed_at || null,
    last_changed_by: rows[0]?.changed_by || null,
  };
}

router.get('/public-insights', requireAuth, requireStaffRole('executive'), async (req, res) => {
  try {
    res.json(await publicInsightsState(req.dbStaff.business_id));
  } catch (err) {
    console.error('settings/public-insights GET:', err);
    res.status(500).json({ error: 'Failed to load what the public sees.' });
  }
});

router.put('/public-insights', requireAuth, requireStaffRole('executive'), validate(schemas.publicInsights), async (req, res) => {
  const businessId = req.dbStaff.business_id;
  const { level } = req.body;
  try {
    await pool.query('UPDATE businesses SET public_insights = ?, updated_at = NOW() WHERE id = ?', [level, businessId]);
    publicInsights.forget(businessId);
    /* Written here rather than by the auditLog middleware, which records the
       request before it runs and cannot say WHICH level was chosen. The action
       carries the level so the audit trail answers "who turned it off, when". */
    await pool.query(
      `INSERT INTO audit_logs (id, actor_id, actor_type, business_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES (?, ?, 'staff', ?, ?, 'business', ?, ?, ?)`,
      [randomUUID(), req.dbStaff.id, businessId, `public_insights_set_${level}`, businessId,
        req.ip || null, req.headers['user-agent'] || null]
    );
    res.json(await publicInsightsState(businessId));
  } catch (err) {
    console.error('settings/public-insights PUT:', err);
    res.status(500).json({ error: 'Failed to save what the public sees.' });
  }
});

module.exports = router;
