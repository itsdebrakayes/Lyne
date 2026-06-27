# Q ME NOW — Production Analytics Pipeline

This app contains the analytics worker for Q ME NOW. It exports live operational data from MySQL, runs the production notebook/model layer, and imports dashboard-ready insights back through the backend API.

## Flow

```text
MySQL operational tables
  -> scripts/export_csv.py
  -> notebooks/05_predictive_model.ipynb
  -> scripts/import_predictions.py
  -> backend API
  -> predictive_results
  -> dashboards
```

Dashboards should never read local notebook files or CSV files directly.

## Inputs

`scripts/export_csv.py` writes tenant-scoped CSVs into `data_exports/`:

- `queue_history.csv`
- `service_performance.csv`
- `branch_performance.csv`
- `staff_activity.csv`
- `queue_events.csv`

Run production exports with a business id:

```bash
python scripts/export_csv.py --business-id YOUR_BUSINESS_ID --days 90
```

## Outputs

`scripts/import_predictions.py` imports standardized insight types:

- `ops_insights`
- `staff_metrics`
- `branch_performance`
- `service_performance`
- `resource_recommendations`
- `best_time_to_visit`
- `wait_time_predictions`
- `abandonment_thresholds`
- `heatmap_data`

Each imported insight includes tenant metadata, model version, generated time, and source window where available.

## Scheduled Worker

The Docker service `analytics-worker` runs:

- every 30 minutes during business hours
- a full nightly refresh
- queued manual triggers created by authorized executives/platform admins

Required environment variables are documented in `.env.example`.

## Manual Run

```bash
cd apps/model
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/run_pipeline.py --business-id YOUR_BUSINESS_ID --days 90
```

For a new empty company, the export may produce empty CSVs and the notebook may not generate insights yet. That is expected until operational queue data exists; dashboards should show empty states and stale/no-data messages instead of mock analytics.
