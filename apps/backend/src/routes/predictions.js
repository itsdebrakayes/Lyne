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
const { validate, schemas } = require('../middleware/validate');
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

/**
 * GET /api/predictions/my-desk — what the model says about the line a clerk is
 * actually working, and nothing else.
 *
 * The generic /predictions route is supervisor-and-up, correctly: it will hand
 * back manager scores, staffing recommendations and anomaly reports, none of
 * which are a line clerk's business. But that left the person doing the work
 * unable to see the one prediction that is about them, while the models
 * computed it every two hours for nobody.
 *
 * So this is scoped rather than opened up: one service — theirs — and the two
 * numbers that mean something at a counter.
 *
 *   what the model expects this hour, and
 *   what they have actually averaged today.
 *
 * Both are shown together on purpose. A prediction on its own is a claim; next
 * to the clerk's own morning it is either confirmation or a question worth
 * asking, and either is more useful than the number alone.
 */
router.get('/my-desk', requireAuth, requireStaffRole('line_staff', 'supervisor', 'manager', 'executive'), async (req, res) => {
  try {
    const staff = req.dbStaff;
    if (!staff) return res.status(403).json({ error: 'Staff only.' });
    const serviceId = req.query.service_id || staff.assigned_service_id;
    if (!serviceId) return res.json({ service_id: null, predicted: null, actual: null });

    const [rows] = await pool.query(
      `SELECT insight_data, model_version, generated_at
         FROM predictive_results
        WHERE business_id = ? AND insight_type = 'service_time_predictions'
        ORDER BY generated_at DESC
        LIMIT 1`,
      [staff.business_id]
    );

    let predicted = null;
    if (rows.length) {
      const data = typeof rows[0].insight_data === 'string'
        ? JSON.parse(rows[0].insight_data)
        : rows[0].insight_data;
      const svc = (data?.services || []).find((x) => x.service_id === serviceId);
      if (svc) {
        const hour = new Date().getHours();
        /* The hourly figure when the model has one for right now, otherwise the
           service's own average. Falling back to a neighbouring hour would be
           inventing a number the model did not produce. */
        const thisHour = (svc.by_hour || []).find((h) => Number(h.hour) === hour);
        predicted = {
          minutes: Number(thisHour?.avg_service_minutes ?? svc.avg_service_minutes) || null,
          basis: thisHour ? 'this hour' : 'all day',
          p90_minutes: Number(svc.p90_service_minutes) || null,
          sample_size: Number(svc.sample_size) || 0,
          service_name: svc.service_name || null,
          model_version: rows[0].model_version,
          generated_at: rows[0].generated_at,
        };
      }
    }

    /* Their own morning, from completed visits at their own hand. started and
       completed both required — a visit without both has no duration to average
       and would drag the number toward zero. */
    const [mine] = await pool.query(
      `SELECT COUNT(*) AS served,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, t.started_serving_at, t.completed_at)) / 60, 1) AS avg_minutes
         FROM queue_tickets t
         JOIN queues q ON q.id = t.queue_id
        WHERE t.served_by_staff_id = ?
          AND q.queue_date = CURDATE()
          AND t.status = 'served'
          AND t.started_serving_at IS NOT NULL
          AND t.completed_at IS NOT NULL`,
      [staff.id]
    );

    res.json({
      service_id: serviceId,
      predicted,
      actual: {
        served_today: Number(mine[0]?.served || 0),
        avg_minutes: mine[0]?.avg_minutes === null ? null : Number(mine[0].avg_minutes),
      },
    });
  } catch (err) {
    console.error('my-desk predictions error:', err);
    res.status(500).json({ error: 'Could not read your desk predictions.' });
  }
});



// ── GET /api/predictions/best-times ──────────────────────────
// Public, computed live from the last 90 days of visit history:
// the best (and worst) time to visit each service of a branch, plus a
// 7-day quietness strip for the mobile "Plan your visit" section.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hourLabel(hour) {
  if (hour === 12) return '12:00 PM';
  return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
}

function quietLevel(avgWait, min, max) {
  if (max <= min) return 1;
  const ratio = (avgWait - min) / (max - min);
  return ratio <= 0.33 ? 1 : ratio <= 0.66 ? 2 : 3; // 1 quiet · 2 busy · 3 peak
}

// A "best time" drawn from a 2-visit cell is noise sold as insight: two lucky
// quiet visits will always undercut a genuinely calm hour backed by hundreds,
// so the headline ends up on whichever slot happens to be thinnest. Rank only
// cells with a real sample behind them — but fall back to the full set for a
// branch too new to have one, so a fresh tenant still sees something.
const MIN_CELL_VISITS = 8;
function wellEvidenced(slots) {
  const solid = slots.filter((slot) => slot.visits >= MIN_CELL_VISITS);
  return solid.length ? solid : slots;
}

