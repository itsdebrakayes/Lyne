# Q ME NOW — Predictive Model (Jupyter)

This directory contains the Jupyter notebook pipeline for Q ME NOW's predictive analytics engine.
It reads from the **MySQL database** via CSV exports, trains models, and writes results back to the `predictive_results` table via the backend API.

> **Note:** This was previously connected to Supabase edge functions. It now uses the MySQL backend at `apps/backend`.
> Use `scripts/export_csv.py` to export data and `scripts/import_predictions.py` to write results back.

## Directory Structure

```
apps/model/
├── README.md                    # This file
├── notebooks/
│   ├── 01_data_health_and_ingest.ipynb
│   ├── 02_admin_ops_insights.ipynb
│   ├── 03_staff_performance_dashboard.ipynb
│   └── 04_client_best_time_subscription.ipynb
├── data_exports/                # Downloaded CSVs go here
├── outputs/
│   ├── admin/                   # Admin dashboard insights
│   ├── admin_staff/             # Staff performance metrics
│   └── client/                  # Client-facing predictions
├── state/                       # Notebook state files for incremental runs
└── utils/                       # Shared Python utilities
```

## Database Schema Reference

### Table: `visit_history`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| client_id | uuid | Client reference (nullable) |
| service_id | uuid | Service reference (nullable) |
| visit_date | date | Date of visit (YYYY-MM-DD) |
| day_of_week | integer | 0=Sunday, 1=Monday, ..., 6=Saturday |
| hour_of_day | integer | 0-23 |
| wait_time_minutes | integer | Time spent waiting (nullable) |
| service_time_minutes | integer | Time being served (nullable) |
| was_no_show | boolean | True if customer didn't show |
| was_cancelled | boolean | True if cancelled |
| created_at | timestamptz | Record creation time |

### Table: `lines` (Queue entries)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| client_id | uuid | Client reference |
| service_id | uuid | Service reference |
| branch_id | uuid | Branch reference (nullable) |
| ticket_number | text | Display ticket (e.g., "A001") |
| position | integer | Position in queue |
| status | text | 'waiting', 'serving', 'completed', 'cancelled', 'no_show' |
| estimated_wait_minutes | integer | Estimated wait (nullable) |
| actual_wait_minutes | integer | Actual wait (nullable) |
| notes | text | Staff notes (nullable) |
| joined_at | timestamptz | When customer joined queue |
| called_at | timestamptz | When customer was called (nullable) |
| started_serving_at | timestamptz | When service began (nullable) |
| completed_at | timestamptz | When service ended (nullable) |

### Table: `service_sessions`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| line_id | uuid | Queue entry reference |
| counter_id | uuid | Counter reference (nullable) |
| staff_user_id | uuid | Staff who served (nullable) |
| started_at | timestamptz | Service start time |
| completed_at | timestamptz | Service end time (nullable) |
| duration_minutes | integer | Service duration (nullable) |
| outcome | text | 'completed', 'transferred', etc. |
| notes | text | Session notes (nullable) |

### Table: `services`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| name | text | Service name |
| icon | text | Icon name (nullable) |
| color | text | Hex color (nullable) |
| base_avg_time_minutes | integer | Expected duration (nullable) |
| is_active | boolean | Active status |
| display_order | integer | Sort order (nullable) |

### Table: `counters`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| service_id | uuid | Service reference |
| counter_number | integer | Counter display number |
| is_active | boolean | Active status |

### Table: `staff_roles`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Auth user ID |
| organization_id | uuid | Organization reference |
| role | enum | 'staff', 'section_manager', 'manager', 'executive' |
| assigned_service_id | uuid | Service assignment (nullable) |
| assigned_section | text | Section name (nullable) |
| is_active | boolean | Active status |

---

## CSV Export Format

The edge function `export-table-data` transforms database data into these formats:

### visits.csv
```csv
visit_id,timestamp,dow,hour,is_weekend,service_id,service_name,branch_id,wait_time_minutes,service_time_minutes,status
```

Derived fields:
- `timestamp`: Combines `visit_date` + `hour_of_day`
- `is_weekend`: 1 if dow in [0,6], else 0
- `status`: Derived from `was_cancelled`/`was_no_show` flags

