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
 *
 * GET /api/analytics/executive-kpis?business_id=&month=YYYY-MM
 *     — employee KPI cards for executive dashboards
 */

const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const {
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  scopedBusinessId,
  scopedBranchId,
} = require('../middleware/tenantAccess');

function periodRange(period, month) {
  if (period === 'this_week') {
    return {
      visitSql: 'w.visit_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
      ticketSql: 'DATE(COALESCE(t.completed_at, t.called_at, t.joined_at)) >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)',
      params: [],
    };
  }
  if (period === 'last_week') {
    return {
      visitSql: `w.visit_date >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
                 AND w.visit_date < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`,
      ticketSql: `DATE(COALESCE(t.completed_at, t.called_at, t.joined_at)) >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
                  AND DATE(COALESCE(t.completed_at, t.called_at, t.joined_at)) < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`,
      params: [],
    };
  }
  if (period === 'month') {
    const safeMonth = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
    return {
      visitSql: "DATE_FORMAT(w.visit_date, '%Y-%m') = ?",
      ticketSql: "DATE_FORMAT(COALESCE(t.completed_at, t.called_at, t.joined_at), '%Y-%m') = ?",
      params: [safeMonth],
    };
  }
  return {
    visitSql: 'w.visit_date = CURDATE()',
    ticketSql: 'DATE(COALESCE(t.completed_at, t.called_at, t.joined_at)) = CURDATE()',
    params: [],
  };
}

function monthBounds(month) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month || '') ? month : new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = safeMonth.split('-').map(Number);
  const current = new Date(Date.UTC(year, monthNumber - 1, 1));
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const previous = new Date(Date.UTC(year, monthNumber - 2, 1));
  const format = (date) => date.toISOString().slice(0, 10);
  return {
    month: safeMonth,
    start: format(current),
    next: format(next),
    previousStart: format(previous),
  };
}

function normalizeScore(value, max, higherIsBetter = true) {
  const numeric = Number(value || 0);
  const limit = Number(max || 0);
  if (limit <= 0) return 50;
  const raw = Math.max(0, Math.min(100, (numeric / limit) * 100));
  return higherIsBetter ? raw : 100 - raw;
}

function utilizationScore(utilization) {
  const value = Number(utilization || 0);
  return Math.max(0, Math.min(100, 100 - Math.abs(value - 0.8) * 140));
}

// Daily summary
router.get('/summary', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const { business_id, branch_id, from, to } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['a.business_id = ?'];
    const params = [scopedBusinessId(req, business_id)];
    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBranch) { conditions.push('a.branch_id = ?'); params.push(scopedBranch); }
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