router.get('/best-times', async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id || !branch_id) {
      return res.status(400).json({ error: 'business_id and branch_id are required.' });
    }

    const [rows] = await pool.query(
      `SELECT s.id AS service_id, s.name AS service_name,
              w.day_of_week AS dow, w.hour_of_day AS hour,
              COUNT(*) AS visits,
              ROUND(AVG(w.wait_time_minutes), 1) AS avg_wait
       FROM wait_time_records w
       JOIN services s ON s.id = w.service_id
       WHERE w.business_id = ? AND w.branch_id = ?
         AND w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
         AND w.hour_of_day BETWEEN 8 AND 17
       GROUP BY s.id, s.name, w.day_of_week, w.hour_of_day
       HAVING COUNT(*) >= 2`,
      [business_id, branch_id]
    );

    const byService = new Map();
    rows.forEach((row) => {
      const key = row.service_id;
      if (!byService.has(key)) byService.set(key, { service_id: key, service_name: row.service_name, slots: [] });
      byService.get(key).slots.push({ dow: Number(row.dow), hour: Number(row.hour), visits: Number(row.visits), avg_wait: Number(row.avg_wait) });
    });

    const decorate = (slot) => slot && ({
      ...slot,
      day_name: DAY_NAMES[slot.dow] || 'Any day',
      hour_label: hourLabel(slot.hour),
    });

    const services = Array.from(byService.values()).map((service) => {
      const slots = service.slots;
      const ranked = wellEvidenced(slots);
      const best = [...ranked].sort((a, b) => a.avg_wait - b.avg_wait || b.visits - a.visits)[0];
      const busiest = [...ranked].sort((a, b) => b.avg_wait - a.avg_wait || b.visits - a.visits)[0];

      // Day-of-week averages → the 7-day quietness strip.
      const dayTotals = Array.from({ length: 7 }, () => ({ waitTotal: 0, weight: 0 }));
      slots.forEach((slot) => {
        dayTotals[slot.dow].waitTotal += slot.avg_wait * slot.visits;
        dayTotals[slot.dow].weight += slot.visits;
      });
      const dayAverages = dayTotals.map((day, dow) => ({
        dow,
        day_name: DAY_NAMES[dow],
        avg_wait: day.weight ? Math.round((day.waitTotal / day.weight) * 10) / 10 : null,
      }));
      const known = dayAverages.filter((day) => day.avg_wait !== null);
      const minWait = Math.min(...known.map((day) => day.avg_wait));
      const maxWait = Math.max(...known.map((day) => day.avg_wait));
      const week = dayAverages.map((day) => ({
        ...day,
        level: day.avg_wait === null ? 0 : quietLevel(day.avg_wait, minWait, maxWait),
      }));
      const quietestDay = known.sort((a, b) => a.avg_wait - b.avg_wait)[0];

      return {
        service_id: service.service_id,
        service_name: service.service_name,
        best: decorate(best),
        busiest: decorate(busiest),
        quietest_day: quietestDay || null,
        week,
      };
    }).sort((a, b) => a.service_name.localeCompare(b.service_name));

    // Branch-level rollup for the free tier: one honest headline window.
    // The card promises a "typical wait" for the whole branch, so average every
    // service running in that (day, hour) cell, weighted by how many visits each
    // contributed. Taking the single lowest *service* cell instead answered a
    // different question — it surfaced the quietest corner of the quietest
    // service, and reported a 1-minute headline on a branch whose services
    // average 5-11 minutes, which reads as broken rather than impressive.
    const branchCells = new Map();
    rows.forEach((row) => {
      const key = `${row.dow}:${row.hour}`;
      const cell = branchCells.get(key)
        || { dow: Number(row.dow), hour: Number(row.hour), waitTotal: 0, visits: 0 };
      cell.waitTotal += Number(row.avg_wait) * Number(row.visits);
      cell.visits += Number(row.visits);
      branchCells.set(key, cell);
    });
    const branchSlots = Array.from(branchCells.values()).map((cell) => ({
      dow: cell.dow,
      hour: cell.hour,
      visits: cell.visits,
      avg_wait: Math.round((cell.waitTotal / cell.visits) * 10) / 10,
    }));
    const branchBest = decorate(
      [...wellEvidenced(branchSlots)].sort((a, b) => a.avg_wait - b.avg_wait || b.visits - a.visits)[0]
    );

    res.json({
      window_days: 90,
      branch_best: branchBest || null,
      services,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute best visit times.' });
  }
});

router.get(
  '/',
  requireAuth,
  requireStaffRole('supervisor', 'manager', 'executive'),
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
  auditLog('prediction_import', 'predictive_result'), validate(schemas.savePrediction),
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
