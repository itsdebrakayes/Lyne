# Q ME NOW — ML & Analytics Models

This document describes the machine-learning / analytics layer (`apps/model`)
from a **business** standpoint: the decision each model exists to serve, how it
works, what it publishes, and where it is honestly limited. It reflects the
July 2026 review that rebuilt this layer around real queue-management processes.

## The business, in one paragraph

QMe Now is a virtual-queue platform for high-traffic service organisations
(in the pilot: Jamaican government agencies — TAJ, NHT, PICA). Customers join a
line remotely and are served at counters; managers run branches day-to-day;
executives run the business across branches. Every model below maps to a real
decision one of those people makes.

## Who decides what, and which model serves it

| Stakeholder | Decision | Model / insight |
|---|---|---|
| Customer | "How long will I wait if I join now?" | **wait_eta_grid** → live ticket ETA |
| Customer | "When is the best time to go?" | best_time_to_visit (existing) |
| Manager | "How many people should I expect?" | **demand_forecast** |
| Manager | "How many counters do I open each hour?" | **staffing_recommendation** |
| Staff | "Who is likely to no-show / walk away?" | **no_show_risk** |
| Executive | "Will we hit the targets we set?" | **target_attainment** |
| Executive | "Is a branch silently degrading?" | **operational_anomalies** |
| Exec/Manager | "How are branches / services / managers doing?" | branch/service/manager performance (existing) |

Bold entries were added or rebuilt in the July 2026 review.

## Model inventory

### 1. Wait-time model + live ETA — `scripts/generate_insights.py` (nb 07)
The one genuine regression model, a `GradientBoostingRegressor` over calendar +
operational features (dow, hour, month, branch, service, queue length, staff,
counters, holiday, month-end). Two important changes from the original:

- **Honest validation.** Uses a *temporal* holdout (train on the earlier window,
  test on the most recent) instead of a random split. On the demo data this
  moved the reported quality from an inflated R²≈0.75 to a truthful R²≈0.20 —
  the number executives use to gauge trust is now real, not leakage.
- **It now powers the customer ETA.** Publishes `wait_eta_grid`: per service, a
  surface of expected wait by hour × queue-length bucket, each cell backed by
  *actual history* where dense and the *model* where thin. The backend
  (`apps/backend/src/utils/waitEstimator.js`) reads this at join time instead of
  the old `(position − 1) × base_avg_time`. Falls back to the formula when no
  grid exists. Also publishes `service_time_predictions` (minutes per customer).

### 2. Demand forecast — `scripts/forecast_demand.py` (nb 08)
Predicts arrival **volume** per branch for the next 7 days, by day and hour.
Backtests a GradientBoosting model against a seasonal-naive baseline on a 14-day
temporal holdout and **uses whichever wins** (on sparse hourly counts the naive
baseline usually wins — we don't pretend otherwise). The forecast respects each
branch's configured `open_days` / opening hours and the public-holiday calendar,
so a Mon–Fri agency is never told to expect weekend or holiday traffic.
Publishes `demand_forecast`.

### 3. Staffing recommendation — `scripts/recommend_staffing.py` (nb 09)
Prescriptive. For each branch-hour it computes the arrival rate (from demand)
and service rate (from observed service times) and uses **Erlang-C (M/M/c)
queueing** to find the smallest number of counters that holds the expected wait
at or under the executive's `target_wait_minutes`, capped by the counters the
branch physically has. Flags hours that can't meet target even fully staffed.
Replaces the previous toy rule ("avg wait ≥ 20 → review staffing").
Publishes `staffing_recommendation`.

### 4. No-show / abandonment risk — `scripts/predict_no_show.py` (nb 10)
A `GradientBoostingClassifier` predicting whether a ticket ends in
no-show / left / cancelled, from what's known while the customer waits: time,
service, queue length at join, channel (app vs walk-in), holiday / month-end.
Reports ROC-AUC on a temporal holdout and the top risk drivers, and publishes a
compact risk lookup (service × channel × queue length). Publishes `no_show_risk`.

### 5. Target attainment — `scripts/forecast_targets.py` (nb 11)
Projects each `business_targets` metric (wait, completion, no-show) to its
horizon date via a linear trend with a ±95% residual band, clipped to each
metric's real range, and labels on-track / at-risk / off-track with direction of
travel. Publishes `target_attainment`.

### 6. Operational anomalies — `scripts/detect_operational_anomalies.py` (nb 12)
Re-activates the previously-orphaned `detect_anomalies` utility. Scans each
branch's recent daily history for days where wait, volume, no-show, or
completion broke sharply (|z| ≥ 2) from that branch's own norm, ranked by
severity, as executive early-warning alerts. Publishes `operational_anomalies`.

## Data foundations added

- **`public_holidays`** (migration 013) — Jamaica national holidays 2025–2027,
  the single source of truth for the `is_holiday` feature (previously hardcoded
  to `0` everywhere) and the forecast's surge signal.
- **`ticket_ratings`** (migration 014) — post-visit satisfaction (1–5, optional
  "was the wait acceptable?" + comment). The only customer-experience signal in
  the system; captured via `POST /api/tickets/:id/rating`. Enables future
  satisfaction / churn analysis.
- **`queue_tickets.channel`** (migration 014) — records app vs walk-in vs kiosk
  explicitly instead of inferring it from whether a ticket had a user.

## Insight-type contract (`predictive_results.insight_type`)

`wait_eta_grid`, `service_time_predictions`, `wait_time_predictions`,
`abandonment_thresholds`, `model_performance`, `demand_forecast`,
`staffing_recommendation`, `no_show_risk`, `target_attainment`,
`operational_anomalies`, plus the existing `best_time_to_visit`,
`branch_performance`, `service_performance`, `manager_performance`,
`heatmap_data`, `resource_recommendations`.

## Running it

```bash
cd apps/model
python scripts/run_pipeline.py --business-id <id> --days 120
```

The runner exports CSVs, executes notebooks 05–06, then runs the DB-connected
model scripts (each upserts its insights into `predictive_results` via
`--write-db`). Individual scripts can be run directly; each writes JSON to
`outputs/admin/` and takes `--write-db` to also upsert.

## Honest limitations

- **The demo seed is synthetic and near-uniform** (similar volume every day incl.
  weekends, weak feature→outcome relationships, no holiday closures). That is why
  the models score modestly here (wait R²≈0.20, no-show AUC≈0.52) and why the
  seasonal-naive baseline beats the demand model. The *architecture* is sound;
  meaningful accuracy needs realistic operational history. Regenerating the demo
  seed with weekday-heavy, holiday-aware, correlated patterns is a recommended
  follow-up.
- **Forecast horizon is short (7 days)** and the target projection is a trend
  line, not a causal model — both are labelled as such in their payloads.
- Models retrain on each run; there is no persisted model artifact or drift
  monitoring yet.
