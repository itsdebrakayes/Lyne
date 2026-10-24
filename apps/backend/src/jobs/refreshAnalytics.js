/**
 * refreshAnalytics.js — Populates analytics_summaries from wait_time_records.
 *
 * Runs daily at 01:00 (scheduled from index.js) and can also be triggered
 * manually via POST /api/analytics/refresh (executive only).
 *
 * What it computes per (business, branch, date):
 *   total_visitors, completed_count, no_show_count, left_count,
 *   avg_wait_minutes, avg_service_minutes, peak_hour, completion_rate
 */

const pool = require('../db/pool');

// One branch-level (service_id = NULL) row per (business, branch, date). Column
// names must match the analytics_summaries schema exactly — avg_wait_time_minutes
// / avg_service_time_minutes, NOT avg_wait_minutes.
const insertSql = (bizClause) => `
  INSERT INTO analytics_summaries
    (id, business_id, branch_id, service_id, summary_date,
     total_visitors, completed_count, cancelled_count, no_show_count, left_count,
     avg_wait_time_minutes, avg_service_time_minutes, peak_hour, completion_rate,
     updated_at)
  SELECT
    UUID(), w.business_id, w.branch_id, NULL, w.visit_date,
    COUNT(*),
    SUM(w.status = 'served'),
    SUM(w.status = 'cancelled'),
    SUM(w.status = 'no_show'),
    SUM(w.status = 'left'),
    ROUND(AVG(w.wait_time_minutes), 2),
    ROUND(AVG(w.service_time_minutes), 2),
    (
      SELECT h.hour_of_day
      FROM wait_time_records h
      WHERE h.business_id = w.business_id
        AND h.branch_id   = w.branch_id
        AND h.visit_date  = w.visit_date
      GROUP BY h.hour_of_day
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    ROUND(SUM(w.status = 'served') / COUNT(*) * 100, 2),
    NOW()
  FROM wait_time_records w
  WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    AND w.visit_date <  CURDATE()${bizClause}
  GROUP BY w.business_id, w.branch_id, w.visit_date
`;

/**
 * Refresh analytics summaries for the trailing window.
 * Delete-then-insert the window so a re-run is idempotent (no reliance on a
 * fragile ON DUPLICATE KEY / partial unique index).
 * @param {number} lookbackDays — how many days back to recalculate (default 7)
 * @param {{ businessId?: string }} [scope] — one organisation only. The nightly
 *   job passes nothing; a demo history loader passes its own organisation so a
 *   long backfill never touches anybody else's rows.
 */
async function refreshAnalyticsSummaries(lookbackDays = 7, { businessId } = {}) {
  const start = Date.now();
  console.log(`[Analytics] Refreshing summaries (last ${lookbackDays} days) …`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const bizClause = businessId ? ' AND business_id = ?' : '';
    await conn.query(
      `DELETE FROM analytics_summaries
       WHERE summary_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND summary_date < CURDATE()${bizClause}`,
      businessId ? [lookbackDays, businessId] : [lookbackDays]
    );
    const [result] = await conn.query(insertSql(businessId ? ' AND w.business_id = ?' : ''),
      businessId ? [lookbackDays, businessId] : [lookbackDays]);
    await conn.commit();
    const elapsed = Date.now() - start;
    console.log(`[Analytics] Done — ${result.affectedRows} rows rebuilt in ${elapsed}ms`);
    return result.affectedRows;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { refreshAnalyticsSummaries };