### queue_events.csv
```csv
event_id,visit_id,event_time,event_type,staff_id,counter_id,service_id
```

Event types reconstructed from timestamps:
- `joined_at` → `created`
- `called_at` → `called`
- `started_serving_at` → `serving`
- `completed_at` + status → `completed`, `cancelled`, or `no_show`

### staff_service_log.csv
```csv
session_id,visit_id,staff_id,service_id,counter_id,start_time,end_time,duration_minutes,outcome
```

### services.csv
```csv
service_id,service_name,organization_id,base_avg_time_minutes,is_active,display_order,color
```

### counters.csv
```csv
counter_id,organization_id,service_id,counter_number,is_active
```

---

## Fetching CSV Data

### Using the export script

```bash
cd apps/model
python scripts/export_csv.py
```

This connects to MySQL directly and writes `data_exports/visit_history.csv` and `data_exports/staff_activity.csv`.

Alternatively, run the SQL queries in `database/analytics_exports.sql` with MySQL Workbench.

### Using the backend API (alternative)

```bash
curl "http://localhost:4000/api/analytics/export?business_id=YOUR_BIZ_ID" \
  -H "Authorization: Bearer YOUR_JWT"
```

Response:
```json
{
  "success": true,
  "exports": {
    "visits": "visit_id,timestamp,...\n...",
    "queue_events": "event_id,visit_id,...\n...",
    ...
  },
  "period": { "from": "2025-12-01", "to": "2026-01-06" }
}
```

### In Python (for notebooks)

```python
import requests
import pandas as pd
from io import StringIO

SUPABASE_URL = "https://xghhumucsccbfmpdexsr.supabase.co"
SERVICE_KEY = "your-service-role-key"

def fetch_csv_data(org_id: str, date_from: str, date_to: str):
    response = requests.post(
        f"{SUPABASE_URL}/functions/v1/export-table-data",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SERVICE_KEY}"
        },
        json={
            "tables": ["visits", "queue_events", "staff_service_log", "services", "counters"],
            "organization_id": org_id,
            "date_from": date_from,
            "date_to": date_to
        }
    )
    data = response.json()
    
    # Convert to DataFrames
    dfs = {}
    for table, csv_string in data["exports"].items():
        dfs[table] = pd.read_csv(StringIO(csv_string))
    
    return dfs
```

---

## Expected JSON Output Schemas

### outputs/admin/ops_insights.json
```json
{
  "generated_at": "2026-01-06T12:00:00Z",
  "period": { "start": "2025-12-30", "end": "2026-01-05" },
  "peak_hours": {
    "heatmap": [
      { "dow": 1, "dow_name": "Monday", "hour": 9, "avg_traffic": 42.1 }
    ],
    "top_slots": [
      { "dow": 5, "dow_name": "Friday", "hour": 11, "avg_traffic": 88.2, "rank": 1 }
    ]
  },
  "dropoff_periods": {
    "by_hour": [
      { "hour": 15, "dropoff_count": 23, "dropoff_rate": 0.14 }
    ],
    "by_service": [
      { "service_id": "uuid", "service_name": "Documents", "dropoff_rate": 0.18 }
    ]
  },
  "best_times": {
    "recommended_slots": [
      { "dow": 2, "dow_name": "Tuesday", "hour": 8, "score": 92, "reason": "low traffic + short wait" }
    ]
  },
  "anomalies": [
    { "date": "2026-01-03", "metric": "total_arrivals", "value": 512, "expected": 380, "z_score": 2.6, "severity": "warning" }
  ],
  "service_usage": {
    "ranked": [
      { "service_id": "uuid", "service_name": "Documents", "total_visits": 1250, "percentage": 45.2, "rank": 1 }
    ]
  },
  "resource_efficiency": [
    { "service_id": "uuid", "service_name": "Documents", "utilization": 0.78, "status": "optimal" }
  ],
  "recommendations": [
    "Shift one counter from Service A to Service B between 10am-12pm on Fridays.",
    "Introduce SMS reminder at 2pm to reduce 3-4pm no-shows."
  ]
}
```

