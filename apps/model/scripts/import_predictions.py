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
import json
import argparse
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
    return [
        {
            'file':         'admin/ops_insights.json',
            'insight_type': 'ops_insights',
            'business_id':  business_id,
            'branch_id':    None,
        },
        {
            'file':         'admin_staff/staff_metrics.json',
            'insight_type': 'staff_metrics',
            'business_id':  business_id,
            'branch_id':    None,
        },
        {
            'file':         'client/best_time_to_visit.json',
            'insight_type': 'best_time_to_visit',
            'business_id':  business_id,
            'branch_id':    None,
        },
    ]


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


def push_prediction(token: str, business_id: str, branch_id, insight_type: str,
                    data: dict, model_version: str = None, dry_run: bool = False) -> dict:
    payload = {
        'business_id':   business_id,
        'insight_type':  insight_type,
        'insight_data':  data,
    }
    if branch_id:
        payload['branch_id'] = branch_id
    if model_version:
        payload['model_version'] = model_version

    if dry_run:
        print(f'    [DRY-RUN] Would POST {insight_type} for business {business_id}')
        return {'id': 'dry-run'}

    resp = requests.post(
        f'{API_URL}/predictions',
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
        return

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
            return
        print(f'Authenticating as {PIPELINE_EMAIL} …')
        try:
            token = get_supabase_token(PIPELINE_EMAIL, PIPELINE_PASSWORD)
            print('Authenticated.\n')
        except Exception as e:
            print(f'[ERROR] Authentication failed: {e}')
            return
    else:
        token = 'dry-run-token'

    manifest = build_manifest(business_id)
    success  = 0
    skipped  = 0
    errors   = 0

    for item in manifest:
        filepath = os.path.join(OUTPUTS_DIR, item['file'])
        if not os.path.exists(filepath):
            print(f'  [SKIP] {item["file"]} — not found')
            skipped += 1
            continue

        with open(filepath, encoding='utf-8') as f:
            data = json.load(f)

        model_ver = args.model_version or data.get('model_info', {}).get('version')

        try:
            result = push_prediction(
                token, item['business_id'], item.get('branch_id'),
                item['insight_type'], data,
                model_version=model_ver, dry_run=args.dry_run
            )
            print(f'  [OK] {item["file"]} → {item["insight_type"]} (id: {result.get("id", "?")})')
            success += 1
        except requests.HTTPError as e:
            print(f'  [ERR] {item["file"]} — HTTP {e.response.status_code}: {e.response.text[:200]}')
            errors += 1
        except Exception as e:
            print(f'  [ERR] {item["file"]} — {e}')
            errors += 1

    print(f'\nDone. {success} imported, {skipped} skipped, {errors} errors.')


if __name__ == '__main__':
    main()
