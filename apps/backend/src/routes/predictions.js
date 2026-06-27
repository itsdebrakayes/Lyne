/**
 * predictions.js — Predictive model results (Jupyter output)
 *
 * GET  /api/predictions/public?business_id=&branch_id=&type= — public customer-facing insights
 * GET  /api/predictions?business_id=&branch_id=&type=        — private company insights
 * POST /api/predictions                                 — upsert insight (executive/system)
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
} = require('../middleware/tenantAccess');

const PUBLIC_INSIGHT_TYPES = new Set(['best_time_to_visit', 'wait_time_predictions', 'heatmap_data']);

async function getPredictions(req, res, publicOnly = false) {
  try {
    const { business_id, branch_id, service_id, type, max_age_minutes = 60 } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });
    if (publicOnly && (!type || !PUBLIC_INSIGHT_TYPES.has(type))) {
      return res.status(400).json({ error: 'A supported public insight type is required.' });
    }

    const conditions = ['p.business_id = ?'];
    const params = [business_id];
    if (branch_id) { conditions.push('p.branch_id = ?'); params.push(branch_id); }
    if (service_id) { conditions.push('p.service_id = ?'); params.push(service_id); }
    if (type) { conditions.push('p.insight_type = ?'); params.push(type); }

    const [rows] = await pool.query(
      `SELECT p.*, b.name AS branch_name, s.name AS service_name,
              CASE
                WHEN p.stale_after IS NOT NULL AND p.stale_after < NOW() THEN TRUE
                WHEN TIMESTAMPDIFF(MINUTE, p.generated_at, NOW()) > ? THEN TRUE
                ELSE FALSE
              END AS is_stale
       FROM predictive_results p
       LEFT JOIN branches b ON p.branch_id = b.id
       LEFT JOIN services s ON p.service_id = s.id
       WHERE ${conditions.join(' AND ')}
         AND p.generated_at = (
           SELECT MAX(p2.generated_at)
           FROM predictive_results p2
           WHERE p2.business_id = p.business_id
             AND p2.insight_type = p.insight_type
             AND (p2.branch_id = p.branch_id OR (p2.branch_id IS NULL AND p.branch_id IS NULL))
             AND (p2.service_id = p.service_id OR (p2.service_id IS NULL AND p.service_id IS NULL))
         )
       ORDER BY p.insight_type`,
      [Math.min(Math.max(parseInt(max_age_minutes) || 60, 5), 1440), ...params]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch predictions.' });
  }
}

router.get('/public', (req, res) => getPredictions(req, res, true));

router.get(
  '/',
  requireAuth,
  requireStaffRole('manager', 'executive'),
  requireBusinessAccess(),
  requireBranchAccess,
  (req, res) => getPredictions(req, res)
);

// Upsert prediction result — called by the Jupyter pipeline import script
router.post(
  '/',
  requireAuth,
  requireStaffRole('executive'),
  requireBusinessAccess('body'),
  requireBranchAccess,
  auditLog('prediction_import', 'predictive_result'),
  async (req, res) => {
  try {
    const {
      business_id,
      branch_id,
      service_id,
      insight_type,
      insight_data,
      model_version,
      generated_at,
      source_window_start,
      source_window_end,
      records_processed,
      stale_after,
    } = req.body;
    if (!business_id || !insight_type || !insight_data) {
      return res.status(400).json({ error: 'business_id, insight_type, and insight_data are required.' });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO predictive_results
         (id, business_id, branch_id, service_id, insight_type, insight_data, model_version,
          source_window_start, source_window_end, records_processed, stale_after, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [
        id,
        scopedBusinessId(req, business_id),
        branch_id || null,
        service_id || null,
        insight_type,
        JSON.stringify(insight_data),
        model_version || null,
        source_window_start || null,
        source_window_end || null,
        records_processed || 0,
        stale_after || null,
        generated_at || null,
      ]
    );
    const [created] = await pool.query('SELECT * FROM predictive_results WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save prediction.' });
  }
});

module.exports = router;
