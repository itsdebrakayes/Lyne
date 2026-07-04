"""
import_predictions.py — Push Jupyter model outputs to MySQL via the backend API.

Usage:
    python scripts/import_predictions.py [--business-id UUID] [--dry-run]

Reads credentials from .env in the model directory.
Reads JSON files from outputs/ and POSTs them to POST /api/predictions.

Authentication:
    The import script authenticates as an executive staff account using Supabase
    credentials stored in .env (PIPELINE_EMAIL + PIPELINE_PASSWORD).
    A dedicated "pipeline" executive account should be created in the system for this purpose.
"""

import os
import csv
import json
import argparse
import sys
from collections import defaultdict
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

API_URL      = os.getenv('API_URL', 'http://localhost:4000/api')
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')

# Dedicated pipeline executive account credentials
PIPELINE_EMAIL    = os.getenv('PIPELINE_EMAIL', '')
PIPELINE_PASSWORD = os.getenv('PIPELINE_PASSWORD', '')

OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'outputs')

# Map output file → insight_type for each business
# Add entries here as pilot contracts are signed.
# business_id is read from .env to keep it out of source code.
def build_manifest(business_id: str) -> list:
    del business_id
    return []


def get_supabase_token(email: str, password: str) -> str:
    """Authenticate with Supabase and return a JWT access token."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env')

    resp = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_ANON_KEY,
        },
        json={'email': email, 'password': password},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data.get('access_token')
    if not token:
        raise RuntimeError(f'No access_token in Supabase response: {data}')
    return token


def load_json_insights(business_id: str, manifest: list) -> tuple[list, int]:
    insights = []
    skipped = 0
    for item in manifest:
        filepath = os.path.join(OUTPUTS_DIR, item['file'])
        if not os.path.exists(filepath):
            print(f'  [SKIP] {item["file"]} — not found')
            skipped += 1
            continue
        with open(filepath, encoding='utf-8') as f:
            data = json.load(f)
        insights.append({
            'business_id': business_id,
            'branch_id': item.get('branch_id'),
            'insight_type': item['insight_type'],
            'insight_data': data,
            'records_processed': data.get('records_processed', 0) if isinstance(data, dict) else 0,
        })
    return insights, skipped


def load_dashboard_insights(business_id: str) -> list:
    """Structured model outputs from notebook 07 / scripts/generate_insights.py.

    These carry the chartable payloads the admin dashboards read directly
    (hourly wait forecast, per-service abandonment thresholds, model quality),
    so they take precedence over the coarser CSV-derived versions.
    """
    path = os.path.join(OUTPUTS_DIR, 'admin', 'dashboard_insights.json')
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as handle:
        rows = json.load(handle)
    insights = [
        {
            'business_id': row['business_id'],
            'insight_type': row['insight_type'],
            'insight_data': row.get('insight_data') or {},
        }
        for row in rows
        if not business_id or row.get('business_id') == business_id
    ]
    if insights:
        print(f'  [OK] outputs/admin/dashboard_insights.json → {len(insights)} insight(s)')
    return insights


def load_csv_fallback(business_id: str) -> list:
    csv_path = os.path.join(os.path.dirname(__file__), '..', 'data_exports', 'predictions_output.csv')
    if not os.path.exists(csv_path):
        return []
    insights = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if business_id and row.get('business_id') and row['business_id'] != business_id:
                continue
            insight_data = row.get('insight_data') or '{}'
            try:
                insight_data = json.loads(insight_data)
            except json.JSONDecodeError:
                insight_data = {'raw': insight_data}
            insights.append({
                'business_id': business_id or row.get('business_id'),
                'branch_id': row.get('branch_id') or None,
                'insight_type': row.get('recommendation_type') or row.get('insight_type'),
                'insight_data': insight_data,
                'generated_at': row.get('generated_at') or None,
            })
    if insights:
        print(f'  [OK] data_exports/predictions_output.csv → {len(insights)} insight(s)')

    def read_rows(filename):
        path = os.path.join(os.path.dirname(__file__), '..', 'data_exports', filename)
        if not os.path.exists(path):
            return []
        with open(path, newline='', encoding='utf-8') as handle:
            return list(csv.DictReader(handle))

    generated_at = datetime.now(timezone.utc).isoformat()
    branch_rows = read_rows('branch_performance_summary.csv')
    for row in branch_rows:
        insights.append({
            'business_id': business_id,
            'branch_id': row.get('branch_id') or None,
            'insight_type': 'branch_performance',
            'insight_data': row,
            'generated_at': generated_at,
        })

    service_rows = read_rows('service_performance_summary.csv') or read_rows('service_performance.csv')
    for row in service_rows:
        insights.append({
            'business_id': business_id,
            'service_id': row.get('service_id') or None,
            'insight_type': 'service_performance',
            'insight_data': row,
            'generated_at': generated_at,
        })

    staff_rows = read_rows('staff_activity.csv')
    if staff_rows:
        insights.append({
            'business_id': business_id,
            'insight_type': 'staff_metrics',
            'insight_data': {'staff': staff_rows},
            'generated_at': generated_at,
        })

    manager_rows = read_rows('manager_performance_summary.csv')
    if manager_rows:
        insights.append({
            'business_id': business_id,
            'insight_type': 'manager_performance',
            'insight_data': {
                'weights': {
                    'wait_time': 0.30,
                    'completion_rate': 0.25,
                    'no_show_rate': 0.20,
                    'throughput': 0.15,
                    'staff_utilization': 0.10,
                },
                'managers': manager_rows,
            },
            'records_processed': len(manager_rows),
            'generated_at': generated_at,
        })

    history = read_rows('queue_history.csv')
    if history:
        heatmap = defaultdict(lambda: {'visits': 0, 'wait_total': 0.0, 'wait_count': 0})
        status_counts = defaultdict(int)
        waits_by_service = defaultdict(list)
        for row in history:
            key = (row.get('dow'), row.get('hour'))
            heatmap[key]['visits'] += 1
            try:
                wait = float(row.get('wait_time_minutes') or 0)
                heatmap[key]['wait_total'] += wait
                heatmap[key]['wait_count'] += 1
                waits_by_service[row.get('service_id')].append(wait)
            except (TypeError, ValueError):
                pass
            status_counts[row.get('status') or 'unknown'] += 1

        heatmap_cells = [
            {
                'dow': int(dow),
                'hour': int(hour),
                'visit_count': values['visits'],
                'avg_wait_minutes': round(values['wait_total'] / max(values['wait_count'], 1), 2),
            }
            for (dow, hour), values in sorted(heatmap.items())
        ]
        insights.extend([
            {
                'business_id': business_id,
                'insight_type': 'heatmap_data',
                'insight_data': {'cells': heatmap_cells},
                'generated_at': generated_at,
            },
            {
                'business_id': business_id,
                'insight_type': 'ops_insights',
                'insight_data': {'records_processed': len(history), 'status_counts': dict(status_counts)},
                'records_processed': len(history),
                'generated_at': generated_at,
            },
            {
                'business_id': business_id,
                'insight_type': 'wait_time_predictions',
                'insight_data': {
                    'services': [
                        {'service_id': service_id, 'predicted_wait_minutes': round(sum(waits) / len(waits), 2)}
                        for service_id, waits in waits_by_service.items() if service_id and waits
                    ]
                },
                'generated_at': generated_at,
            },
        ])

        left_count = status_counts.get('left', 0) + status_counts.get('cancelled', 0)
        insights.append({
            'business_id': business_id,
            'insight_type': 'abandonment_thresholds',
            'insight_data': {
                'observed_abandonments': left_count,
                'abandonment_rate': round(left_count / max(len(history), 1), 4),
                'records_processed': len(history),
            },
            'generated_at': generated_at,
        })

    if branch_rows:
        recommendations = []
        for row in branch_rows:
            try:
                avg_wait = float(row.get('avg_wait') or row.get('avg_wait_minutes') or 0)
                if avg_wait >= 20:
                    recommendations.append({
                        'branch_id': row.get('branch_id'),
                        'message': 'Review staffing and counter allocation during peak periods.',
                        'avg_wait_minutes': avg_wait,
                    })
            except (TypeError, ValueError):
                continue
        insights.append({
            'business_id': business_id,
            'insight_type': 'resource_recommendations',
            'insight_data': {'recommendations': recommendations},
            'generated_at': generated_at,
        })

    return insights


def push_pipeline_import(token: str, business_id: str, insights: list,
                         model_version: str = None, dry_run: bool = False) -> dict:
    payload = {
        'business_id': business_id,
        'model_version': model_version,
        'records_exported': sum(int(item.get('records_processed') or 0) for item in insights),
        'insights': [
            {
                'branch_id': item.get('branch_id'),
                'service_id': item.get('service_id'),
                'insight_type': item['insight_type'],
                'insight_data': item.get('insight_data') or {},
                'records_processed': item.get('records_processed') or 0,
                'generated_at': item.get('generated_at'),
                'stale_after': item.get('stale_after'),
            }
            for item in insights
            if item.get('insight_type')
        ],
    }
    if dry_run:
        print(f'    [DRY-RUN] Would POST {len(payload["insights"])} insight(s) to /pipeline/import')
        return {'id': 'dry-run', 'imported': len(payload['insights'])}

    resp = requests.post(
        f'{API_URL}/pipeline/import',
        headers={
          'Content-Type':  'application/json',
          'Authorization': f'Bearer {token}',
        },
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description='Import ML predictions into QMe Now backend')
    parser.add_argument('--business-id', type=str, default=None,
                        help='Override business_id (default: reads BUSINESS_ID from .env)')
    parser.add_argument('--model-version', type=str, default=None,
                        help='Model version string to tag results (e.g. "v1.2")')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print what would be imported without sending any requests')
    args = parser.parse_args()

    business_id = args.business_id or os.getenv('PIPELINE_BUSINESS_ID', '')
    if not business_id:
        print('[ERROR] No business_id provided. Set PIPELINE_BUSINESS_ID in .env or pass --business-id.')
        sys.exit(1)

    print('Q ME NOW — Import Predictions')
    print(f'API          : {API_URL}')
    print(f'Business ID  : {business_id}')
    print(f'Model version: {args.model_version or "unset"}')
    print(f'Dry run      : {args.dry_run}')
    print()

    # Authenticate
    if not args.dry_run:
        if not PIPELINE_EMAIL or not PIPELINE_PASSWORD:
            print('[ERROR] PIPELINE_EMAIL and PIPELINE_PASSWORD must be set in .env')
            sys.exit(1)
        print(f'Authenticating as {PIPELINE_EMAIL} …')
        try:
            token = get_supabase_token(PIPELINE_EMAIL, PIPELINE_PASSWORD)
            print('Authenticated.\n')
        except Exception as e:
            print(f'[ERROR] Authentication failed: {e}')
            sys.exit(1)
    else:
        token = 'dry-run-token'

    manifest = build_manifest(business_id)
    insights, skipped = load_json_insights(business_id, manifest)
    if not insights:
        insights = load_csv_fallback(business_id)

    # Model-generated dashboard insights replace the coarser CSV-derived versions.
    dashboard_insights = load_dashboard_insights(business_id)
    if dashboard_insights:
        replaced_types = {row['insight_type'] for row in dashboard_insights}
        insights = [row for row in insights if row['insight_type'] not in replaced_types]
        insights.extend(dashboard_insights)

    if not insights:
        print(f'\nDone. 0 imported, {skipped} skipped, 0 errors.')
        sys.exit(0)

    try:
        result = push_pipeline_import(
            token,
            business_id,
            insights,
            model_version=args.model_version,
            dry_run=args.dry_run,
        )
        print(f'  [OK] pipeline import complete: {result.get("imported", len(insights))} insight(s)')
        print(f'\nDone. {len(insights)} imported, {skipped} skipped, 0 errors.')
    except requests.HTTPError as e:
        print(f'  [ERR] pipeline import — HTTP {e.response.status_code}: {e.response.text[:300]}')
        print(f'\nDone. 0 imported, {skipped} skipped, 1 errors.')
        sys.exit(1)
    except Exception as e:
        print(f'  [ERR] pipeline import — {e}')
        print(f'\nDone. 0 imported, {skipped} skipped, 1 errors.')
        sys.exit(1)


if __name__ == '__main__':
    main()
