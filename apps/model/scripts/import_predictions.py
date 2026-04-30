"""
import_predictions.py — Push Jupyter model outputs to MySQL via the backend API.

Usage:
    python scripts/import_predictions.py

Reads credentials from .env in the same directory.
Reads JSON files from outputs/ and POSTs them to the backend API.
"""

import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

API_URL    = os.getenv('API_URL', 'http://localhost:4000/api')
API_TOKEN  = os.getenv('API_SERVICE_TOKEN', '')   # A long-lived service token for the backend
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'outputs')

# Map output file paths to their insight_type and business_id
# Edit this list to match your actual output files and business IDs
IMPORT_MANIFEST = [
    {
        'file':         'admin/ops_insights.json',
        'insight_type': 'ops_insights',
        'business_id':  os.getenv('BUSINESS_ID_TAJ', ''),
    },
    {
        'file':         'admin_staff/staff_metrics.json',
        'insight_type': 'staff_metrics',
        'business_id':  os.getenv('BUSINESS_ID_TAJ', ''),
    },
    {
        'file':         'client/best_time_to_visit.json',
        'insight_type': 'best_time_to_visit',
        'business_id':  os.getenv('BUSINESS_ID_TAJ', ''),
    },
]


def push_prediction(business_id: str, insight_type: str, data: dict) -> dict:
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_TOKEN}',
    }
    payload = {
        'business_id':  business_id,
        'insight_type': insight_type,
        'insight_data': data,
    }
    resp = requests.post(f'{API_URL}/predictions', headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main():
    print('Q ME NOW — Import Predictions to MySQL')
    print(f'API: {API_URL}\n')

    for item in IMPORT_MANIFEST:
        filepath = os.path.join(OUTPUTS_DIR, item['file'])
        if not os.path.exists(filepath):
            print(f'  [SKIP] {item["file"]} — file not found')
            continue

        with open(filepath, encoding='utf-8') as f:
            data = json.load(f)

        if not item['business_id']:
            print(f'  [SKIP] {item["file"]} — business_id not set in .env')
            continue

        try:
            result = push_prediction(item['business_id'], item['insight_type'], data)
            print(f'  [OK]   {item["file"]} → {item["insight_type"]} (id: {result.get("id", "?")})')
        except requests.HTTPError as e:
            print(f'  [ERR]  {item["file"]} — HTTP {e.response.status_code}: {e.response.text}')
        except Exception as e:
            print(f'  [ERR]  {item["file"]} — {e}')

    print('\nImport complete.')


if __name__ == '__main__':
    main()
