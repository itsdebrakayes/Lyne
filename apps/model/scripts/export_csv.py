"""
export_csv.py — Export MySQL tables to CSV for the Jupyter predictive model.

Usage:
    python scripts/export_csv.py [--days N] [--business-id UUID]

Reads credentials from .env in the model directory.
Writes CSV files to data_exports/.

Column mapping against actual MySQL schema (wait_time_records):
    id, ticket_id, business_id, branch_id, service_id,
    visit_date, day_of_week, hour_of_day, month_of_year,
    wait_time_minutes, service_time_minutes, status,
    staff_count_at_time, queue_length_at_time, active_counters_at_time
"""

import os
import csv
import argparse
import mysql.connector
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

DB_CONFIG = {
    'host':     os.getenv('MYSQL_HOST', 'localhost'),
    'port':     int(os.getenv('MYSQL_PORT', 3306)),
    'user':     os.getenv('MYSQL_USER', 'qmenow'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'qme_now'),
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data_exports')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── visit_history.csv ─────────────────────────────────────────
# One row per completed/left/cancelled ticket — the ML training set.
VISIT_HISTORY_QUERY = """
SELECT
    wtr.id                                                          AS record_id,
    wtr.ticket_id,
    qt.ticket_number,
    wtr.business_id,
    biz.name                                                        AS business_name,
    wtr.branch_id,
    br.name                                                         AS branch_name,
    br.parish,
    wtr.service_id,
    s.name                                                          AS service_name,
    wtr.visit_date,
    wtr.day_of_week                                                 AS dow,
    wtr.hour_of_day                                                 AS hour,
    wtr.month_of_year                                               AS month,
    WEEKOFYEAR(wtr.visit_date)                                      AS week_of_year,
    CASE WHEN DAYOFWEEK(wtr.visit_date) IN (1,7) THEN 1 ELSE 0 END AS is_weekend,
    0                                                               AS is_holiday,
    wtr.wait_time_minutes,
    wtr.service_time_minutes,
    wtr.status                                                      AS final_status,
    CASE WHEN wtr.status = 'cancelled' THEN 1 ELSE 0 END           AS was_no_show,
    CASE WHEN wtr.status = 'left'      THEN 1 ELSE 0 END           AS was_cancelled,
    wtr.queue_length_at_time                                        AS queue_length_at_join,
    wtr.staff_count_at_time,
    wtr.active_counters_at_time                                     AS active_counters,
    wtr.created_at
FROM wait_time_records wtr
JOIN businesses biz  ON biz.id  = wtr.business_id
JOIN branches   br   ON br.id   = wtr.branch_id
JOIN services   s    ON s.id    = wtr.service_id
LEFT JOIN queue_tickets qt ON qt.id = wtr.ticket_id
WHERE wtr.visit_date BETWEEN %s AND %s
{business_filter}
ORDER BY wtr.visit_date, wtr.hour_of_day
"""

# ── staff_activity.csv ────────────────────────────────────────
# One row per staff assignment day — used for staff performance model.
STAFF_ACTIVITY_QUERY = """
SELECT
    sa.id                                                           AS assignment_id,
    sa.staff_id,
    st.full_name                                                    AS staff_name,
    st.staff_code,
    st.business_id,
    br.id                                                           AS branch_id,
    br.name                                                         AS branch_name,
    sa.counter_id,
    c.counter_number,
    sa.assignment_date,
    DAYOFWEEK(sa.assignment_date) - 1                              AS dow,
    sa.shift_start,
    sa.shift_end,
    COUNT(qt.id)                                                    AS tickets_handled,
    ROUND(AVG(wtr.service_time_minutes), 2)                         AS avg_service_time_minutes,
    ROUND(AVG(wtr.wait_time_minutes), 2)                            AS avg_wait_time_minutes,
    SUM(CASE WHEN qt.status = 'served'     THEN 1 ELSE 0 END)      AS completed_count,
    SUM(CASE WHEN qt.status = 'cancelled'  THEN 1 ELSE 0 END)      AS no_show_count,
    SUM(CASE WHEN qt.status = 'left'       THEN 1 ELSE 0 END)      AS left_count
FROM staff_assignments sa
JOIN staff      st  ON st.id  = sa.staff_id
JOIN counters   c   ON c.id   = sa.counter_id
JOIN branches   br  ON br.id  = c.branch_id
LEFT JOIN queue_tickets qt
    ON qt.served_by_staff_id = sa.staff_id
    AND DATE(qt.started_serving_at) = sa.assignment_date
LEFT JOIN wait_time_records wtr ON wtr.ticket_id = qt.id
WHERE sa.assignment_date BETWEEN %s AND %s
{business_filter}
GROUP BY
    sa.id, sa.staff_id, st.full_name, st.staff_code, st.business_id,
    br.id, br.name, sa.counter_id, c.counter_number,
    sa.assignment_date, sa.shift_start, sa.shift_end
ORDER BY sa.assignment_date, st.full_name
"""


def export_query(conn, query, params, filename):
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()

    if not rows:
        print(f'  [WARN] No rows returned for {filename}')
        return 0

    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f'  [OK] {len(rows):,} rows → {filepath}')
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description='Export MySQL data for the Q ME NOW ML pipeline')
    parser.add_argument('--days',        type=int,   default=90,  help='Lookback window in days (default 90)')
    parser.add_argument('--business-id', type=str,   default=None, help='Filter to a single business_id')
    args = parser.parse_args()

    date_from = (datetime.now() - timedelta(days=args.days)).strftime('%Y-%m-%d')
    date_to   = datetime.now().strftime('%Y-%m-%d')

    biz_filter = ''
    biz_params = []
    if args.business_id:
        biz_filter = 'AND wtr.business_id = %s'
        biz_params = [args.business_id]

    print(f'Q ME NOW — MySQL CSV Export')
    print(f'Period  : {date_from} → {date_to}')
    print(f'Business: {args.business_id or "ALL"}')
    print(f'DB      : {DB_CONFIG["host"]}:{DB_CONFIG["port"]} / {DB_CONFIG["database"]}')
    print()

    conn = mysql.connector.connect(**DB_CONFIG)
    print('Connected.\n')

    print('Exporting visit_history.csv …')
    visit_query = VISIT_HISTORY_QUERY.format(business_filter=biz_filter.replace('wtr.business_id', 'wtr.business_id'))
    export_query(conn, visit_query, [date_from, date_to] + biz_params, 'visit_history.csv')

    print('Exporting staff_activity.csv …')
    staff_biz_filter = biz_filter.replace('wtr.business_id', 'st.business_id')
    staff_query = STAFF_ACTIVITY_QUERY.format(business_filter=staff_biz_filter)
    export_query(conn, staff_query, [date_from, date_to] + biz_params, 'staff_activity.csv')

    conn.close()
    print('\nExport complete. Files saved to data_exports/')
    print('Next step: run the Jupyter notebooks, then python scripts/import_predictions.py')


if __name__ == '__main__':
    main()
