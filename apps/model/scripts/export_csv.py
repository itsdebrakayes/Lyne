"""Export tenant-scoped MySQL operations data for the production model notebook."""

import argparse
import csv
import os
from datetime import datetime, timedelta
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'user': os.getenv('MYSQL_USER', 'qmenow'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'qme_now'),
}
OUTPUT_DIR = BASE_DIR / 'data_exports'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

QUEUE_HISTORY_QUERY = """
SELECT
    w.id AS visit_id, w.ticket_id, COALESCE(t.ticket_number, w.ticket_id) AS ticket_number,
    w.business_id, biz.name AS business_name,
    w.branch_id, b.name AS branch_name, b.parish,
    w.service_id, s.name AS service_name,
    w.visit_date, w.day_of_week AS dow, w.hour_of_day AS hour,
    w.month_of_year AS month, WEEKOFYEAR(w.visit_date) AS week_of_year,
    CASE WHEN DAYOFWEEK(w.visit_date) IN (1, 7) THEN 1 ELSE 0 END AS is_weekend,
    0 AS is_holiday, w.wait_time_minutes, w.service_time_minutes,
    CASE WHEN w.status = 'served' THEN 'completed'
         WHEN w.status = 'in_service' THEN 'serving'
         ELSE w.status END AS status,
    w.queue_length_at_time AS queue_length_at_join,
    w.staff_count_at_time, w.active_counters_at_time AS active_counters
FROM wait_time_records w
LEFT JOIN queue_tickets t ON t.id = w.ticket_id
JOIN businesses biz ON biz.id = w.business_id
JOIN branches b ON b.id = w.branch_id
JOIN services s ON s.id = w.service_id
WHERE w.visit_date BETWEEN %s AND %s AND w.business_id = %s
ORDER BY w.visit_date, w.hour_of_day
"""

SERVICE_PERFORMANCE_QUERY = """
SELECT
    s.id AS service_id, s.name AS service_name,
    biz.id AS business_id, biz.name AS business_name,
    COUNT(w.id) AS total_visits,
    SUM(w.status = 'served') AS completed,
    SUM(w.status IN ('cancelled', 'left')) AS cancelled,
    SUM(w.status = 'no_show') AS no_show,
    ROUND(SUM(w.status = 'served') / NULLIF(COUNT(w.id), 0), 4) AS completion_rate,
    ROUND(AVG(w.wait_time_minutes), 2) AS avg_wait_minutes,
    ROUND(AVG(w.service_time_minutes), 2) AS avg_service_minutes,
    ROUND(AVG(w.wait_time_minutes), 2) AS p50_wait_minutes,
    ROUND(AVG(w.wait_time_minutes) + 1.282 * STDDEV_POP(w.wait_time_minutes), 2) AS p90_wait_minutes
FROM wait_time_records w
JOIN services s ON s.id = w.service_id
JOIN businesses biz ON biz.id = w.business_id
WHERE w.visit_date BETWEEN %s AND %s AND w.business_id = %s
GROUP BY s.id, s.name, biz.id, biz.name
ORDER BY s.name
"""

BRANCH_PERFORMANCE_QUERY = """
SELECT
    b.id AS branch_id, b.name AS branch_name,
    biz.id AS business_id, biz.name AS business_name,
    w.visit_date, w.day_of_week AS dow, w.month_of_year AS month,
    WEEKOFYEAR(w.visit_date) AS week_of_year,
    COUNT(w.id) AS total_visits,
    ROUND(AVG(w.wait_time_minutes), 2) AS avg_wait_minutes,
    SUM(w.status = 'served') AS completed,
    SUM(w.status = 'no_show') AS no_shows,
    ROUND(AVG(w.queue_length_at_time), 1) AS avg_queue_len,
    ROUND(AVG(w.staff_count_at_time), 1) AS avg_staff
FROM wait_time_records w
JOIN branches b ON b.id = w.branch_id
JOIN businesses biz ON biz.id = w.business_id
WHERE w.visit_date BETWEEN %s AND %s AND w.business_id = %s
GROUP BY b.id, b.name, biz.id, biz.name, w.visit_date, w.day_of_week, w.month_of_year
ORDER BY w.visit_date, b.name
"""

