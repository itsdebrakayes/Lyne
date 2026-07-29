# Q ME NOW — Live Model Worker

This app is the analytics/ML layer. A single containerized **live worker**
(`scripts/live_worker.py`) trains and scores six models directly against the
MySQL database and upserts dashboard-ready insights into `predictive_results` —
no CSV export, no notebooks, no separate import step.

## Flow

```text
MySQL operational tables
  -> scripts/live_worker.py   (on boot + every 2h, in its own container)
       -> the six model scripts (--write-db)
  -> predictive_results
  -> dashboard + mobile APIs
```

On a fresh/thin volume the worker first runs `generate_sample_data.py` to build
the realistic stressed/moderate history (with day-to-day momentum) so the models
have honest signal — it is the authoritative demo-history source, not `seed.sql`.

Dashboards read `predictive_results` (and compute the descriptive summaries —
branch/service/manager performance, heatmaps — live from the API).

## The models (all write to `predictive_results`)

- `wait_time_model.py` — `wait_eta_grid` (powers the live customer ETA),
  `service_time_predictions`, `wait_time_predictions`, `abandonment_thresholds`,
  `best_time_to_visit` (per branch — mobile Plan-Your-Visit), `model_performance`
- `forecast_demand.py` — `demand_forecast` (GBR on autoregressive lags, backtested
  against seasonal-naive; ships whichever wins, per series)
- `recommend_staffing.py` — `staffing_recommendation` (Erlang-C / M/M/c)
- `predict_no_show.py` — `no_show_risk`
- `forecast_targets.py` — `target_attainment`
- `detect_operational_anomalies.py` — `operational_anomalies`

Each insight carries tenant metadata, model version, generated time, and source
window. See the "Machine learning & analytics" section of the root `README.md`
for the full model design and rationale.

## Running it

Containerized (demo stack) — this is how it runs live:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d model-worker
docker logs -f qmenow_model_worker
```

Locally against a running DB (for development):

```bash
cd apps/model
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-worker.txt          # lean runtime: numpy/pandas/sklearn/pymysql
python scripts/live_worker.py                    # or a single model, e.g.:
python scripts/wait_time_model.py --write-db
```

Environment: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_DATABASE`; optional `MODEL_REFRESH_SECONDS` (default 7200),
`MODEL_HISTORY_DAYS` (150).

For a brand-new empty company, the models produce little until real queue data
accumulates; dashboards show empty/stale states rather than mock analytics.
Notebooks under `notebooks/` (01–04, 08–12) are exploratory wrappers, not part of
the live path.