router.get('/line-staff', requireAuth, requireStaffRole('line_staff', 'manager', 'executive'), async (req, res) => {
  try {
    const period = ['today', 'this_week', 'last_week', 'month'].includes(req.query.period) ? req.query.period : 'today';
    const range = periodRange(period, req.query.month);
    const conditions = ['b.business_id = ?', "t.status IN ('served', 'no_show')", range.ticketSql];
    const params = [req.dbStaff.business_id, ...range.params];

    if (req.dbStaff.role_name === 'line_staff') {
      conditions.push('t.served_by_staff_id = ?');
      params.push(req.dbStaff.id);
    } else if (req.query.staff_id) {
      conditions.push('t.served_by_staff_id = ?');
      params.push(req.query.staff_id);
    } else if (req.dbStaff.role_name === 'manager' && req.dbStaff.branch_id) {
      conditions.push('q.branch_id = ?');
      params.push(req.dbStaff.branch_id);
    }

    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total_handled,
         SUM(t.status = 'served') AS served_count,
         SUM(t.status = 'no_show') AS no_show_count,
         ROUND(AVG(TIMESTAMPDIFF(SECOND, t.joined_at, COALESCE(t.started_serving_at, t.called_at, t.completed_at)) / 60), 1) AS avg_wait_minutes,
         ROUND(AVG(CASE WHEN t.status = 'served' THEN TIMESTAMPDIFF(SECOND, t.started_serving_at, t.completed_at) / 60 END), 1) AS avg_service_minutes,
         ROUND(AVG(TIMESTAMPDIFF(SECOND, t.called_at, t.started_serving_at) / 60), 1) AS avg_call_response_minutes
       FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id
       JOIN branches b ON b.id = q.branch_id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    res.json({
      period,
      total_handled: Number(rows[0]?.total_handled || 0),
      served_count: Number(rows[0]?.served_count || 0),
      no_show_count: Number(rows[0]?.no_show_count || 0),
      avg_wait_minutes: Number(rows[0]?.avg_wait_minutes || 0),
      avg_service_minutes: Number(rows[0]?.avg_service_minutes || 0),
      avg_call_response_minutes: Number(rows[0]?.avg_call_response_minutes || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch line staff analytics.' });
  }
});

router.get('/executive-kpis', requireAuth, requireStaffRole('executive'), requireBusinessAccess(), async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.query.business_id);
    if (!businessId) return res.status(400).json({ error: 'business_id is required.' });
    const bounds = monthBounds(req.query.month);

    const [rows] = await pool.query(
      `SELECT
         COUNT(DISTINCT s.id) AS total_employees,
         COUNT(DISTINCT CASE WHEN s.availability_status = 'active' AND current_active.staff_id IS NOT NULL THEN s.id END) AS active_employees,
         COUNT(DISTINCT CASE WHEN s.availability_status = 'active' AND previous_active.staff_id IS NOT NULL THEN s.id END) AS previous_active_employees,
         SUM(s.availability_status = 'on_leave') AS leave_employees,
         SUM(s.created_at >= ? AND s.created_at < ?) AS new_employees
       FROM staff s
       JOIN roles r ON r.id = s.role_id AND r.name IN ('line_staff', 'manager', 'executive')
       LEFT JOIN (
         SELECT staff_id
         FROM user_sessions
         WHERE session_type = 'staff' AND last_seen_at >= ? AND last_seen_at < ?
         UNION
         SELECT staff_id
         FROM staff_assignments
         WHERE assignment_date >= ? AND assignment_date < ?
       ) current_active ON current_active.staff_id = s.id
       LEFT JOIN (
         SELECT staff_id
         FROM user_sessions
         WHERE session_type = 'staff' AND last_seen_at >= ? AND last_seen_at < ?
         UNION
         SELECT staff_id
         FROM staff_assignments
         WHERE assignment_date >= ? AND assignment_date < ?
       ) previous_active ON previous_active.staff_id = s.id
       WHERE s.business_id = ?
         AND s.is_active = TRUE
         AND s.availability_status <> 'inactive'`,
      [
        bounds.start, bounds.next,
        bounds.start, bounds.next,
        bounds.start, bounds.next,
        bounds.previousStart, bounds.start,
        bounds.previousStart, bounds.start,
        businessId,
      ]
    );

    const [newStaff] = await pool.query(
      `SELECT s.id, s.full_name, s.staff_code, s.created_at, b.name AS branch_name
       FROM staff s
       JOIN roles r ON r.id = s.role_id AND r.name IN ('line_staff', 'manager', 'executive')
       LEFT JOIN branches b ON b.id = s.branch_id
       WHERE s.business_id = ?
         AND s.is_active = TRUE
         AND s.availability_status <> 'inactive'
         AND s.created_at >= ? AND s.created_at < ?
       ORDER BY s.created_at DESC
       LIMIT 6`,
      [businessId, bounds.start, bounds.next]
    );

    const row = rows[0] || {};
    const activeEmployees = Number(row.active_employees || 0);
    const previousActiveEmployees = Number(row.previous_active_employees || 0);
    const activeChangePct = previousActiveEmployees
      ? ((activeEmployees - previousActiveEmployees) / previousActiveEmployees) * 100
      : activeEmployees ? 100 : 0;

    res.json({
      month: bounds.month,
      total_employees: Number(row.total_employees || 0),
      active_employees: activeEmployees,
      previous_active_employees: previousActiveEmployees,
      active_change_pct: Math.round(activeChangePct * 10) / 10,
      leave_employees: Number(row.leave_employees || 0),
      new_employees: Number(row.new_employees || 0),
      new_staff: newStaff,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch executive employee KPIs.' });
  }
});

router.get('/managers', requireAuth, requireStaffRole('executive'), requireBusinessAccess(), async (req, res) => {
  try {
    const period = ['today', 'this_week', 'last_week', 'month'].includes(req.query.period) ? req.query.period : 'month';
    const range = periodRange(period, req.query.month);
    const businessId = scopedBusinessId(req, req.query.business_id);
    if (!businessId) return res.status(400).json({ error: 'business_id is required.' });

    const [rows] = await pool.query(
      `SELECT
         mgr.id AS manager_id,
         mgr.full_name AS manager_name,
         mgr.staff_code,
         br.id AS branch_id,
         br.name AS branch_name,
         COUNT(w.id) AS total_visits,
         SUM(w.status = 'served') AS completed_count,
         SUM(w.status = 'no_show') AS no_show_count,
         ROUND(AVG(w.wait_time_minutes), 1) AS avg_wait_minutes,
         ROUND(AVG(w.service_time_minutes), 1) AS avg_service_minutes,
         COALESCE(assignments.assigned_staff, 0) AS assigned_staff,
         COALESCE(counters.counter_count, 0) AS counter_count
       FROM staff mgr
       JOIN roles r ON r.id = mgr.role_id AND r.name = 'manager'
       LEFT JOIN branches br ON br.id = mgr.branch_id
       LEFT JOIN wait_time_records w ON w.branch_id = br.id AND w.business_id = mgr.business_id AND ${range.visitSql}
       LEFT JOIN (
         SELECT c.branch_id, COUNT(DISTINCT sa.staff_id) AS assigned_staff
         FROM staff_assignments sa
         JOIN counters c ON c.id = sa.counter_id
         WHERE sa.assignment_date = CURDATE()
         GROUP BY c.branch_id
       ) assignments ON assignments.branch_id = br.id
       LEFT JOIN (
         SELECT branch_id, COUNT(*) AS counter_count
         FROM counters
         WHERE is_active = TRUE
         GROUP BY branch_id
       ) counters ON counters.branch_id = br.id
       WHERE mgr.business_id = ? AND mgr.is_active = TRUE
       GROUP BY mgr.id, mgr.full_name, mgr.staff_code, br.id, br.name, assignments.assigned_staff, counters.counter_count
       ORDER BY mgr.full_name`,
      [...range.params, businessId]
    );

    const maxVisits = Math.max(...rows.map(row => Number(row.total_visits || 0)), 0);
    const maxWait = Math.max(...rows.map(row => Number(row.avg_wait_minutes || 0)), 0);
    const scored = rows.map(row => {
      const totalVisits = Number(row.total_visits || 0);
      const completed = Number(row.completed_count || 0);
      const noShows = Number(row.no_show_count || 0);
      const completionRate = totalVisits ? completed / totalVisits : 0;
      const noShowRate = totalVisits ? noShows / totalVisits : 0;
      const utilization = Number(row.counter_count || 0) ? Number(row.assigned_staff || 0) / Number(row.counter_count || 1) : 0;
      const waitScore = normalizeScore(row.avg_wait_minutes, maxWait, false);
      const completionScore = completionRate * 100;
      const noShowScore = (1 - noShowRate) * 100;
      const throughputScore = normalizeScore(totalVisits, maxVisits, true);
      const staffUtilizationScore = utilizationScore(utilization);
      const managerScore = (
        waitScore * 0.30 +
        completionScore * 0.25 +
        noShowScore * 0.20 +
        throughputScore * 0.15 +
        staffUtilizationScore * 0.10
      );
      return {
        ...row,
        total_visits: totalVisits,
        completed_count: completed,
        no_show_count: noShows,
        completion_rate: Math.round(completionRate * 1000) / 10,
        no_show_rate: Math.round(noShowRate * 1000) / 10,
        staff_utilization: Math.round(utilization * 1000) / 10,
        manager_score: Math.round(managerScore * 10) / 10,
      };
    }).sort((a, b) => b.manager_score - a.manager_score)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    res.json(scored);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch manager performance.' });
  }
});

// Hourly heatmap
router.get('/heatmap', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['w.business_id = ?', 'w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)'];
    const params = [scopedBusinessId(req, business_id)];
    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBranch) { conditions.push('w.branch_id = ?'); params.push(scopedBranch); }

    const [rows] = await pool.query(
      `SELECT w.day_of_week AS dow,
              w.hour_of_day AS hour,
              COUNT(*)                              AS visit_count,
              ROUND(AVG(w.wait_time_minutes), 1)   AS avg_wait,
              SUM(w.status = 'served')              AS completed,
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
router.get('/services', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['w.business_id = ?'];
    const params = [scopedBusinessId(req, business_id)];
    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBranch) { conditions.push('w.branch_id = ?'); params.push(scopedBranch); }

    const [rows] = await pool.query(
      `SELECT s.id AS service_id, s.name AS service_name,
              COUNT(*)                              AS total_visits,
              SUM(w.status = 'served')              AS completed,
              SUM(w.status = 'cancelled')           AS cancelled,
              SUM(w.status = 'no_show')             AS no_shows,
              ROUND(AVG(w.wait_time_minutes), 1)    AS avg_wait_minutes,
              ROUND(AVG(w.service_time_minutes), 1) AS avg_service_minutes,
              ROUND(SUM(w.status != 'served') / COUNT(*) * 100, 1) AS dropoff_pct
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
router.get('/staff', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });

    const conditions = ['st.business_id = ?', "t.status = 'served'"];
    const params = [scopedBusinessId(req, business_id)];
    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBranch) { conditions.push('st.branch_id = ?'); params.push(scopedBranch); }

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

// Branch performance trends — daily aggregates for line charts
router.get('/branch-trends', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), requireBranchAccess, async (req, res) => {
  try {
    const { business_id, branch_id, days = 90 } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });
    const safeDays = Math.min(Math.max(parseInt(days) || 90, 7), 365);
    const conditions = ['w.business_id = ?', `w.visit_date >= DATE_SUB(CURDATE(), INTERVAL ${safeDays} DAY)`];
    const params = [scopedBusinessId(req, business_id)];
    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBranch) { conditions.push('w.branch_id = ?'); params.push(scopedBranch); }
    const [rows] = await pool.query(
      `SELECT b.id AS branch_id, b.name AS branch_name, biz.name AS business_name,
              w.visit_date,
              COUNT(*)                              AS total_visits,
              ROUND(AVG(w.wait_time_minutes), 1)   AS avg_wait_minutes,
              SUM(w.status = 'served')              AS completed,
              SUM(w.status = 'no_show')             AS no_shows,
              ROUND(SUM(w.status = 'served') / COUNT(*) * 100, 1) AS completion_rate
       FROM wait_time_records w
       JOIN branches b     ON w.branch_id   = b.id
       JOIN businesses biz ON w.business_id = biz.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY b.id, b.name, biz.name, w.visit_date
       ORDER BY w.visit_date ASC, b.name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branch trends.' });
  }
});

// CSV export — returns wait_time_records as CSV for the Jupyter model
router.get('/export-csv', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess(), async (req, res) => {
  try {
    const { business_id, from, to } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });
    const conditions = ['w.business_id = ?'];
    const params = [scopedBusinessId(req, business_id)];
    if (from) { conditions.push('w.visit_date >= ?'); params.push(from); }
    if (to)   { conditions.push('w.visit_date <= ?'); params.push(to); }
    const [rows] = await pool.query(
      `SELECT w.id AS visit_id, w.ticket_id, t.ticket_number,
              w.business_id, biz.name AS business_name,
              w.branch_id,  b.name   AS branch_name, b.parish,
              w.service_id, s.name   AS service_name,
              w.visit_date, w.day_of_week AS dow, w.hour_of_day AS hour,
              w.month_of_year AS month,
              WEEKOFYEAR(w.visit_date) AS week_of_year,
              CASE WHEN DAYOFWEEK(w.visit_date) IN (1,7) THEN 1 ELSE 0 END AS is_weekend,
              0 AS is_holiday,
              w.wait_time_minutes, w.service_time_minutes, w.status,
              w.queue_length_at_time AS queue_length_at_join,
              w.staff_count_at_time, 1 AS active_counters
       FROM wait_time_records w
       JOIN businesses biz ON w.business_id = biz.id
       JOIN branches b     ON w.branch_id   = b.id
       JOIN services s     ON w.service_id  = s.id
       LEFT JOIN queue_tickets t ON w.ticket_id = t.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY w.visit_date, w.hour_of_day`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'No data found for the given filters.' });
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const v = r[h];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="queue_history_${business_id}.csv"`);
    res.send(csvLines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

// POST /api/analytics/refresh — manually trigger analytics summary rebuild (executive only)
router.post('/refresh', requireAuth, requireStaffRole('executive'), async (req, res) => {
  try {
    const { lookback_days = 7 } = req.body;
    const safeDays = Math.min(Math.max(parseInt(lookback_days) || 7, 1), 365);
    const { refreshAnalyticsSummaries } = require('../jobs/refreshAnalytics');
    const rowsAffected = await refreshAnalyticsSummaries(safeDays);
    res.json({ message: 'Analytics summaries refreshed.', rows_affected: rowsAffected, lookback_days: safeDays });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to refresh analytics.' });
  }
});

module.exports = router;
