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

const UPSERT_SQL = `
  INSERT INTO analytics_summaries
    (id, business_id, branch_id, summary_date,
     total_visitors, completed_count, cancelled_count, no_show_count, left_count,
     avg_wait_minutes, avg_service_minutes, peak_hour, completion_rate,
     updated_at)
  SELECT
    UUID()                                                         AS id,
    w.business_id,
    w.branch_id,
    w.visit_date                                                   AS summary_date,
    COUNT(*)                                                       AS total_visitors,
    SUM(w.status = 'served')                                       AS completed_count,
    SUM(w.status = 'cancelled')                                    AS cancelled_count,
    SUM(w.status = 'no_show')                                      AS no_show_count,
    SUM(w.status = 'left')                                         AS left_count,
    ROUND(AVG(w.wait_time_minutes), 2)                             AS avg_wait_minutes,
    ROUND(AVG(w.service_time_minutes), 2)                          AS avg_service_minutes,
    (
      SELECT h.hour_of_day
      FROM wait_time_records h
      WHERE h.business_id = w.business_id
        AND h.branch_id   = w.branch_id
        AND h.visit_date  = w.visit_date
      GROUP BY h.hour_of_day
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )                                                              AS peak_hour,
    ROUND(SUM(w.status = 'served') / COUNT(*) * 100, 2)           AS completion_rate,
    NOW()                                                          AS updated_at
  FROM wait_time_records w
  WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    AND w.visit_date <  CURDATE()
  GROUP BY w.business_id, w.branch_id, w.visit_date
  ON DUPLICATE KEY UPDATE
    total_visitors      = VALUES(total_visitors),
    completed_count     = VALUES(completed_count),
    cancelled_count     = VALUES(cancelled_count),
    no_show_count       = VALUES(no_show_count),
    left_count          = VALUES(left_count),
    avg_wait_minutes    = VALUES(avg_wait_minutes),
    avg_service_minutes = VALUES(avg_service_minutes),
    peak_hour           = VALUES(peak_hour),
    completion_rate     = VALUES(completion_rate),
    updated_at          = NOW()
`;

/**
 * Refresh analytics summaries.
 * @param {number} lookbackDays — how many days back to recalculate (default 7)
 */
async function refreshAnalyticsSummaries(lookbackDays = 7) {
  const start = Date.now();
  console.log(`[Analytics] Refreshing summaries (last ${lookbackDays} days) …`);

  // analytics_summaries needs a unique key on (business_id, branch_id, summary_date)
  // to support ON DUPLICATE KEY UPDATE. Ensure the index exists.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uk_summary_biz_branch_date
    ON analytics_summaries (business_id, branch_id, summary_date)
  `).catch(() => {
    // Index may already exist — not fatal
  });

  const [result] = await pool.query(UPSERT_SQL, [lookbackDays]);
  const elapsed  = Date.now() - start;
  console.log(`[Analytics] Done — ${result.affectedRows} rows upserted in ${elapsed}ms`);
  return result.affectedRows;
}

module.exports = { refreshAnalyticsSummaries };
