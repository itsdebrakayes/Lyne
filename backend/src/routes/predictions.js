/**
 * predictions.js — Predictive model results (Jupyter output)
 *
 * GET  /api/predictions?business_id=&branch_id=&type=  — get latest insights (public)
 * POST /api/predictions                                 — upsert insight (executive/system)
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

// Get predictions — public (used by Best Time page and user website)
router.get('/', async (req, res) => {
  try {
    const { business_id, branch_id, type } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['p.business_id = ?'];
    const params = [business_id];
    if (branch_id) { conditions.push('p.branch_id = ?'); params.push(branch_id); }
    if (type)      { conditions.push('p.insight_type = ?'); params.push(type); }

    // Return only the latest record per insight_type
    const [rows] = await pool.query(
      `SELECT p.*, b.name AS branch_name
       FROM predictive_results p
       LEFT JOIN branches b ON p.branch_id = b.id
       WHERE ${conditions.join(' AND ')}
         AND p.generated_at = (
           SELECT MAX(p2.generated_at)
           FROM predictive_results p2
           WHERE p2.business_id = p.business_id
             AND p2.insight_type = p.insight_type
             AND (p2.branch_id = p.branch_id OR (p2.branch_id IS NULL AND p.branch_id IS NULL))
         )
       ORDER BY p.insight_type`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch predictions.' });
  }
});

// Upsert prediction result — called by the Jupyter pipeline import script
router.post('/', requireAuth, requireRole('executive'), async (req, res) => {
  try {
    const { business_id, branch_id, insight_type, insight_data, model_version } = req.body;
    if (!business_id || !insight_type || !insight_data) {
      return res.status(400).json({ error: 'business_id, insight_type, and insight_data are required.' });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO predictive_results (id, business_id, branch_id, insight_type, insight_data, model_version)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, business_id, branch_id || null, insight_type, JSON.stringify(insight_data), model_version || null]
    );
    const [created] = await pool.query('SELECT * FROM predictive_results WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save prediction.' });
  }
});

module.exports = router;
