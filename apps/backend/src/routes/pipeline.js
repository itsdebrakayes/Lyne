/**
 * pipeline.js
 *
 * Bidirectional notebook pipeline control plane:
 * operational DB -> export/notebooks -> imported insights -> dashboards.
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const {
  requireStaffRole,
  requireBusinessAccess,
  scopedBusinessId,
} = require('../middleware/tenantAccess');

const INSIGHT_TYPES = new Set([
  'ops_insights',
  'staff_metrics',
  'branch_performance',
  'service_performance',
  'resource_recommendations',
  'best_time_to_visit',
  'wait_time_predictions',
  'abandonment_thresholds',
  'heatmap_data',
  'peak_hours',
  'model_performance',
]);

router.get('/status', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.query.business_id);
    const [runs] = await pool.query(
      `SELECT *
       FROM pipeline_runs
       WHERE business_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [businessId]
    );
    const [freshness] = await pool.query(
      `SELECT insight_type,
              MAX(generated_at) AS latest_generated_at,
              MAX(stale_after) AS stale_after,
              SUM(stale_after IS NOT NULL AND stale_after < NOW()) AS stale_count
       FROM predictive_results
       WHERE business_id = ?
       GROUP BY insight_type
       ORDER BY insight_type`,
      [businessId]
    );
    res.json({
      business_id: businessId,
      last_run: runs[0] || null,
      recent_runs: runs,
      insights: freshness.map(row => ({
        ...row,
        is_stale: Boolean(row.stale_count),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pipeline status.' });
  }
});

router.post('/trigger', requireAuth, requireStaffRole('executive'), requireBusinessAccess('body'), auditLog('pipeline_trigger', 'pipeline_run'), async (req, res) => {
  try {
    const { business_id, source_window_start, source_window_end } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO pipeline_runs
         (id, business_id, run_type, status, source_window_start, source_window_end, requested_by_staff_id)
       VALUES (?, ?, 'manual_trigger', 'queued', ?, ?, ?)`,
      [
        id,
        scopedBusinessId(req, business_id),
        source_window_start || null,
        source_window_end || null,
        req.dbStaff?.id || null,
      ]
    );
    const [created] = await pool.query('SELECT * FROM pipeline_runs WHERE id = ?', [id]);
    res.status(202).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to queue pipeline run.' });
  }
});

router.post('/import', requireAuth, requireStaffRole('executive'), requireBusinessAccess('body'), auditLog('pipeline_import', 'predictive_result'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      business_id,
      model_version,
      source_window_start,
      source_window_end,
      records_exported = 0,
      insights = [],
    } = req.body;
    if (!business_id || !Array.isArray(insights)) {
      return res.status(400).json({ error: 'business_id and insights[] are required.' });
    }

    const businessId = scopedBusinessId(req, business_id);
    const runId = uuidv4();
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO pipeline_runs
         (id, business_id, run_type, status, model_version, source_window_start, source_window_end,
          records_exported, records_imported, requested_by_staff_id, started_at)
       VALUES (?, ?, 'import', 'running', ?, ?, ?, ?, 0, ?, NOW())`,
      [
        runId,
        businessId,
        model_version || null,
        source_window_start || null,
        source_window_end || null,
        records_exported,
        req.dbStaff?.id || null,
      ]
    );

    let imported = 0;
    for (const insight of insights) {
      if (!INSIGHT_TYPES.has(insight.insight_type)) {
        throw new Error(`Unsupported insight_type: ${insight.insight_type}`);
      }
      await conn.query(
        `INSERT INTO predictive_results
           (id, business_id, branch_id, service_id, insight_type, insight_data, model_version,
            source_window_start, source_window_end, records_processed, stale_after, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
        [
          uuidv4(),
          businessId,
          insight.branch_id || null,
          insight.service_id || null,
          insight.insight_type,
          JSON.stringify(insight.insight_data || {}),
          model_version || insight.model_version || null,
          source_window_start || insight.source_window_start || null,
          source_window_end || insight.source_window_end || null,
          insight.records_processed || 0,
          insight.stale_after || null,
          insight.generated_at || null,
        ]
      );
      imported += 1;
    }

    await conn.query(
      `UPDATE pipeline_runs
       SET status = 'succeeded', records_imported = ?, completed_at = NOW()
       WHERE id = ?`,
      [imported, runId]
    );
    await conn.commit();

    const [created] = await pool.query('SELECT * FROM pipeline_runs WHERE id = ?', [runId]);
    res.status(201).json({ run: created[0], imported });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to import pipeline insights.', detail: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