STAFF_ACTIVITY_QUERY = """
SELECT
    st.id AS staff_id, st.staff_code, st.full_name AS staff_name,
    st.business_id, st.branch_id, b.name AS branch_name,
    COUNT(t.id) AS tickets_handled,
    ROUND(AVG(TIMESTAMPDIFF(MINUTE, t.started_serving_at, t.completed_at)), 2) AS avg_service_time_minutes,
    SUM(t.status = 'served') AS completed_count,
    SUM(t.status = 'no_show') AS no_show_count
FROM staff st
LEFT JOIN branches b ON b.id = st.branch_id
LEFT JOIN queue_tickets t ON t.served_by_staff_id = st.id
  AND DATE(t.joined_at) BETWEEN %s AND %s
WHERE st.business_id = %s
GROUP BY st.id, st.staff_code, st.full_name, st.business_id, st.branch_id, b.name
ORDER BY st.full_name
"""

QUEUE_EVENTS_QUERY = """
SELECT e.id, e.ticket_id, t.queue_id, q.branch_id, q.service_id,
       b.business_id, e.previous_status, e.new_status, e.event_timestamp
FROM queue_events e
JOIN queue_tickets t ON t.id = e.ticket_id
JOIN queues q ON q.id = t.queue_id
JOIN branches b ON b.id = q.branch_id
WHERE DATE(e.event_timestamp) BETWEEN %s AND %s AND b.business_id = %s
ORDER BY e.event_timestamp
"""

MANAGER_PERFORMANCE_QUERY = """
SELECT
    mgr.id AS manager_id,
    mgr.full_name AS manager_name,
    mgr.staff_code,
    mgr.business_id,
    br.id AS branch_id,
    br.name AS branch_name,
    COUNT(w.id) AS total_visits,
    SUM(w.status = 'served') AS completed_count,
    SUM(w.status = 'no_show') AS no_show_count,
    ROUND(AVG(w.wait_time_minutes), 2) AS avg_wait_minutes,
    ROUND(AVG(w.service_time_minutes), 2) AS avg_service_minutes,
    COALESCE(assignments.assigned_staff, 0) AS assigned_staff,
    COALESCE(counters.counter_count, 0) AS counter_count
FROM staff mgr
JOIN roles r ON r.id = mgr.role_id AND r.name = 'manager'
LEFT JOIN branches br ON br.id = mgr.branch_id
LEFT JOIN wait_time_records w
  ON w.branch_id = br.id AND w.business_id = mgr.business_id AND w.visit_date BETWEEN %s AND %s
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
WHERE mgr.business_id = %s AND mgr.is_active = TRUE
GROUP BY mgr.id, mgr.full_name, mgr.staff_code, mgr.business_id, br.id, br.name,
         assignments.assigned_staff, counters.counter_count
ORDER BY mgr.full_name
"""

EXPORTS = (
    ('queue_history.csv', QUEUE_HISTORY_QUERY),
    ('service_performance.csv', SERVICE_PERFORMANCE_QUERY),
    ('branch_performance.csv', BRANCH_PERFORMANCE_QUERY),
    ('staff_activity.csv', STAFF_ACTIVITY_QUERY),
    ('queue_events.csv', QUEUE_EVENTS_QUERY),
    ('manager_performance_input.csv', MANAGER_PERFORMANCE_QUERY),
)


def export_query(connection, filename, query, params):
    cursor = connection.cursor(dictionary=True)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    cursor.close()

    path = OUTPUT_DIR / filename
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    print(f'  {filename}: {len(rows):,} row(s)')
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description='Export one company data set for QMe Now analytics')
    parser.add_argument('--days', type=int, default=90)
    parser.add_argument('--business-id', required=True)
    args = parser.parse_args()

    end = datetime.now().date()
    start = end - timedelta(days=max(1, args.days))
    params = [start.isoformat(), end.isoformat(), args.business_id]

    print(f'Exporting {args.business_id} from {start} through {end}')
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        counts = {
            filename: export_query(connection, filename, query, params)
            for filename, query in EXPORTS
        }
    finally:
        connection.close()

    if counts['queue_history.csv'] == 0:
        print('No completed operational records are available yet; dashboards should remain in their empty state.')


if __name__ == '__main__':
    main()