### outputs/admin_staff/staff_metrics.json
```json
{
  "generated_at": "2026-01-06T12:00:00Z",
  "period": { "start": "2025-12-30", "end": "2026-01-05" },
  "staff": [
    {
      "staff_user_id": "uuid",
      "customers_served": { "day": 18, "week": 92, "month": 341 },
      "avg_service_time_minutes": 5.2,
      "avg_wait_time_minutes": 10.8,
      "completion_rate": 0.98,
      "efficiency_score": 82.3,
      "rank": 1,
      "trend_weekly": [
        { "week": "2025-W50", "score": 78.1 },
        { "week": "2025-W51", "score": 80.2 }
      ]
    }
  ],
  "rankings": {
    "top_performers": ["uuid1", "uuid2", "uuid3"],
    "needs_support": ["uuid4", "uuid5"]
  }
}
```

### outputs/client/best_time_to_visit.json
```json
{
  "generated_at": "2026-01-06T12:00:00Z",
  "organization_id": "uuid",
  "best_times_this_month": [
    { "date": "2026-01-14", "dow_name": "Tuesday", "best_windows": [{ "start": "08:00", "end": "09:30", "expected_wait": 5 }] }
  ],
  "weekly_pattern": [
    { "dow": 1, "dow_name": "Monday", "best_hour": 8, "worst_hour": 12, "avg_traffic": 45 }
  ],
  "predicted_congestion": [
    { "date": "2026-01-07", "hourly": [{ "hour": 8, "level": 0.22 }, { "hour": 9, "level": 0.35 }] }
  ],
  "model_info": { "mae": 6.66, "r2": 0.664 },
  "recommendation": "Aim for mid-week mornings for the smoothest visit."
}
```

---

## Importing Results Back to Dashboard

### Using the import script

```bash
cd apps/model
python scripts/import_predictions.py
```

This reads JSON files from `outputs/` and upserts them into the MySQL `predictive_results` table via the backend API.

### Using the backend API directly

```bash
curl -X POST "http://localhost:4000/api/predictions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "business_id": "YOUR_BIZ_ID",
    "insight_type": "ops_insights",
    "insight_data": { ...your JSON output... }
  }'
```

### In Python

```python
import json
import requests

def push_insights(org_id: str, insight_type: str, data: dict, period_start: str, period_end: str):
    response = requests.post(
        f"{SUPABASE_URL}/functions/v1/import-insights",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SERVICE_KEY}"
        },
        json={
            "organization_id": org_id,
            "insight_type": insight_type,
            "period_start": period_start,
            "period_end": period_end,
            "data": data
        }
    )
    return response.json()

# Example: Push ops insights
with open("outputs/admin/ops_insights.json") as f:
    ops_data = json.load(f)

result = push_insights(
    org_id="your-org-id",
    insight_type="ops_insights",
    data=ops_data,
    period_start="2025-12-30",
    period_end="2026-01-05"
)
print(result)
```

---

## Valid Insight Types

| Type | Description | Notebook |
|------|-------------|----------|
| `peak_hours` | Heatmap data | 02 |
| `dropoff_periods` | Abandonment analysis | 02 |
| `best_times` | Best time recommendations | 02 |
| `anomalies` | Unusual pattern alerts | 02 |
| `service_efficiency` | Service utilization | 02 |
| `staff_metrics` | Staff performance | 03 |
| `recommendations` | AI suggestions | 02 |
| `client_predictions` | Client-facing predictions | 04 |
| `ops_insights` | Combined admin insights | 02 |
| `data_health` | Data quality report | 01 |

---

## Scheduling (Optional)

### Using Papermill + Cron

```bash
# Run daily at midnight
0 0 * * * papermill notebooks/02_admin_ops_insights.ipynb notebooks_executed/02_out.ipynb
```

### Using GitHub Actions

```yaml
name: Run Analytics
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  run-notebooks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run notebooks
        run: |
          pip install papermill pandas requests
          papermill notebooks/02_admin_ops_insights.ipynb outputs/02_out.ipynb
```

---

## Utility Functions

See `utils/` directory for shared Python code:
- `io_utils.py` - File fingerprinting, state management
- `feature_utils.py` - DOW/hour extraction, binning
- `metrics_utils.py` - Efficiency score, z-score calculations
