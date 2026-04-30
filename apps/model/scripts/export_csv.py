"""
export_csv.py — Export MySQL tables to CSV for the Jupyter predictive model.

Usage:
    python scripts/export_csv.py

Reads credentials from .env in the same directory.
Writes CSV files to data_exports/.
"""

import os
import csv
import mysql.connector
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host':     os.getenv('MYSQL_HOST', 'localhost'),
    'port':     int(os.getenv('MYSQL_PORT', 3306)),
    'user':     os.getenv('MYSQL_USER', 'qmenow'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'qmenow'),
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_exports')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Export the last 90 days by default
DATE_FROM = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
DATE_TO   = datetime.now().strftime('%Y-%m-%d')

VISIT_HISTORY_QUERY = """
SELECT
    wtr.id                                         AS record_id,
    wtr.ticket_id,
    wtr.business_id,
    b.name                                         AS business_name,
    wtr.branch_id,
    br.name                                        AS branch_name,
    wtr.service_id,
    s.name                                         AS service_name,
    wtr.queue_date,
    DAYOFWEEK(wtr.queue_date) - 1                  AS dow,
    HOUR(wtr.joined_at)                            AS hour_of_day,
    CASE WHEN DAYOFWEEK(wtr.queue_date) IN (1,7) THEN 1 ELSE 0 END AS is_weekend,
    wtr.wait_time_minutes,
    wtr.service_time_minutes,
    wtr.final_status,
    CASE WHEN wtr.final_status = 'no_show'   THEN 1 ELSE 0 END AS was_no_show,
    CASE WHEN wtr.final_status = 'cancelled' THEN 1 ELSE 0 END AS was_cancelled,
    wtr.staff_id,
    wtr.counter_id,
    wtr.joined_at,
    wtr.called_at,
    wtr.completed_at
FROM wait_time_records wtr
JOIN businesses b  ON b.id  = wtr.business_id
JOIN branches   br ON br.id = wtr.branch_id
JOIN services   s  ON s.id  = wtr.service_id
WHERE wtr.queue_date BETWEEN %s AND %s
ORDER BY wtr.joined_at
""";

STAFF_ACTIVITY_QUERY = """
SELECT
    sa.id                                          AS assignment_id,
    sa.staff_id,
    st.full_name                                   AS staff_name,
    st.staff_code,
    sa.business_id,
    sa.branch_id,
    sa.counter_id,
    sa.assignment_date,
    DAYOFWEEK(sa.assignment_date) - 1             AS dow,
    sa.shift_start,
    sa.shift_end,
    COUNT(qt.id)                                   AS tickets_handled,
    AVG(wtr.service_time_minutes)                  AS avg_service_time_minutes,
    AVG(wtr.wait_time_minutes)                     AS avg_wait_time_minutes,
    SUM(CASE WHEN qt.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN qt.status = 'no_show'   THEN 1 ELSE 0 END) AS no_show_count
FROM staff_assignments sa
JOIN staff          st  ON st.id  = sa.staff_id
LEFT JOIN queue_tickets qt  ON qt.counter_id = sa.counter_id
                           AND DATE(qt.joined_at) = sa.assignment_date
LEFT JOIN wait_time_records wtr ON wtr.ticket_id = qt.id
WHERE sa.assignment_date BETWEEN %s AND %s
GROUP BY sa.id, sa.staff_id, st.full_name, st.staff_code,
         sa.business_id, sa.branch_id, sa.counter_id,
         sa.assignment_date, sa.shift_start, sa.shift_end
ORDER BY sa.assignment_date
""";


def export_query(conn, query, params, filename):
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()

    if not rows:
        print(f"  [WARN] No rows returned for {filename}")
        return 0

    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"  [OK] Exported {len(rows):,} rows → {filepath}")
    return len(rows)


def main():
    print(f"Q ME NOW — MySQL CSV Export")
    print(f"Period: {DATE_FROM} to {DATE_TO}")
    print(f"Connecting to {DB_CONFIG['host']}:{DB_CONFIG['port']} / {DB_CONFIG['database']} …")

    conn = mysql.connector.connect(**DB_CONFIG)
    print("Connected.\n")

    print("Exporting visit_history.csv …")
    export_query(conn, VISIT_HISTORY_QUERY, (DATE_FROM, DATE_TO), 'visit_history.csv')

    print("Exporting staff_activity.csv …")
    export_query(conn, STAFF_ACTIVITY_QUERY, (DATE_FROM, DATE_TO), 'staff_activity.csv')

    conn.close()
    print("\nExport complete. Files saved to data_exports/")


if __name__ == '__main__':
    main()
