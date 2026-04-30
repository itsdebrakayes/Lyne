/**
 * analytics.js
 *
 * GET /api/analytics/summary?business_id=&branch_id=&from=&to=
 *     — daily summaries for dashboards (manager/executive)
 *
 * GET /api/analytics/heatmap?business_id=&branch_id=
 *     — hourly traffic heatmap (manager/executive)
 *
 * GET /api/analytics/services?business_id=&branch_id=
 *     — service performance ranking (manager/executive)
 *
 * GET /api/analytics/staff?business_id=&branch_id=
 *     — staff performance (manager/executive)
 */

const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

// Daily summary
router.get('/summary', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { business_id, branch_id, from, to } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['a.business_id = ?'];
    const params = [business_id];
    if (branch_id) { conditions.push('a.branch_id = ?'); params.push(branch_id); }
    if (from)      { conditions.push('a.summary_date >= ?'); params.push(from); }
    if (to)        { conditions.push('a.summary_date <= ?'); params.push(to); }
    else           { conditions.push('a.summary_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'); }

    const [rows] = await pool.query(
      `SELECT a.*, b.name AS branch_name
       FROM analytics_summaries a
       LEFT JOIN branches b ON a.branch_id = b.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.summary_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics summary.' });
  }
});

// Hourly heatmap
router.get('/heatmap', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['w.business_id = ?', 'w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)'];
    const params = [business_id];
    if (branch_id) { conditions.push('w.branch_id = ?'); params.push(branch_id); }

    const [rows] = await pool.query(
      `SELECT w.day_of_week AS dow,
              w.hour_of_day AS hour,
              COUNT(*)                              AS visit_count,
              ROUND(AVG(w.wait_time_minutes), 1)   AS avg_wait,
              SUM(w.status = 'completed')           AS completed,
              SUM(w.status = 'no_show')             AS no_shows
       FROM wait_time_records w
       WHERE ${conditions.join(' AND ')}
       GROUP BY w.day_of_week, w.hour_of_day
       ORDER BY w.day_of_week, w.hour_of_day`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch heatmap.' });
  }
});

// Service performance
router.get('/services', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['w.business_id = ?'];
    const params = [business_id];
    if (branch_id) { conditions.push('w.branch_id = ?'); params.push(branch_id); }

    const [rows] = await pool.query(
      `SELECT s.id AS service_id, s.name AS service_name,
              COUNT(*)                              AS total_visits,
              SUM(w.status = 'completed')           AS completed,
              SUM(w.status = 'cancelled')           AS cancelled,
              SUM(w.status = 'no_show')             AS no_shows,
              ROUND(AVG(w.wait_time_minutes), 1)    AS avg_wait_minutes,
              ROUND(AVG(w.service_time_minutes), 1) AS avg_service_minutes,
              ROUND(SUM(w.status != 'completed') / COUNT(*) * 100, 1) AS dropoff_pct
       FROM wait_time_records w
       JOIN services s ON w.service_id = s.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY s.id, s.name
       ORDER BY total_visits DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch service performance.' });
  }
});

// Staff performance
router.get('/staff', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['st.business_id = ?', "t.status = 'completed'"];
    const params = [business_id];
    if (branch_id) { conditions.push('st.branch_id = ?'); params.push(branch_id); }

    const [rows] = await pool.query(
      `SELECT st.id AS staff_id, st.full_name, st.staff_code,
              COUNT(t.id)                                                   AS tickets_handled,
              ROUND(AVG(TIMESTAMPDIFF(MINUTE, t.started_serving_at, t.completed_at)), 1) AS avg_handle_minutes
       FROM queue_tickets t
       JOIN staff st ON t.served_by_staff_id = st.id
       WHERE ${conditions.join(' AND ')}
         AND t.started_serving_at IS NOT NULL AND t.completed_at IS NOT NULL
       GROUP BY st.id, st.full_name, st.staff_code
       ORDER BY tickets_handled DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch staff performance.' });
  }
});

module.exports = router;
