"""Run incremental analytics during business hours and a full refresh nightly."""

import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import mysql.connector

BASE_DIR = Path(__file__).resolve().parent.parent
BUSINESS_ID = os.environ.get('PIPELINE_BUSINESS_ID', '').strip()
TIMEZONE = ZoneInfo(os.environ.get('PIPELINE_TIMEZONE', 'America/Jamaica'))
DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', 'localhost'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'qmenow'),
    'password': os.environ.get('MYSQL_PASSWORD', ''),
    'database': os.environ.get('MYSQL_DATABASE', 'qme_now'),
}


def run_pipeline(days):
    command = [
        sys.executable,
        str(BASE_DIR / 'scripts' / 'run_pipeline.py'),
        '--business-id', BUSINESS_ID,
        '--days', str(days),
    ]
    result = subprocess.run(command, cwd=BASE_DIR, check=False)
    if result.returncode:
        print(f'Pipeline exited with code {result.returncode}', flush=True)
    return result.returncode


def process_manual_trigger():
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id FROM pipeline_runs WHERE business_id = %s AND status = 'queued' ORDER BY created_at LIMIT 1",
            [BUSINESS_ID],
        )
        run = cursor.fetchone()
        if not run:
            cursor.close()
            return
        cursor.execute("UPDATE pipeline_runs SET status = 'running', started_at = NOW() WHERE id = %s", [run['id']])
        connection.commit()
        return_code = run_pipeline(730)
        cursor.execute(
            "UPDATE pipeline_runs SET status = %s, completed_at = NOW(), error_message = %s WHERE id = %s",
            ['succeeded' if return_code == 0 else 'failed', None if return_code == 0 else 'Pipeline process exited unsuccessfully.', run['id']],
        )
        connection.commit()
        cursor.close()
    finally:
        connection.close()


def main():
    if not BUSINESS_ID:
        raise RuntimeError('PIPELINE_BUSINESS_ID is required')

    last_incremental = None
    last_nightly = None
    print(f'Analytics scheduler active for {BUSINESS_ID} ({TIMEZONE})', flush=True)

    while True:
        process_manual_trigger()
        now = datetime.now(TIMEZONE)
        date_key = now.date().isoformat()
        slot = f'{date_key}-{now.hour:02d}-{(now.minute // 30) * 30:02d}'
        during_business_hours = now.weekday() < 5 and 7 <= now.hour < 19

        if during_business_hours and (now.minute < 5 or 30 <= now.minute < 35) and last_incremental != slot:
            last_incremental = slot
            run_pipeline(90)

        if now.hour == 1 and now.minute < 5 and last_nightly != date_key:
            last_nightly = date_key
            run_pipeline(730)

        time.sleep(60)


if __name__ == '__main__':
    main()
