-- =============================================================
-- Q ME NOW — CSV Export Queries for Jupyter Predictive Model
-- Run these on the MySQL server to produce CSV input files.
-- =============================================================

USE qme_now;

-- -----------------------------------------------------------
-- 1. queue_history.csv
-- Full visit-level data for wait time and drop-off analysis.
-- -----------------------------------------------------------
SELECT
    w.id                    AS visit_id,
    w.ticket_id,
    w.business_id,
    b.slug                  AS branch_slug,
    s.name                  AS service_name,
    w.visit_date,
    w.day_of_week           AS dow,
    w.hour_of_day           AS hour,
    w.month_of_year         AS month,
    w.wait_time_minutes,
    w.service_time_minutes,
    w.status,
    w.staff_count_at_time,
    w.queue_length_at_time,
    w.active_counters_at_time
FROM wait_time_records w
JOIN branches b ON w.branch_id = b.id
JOIN services s ON w.service_id = s.id
INTO OUTFILE '/var/lib/mysql-files/queue_history.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';


-- -----------------------------------------------------------
-- 2. service_performance.csv
-- Aggregated per-service metrics for ranking and comparison.
-- -----------------------------------------------------------
SELECT
    s.id                                AS service_id,
    s.name                              AS service_name,
    biz.name                            AS business_name,
    COUNT(*)                            AS total_visits,
    SUM(w.status = 'completed')         AS completed,
    SUM(w.status = 'cancelled')         AS cancelled,
    SUM(w.status = 'no_show')           AS no_show,
    ROUND(AVG(w.wait_time_minutes), 2)  AS avg_wait_minutes,
    ROUND(AVG(w.service_time_minutes),2)AS avg_service_minutes
FROM wait_time_records w
JOIN services s   ON w.service_id  = s.id
JOIN businesses biz ON w.business_id = biz.id
GROUP BY s.id, s.name, biz.name
INTO OUTFILE '/var/lib/mysql-files/service_performance.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';


-- -----------------------------------------------------------
-- 3. branch_performance.csv
-- Daily branch-level aggregates for trend analysis.
-- -----------------------------------------------------------
SELECT
    b.id                                AS branch_id,
    b.name                              AS branch_name,
    biz.name                            AS business_name,
    w.visit_date,
    w.day_of_week                       AS dow,
    w.month_of_year                     AS month,
    COUNT(*)                            AS total_visits,
    ROUND(AVG(w.wait_time_minutes), 2)  AS avg_wait_minutes,
    SUM(w.status = 'completed')         AS completed,
    SUM(w.status = 'no_show')           AS no_shows
FROM wait_time_records w
JOIN branches b     ON w.branch_id   = b.id
JOIN businesses biz ON w.business_id = biz.id
GROUP BY b.id, b.name, biz.name, w.visit_date, w.day_of_week, w.month_of_year
INTO OUTFILE '/var/lib/mysql-files/branch_performance.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';


-- -----------------------------------------------------------
-- 4. staff_activity.csv
-- Per-staff service counts and average handling time.
-- -----------------------------------------------------------
SELECT
    st.id                               AS staff_id,
    st.full_name                        AS staff_name,
    st.staff_code,
    s.name                              AS service_name,
    COUNT(t.id)                         AS tickets_handled,
    ROUND(AVG(
        TIMESTAMPDIFF(MINUTE, t.started_serving_at, t.completed_at)
    ), 2)                               AS avg_handle_minutes
FROM queue_tickets t
JOIN staff st  ON t.served_by_staff_id = st.id
JOIN queues q  ON t.queue_id           = q.id
JOIN services s ON q.service_id        = s.id
WHERE t.status = 'completed'
  AND t.started_serving_at IS NOT NULL
  AND t.completed_at IS NOT NULL
GROUP BY st.id, st.full_name, st.staff_code, s.name
INTO OUTFILE '/var/lib/mysql-files/staff_activity.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';


-- -----------------------------------------------------------
-- 5. prediction_inputs.csv
-- Full feature set for the ML model (matches Jupyter notebook schema).
-- -----------------------------------------------------------
SELECT
    t.id                                AS ticket_id,
    q.branch_id,
    q.service_id,
    q.id                                AS queue_id,
    t.joined_at                         AS customer_joined_at,
    t.started_serving_at                AS service_started_at,
    t.completed_at                      AS service_completed_at,
    TIMESTAMPDIFF(MINUTE, t.joined_at, t.started_serving_at)
                                        AS wait_minutes,
    TIMESTAMPDIFF(MINUTE, t.started_serving_at, t.completed_at)
                                        AS service_duration_minutes,
    w.queue_length_at_time,
    w.staff_count_at_time               AS active_staff_count,
    t.status                            AS ticket_status,
    DAYOFWEEK(t.joined_at) - 1          AS day_of_week,
    HOUR(t.joined_at)                   AS hour_of_day,
    MONTH(t.joined_at)                  AS month
FROM queue_tickets t
JOIN queues q ON t.queue_id = q.id
LEFT JOIN wait_time_records w ON w.ticket_id = t.id
WHERE t.status IN ('completed', 'cancelled', 'no_show')
INTO OUTFILE '/var/lib/mysql-files/prediction_inputs.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';
