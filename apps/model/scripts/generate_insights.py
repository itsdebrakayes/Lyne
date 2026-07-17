"""
generate_insights.py — Train the wait-time model and write dashboard insights.

This is the canonical, DB-connected model engine. Notebook
07_dashboard_insights.ipynb is a thin wrapper around it, and the wait-time
logic here is the one source of truth (build_model.py / notebook 05 is the
retired standalone prototype).

Produces the structured, chartable payloads the admin dashboards and the
customer-facing ETA read:

    wait_eta_grid           — model-predicted wait per (service, hour, queue
                              length) — the lookup the backend uses to give a
                              joining customer an ETA (replaces position × avg)
    service_time_predictions— expected minutes-per-customer per service/hour
    wait_time_predictions   — predicted wait per hour (8:00–17:00), per business
    abandonment_thresholds  — queue length at which people stop joining
    model_performance       — HONEST holdout MAE / R² (time-based split)

Model: GradientBoostingRegressor over calendar + operational features.
Validation is a temporal split (train on the earlier window, test on the
most recent) — not a random split — so the reported error is trustworthy.

Usage:
    python scripts/generate_insights.py                # writes JSON to outputs/
    python scripts/generate_insights.py --write-db     # also upserts into predictive_results
"""

import os
import sys
import json
import argparse
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pymysql
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.model_utils import SafeLabelEncoder, temporal_split  # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")

MODEL_VERSION = "gbr-wait-v3"
BUSINESS_HOURS = list(range(8, 18))
# Queue-length buckets for the ETA grid. Cell key is the bucket's upper bound;
# the backend picks the smallest bound >= the joining ticket's position.
QUEUE_BUCKETS = [2, 5, 10, 15, 20, 30, 50]

WAIT_FEATURES = [
    "dow", "hour", "month", "branch_enc", "service_enc",
    "queue_length", "staff_count", "active_counters",
    "is_holiday", "is_month_end",
]


def connect():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3308")),
        user=os.getenv("MYSQL_USER", "qmenow"),
        password=os.getenv("MYSQL_PASSWORD", "qmenow_secret"),
        database=os.getenv("MYSQL_DATABASE", "qme_now"),
        cursorclass=pymysql.cursors.DictCursor,
    )


def load_records(conn):
    query = """
        SELECT w.business_id, biz.name AS business_name,
               w.branch_id, b.name AS branch_name,
               w.service_id, s.name AS service_name,
               w.visit_date,
               w.day_of_week AS dow, w.hour_of_day AS hour, w.month_of_year AS month,
               w.wait_time_minutes, w.service_time_minutes, w.status,
               COALESCE(w.queue_length_at_time, 0)   AS queue_length,
               COALESCE(w.staff_count_at_time, 1)    AS staff_count,
               COALESCE(w.active_counters_at_time, 1) AS active_counters,
               CASE WHEN h.holiday_date IS NOT NULL THEN 1 ELSE 0 END AS is_holiday,
               CASE WHEN DAYOFMONTH(w.visit_date) >= 26 THEN 1 ELSE 0 END AS is_month_end
        FROM wait_time_records w
        JOIN businesses biz ON biz.id = w.business_id
        JOIN branches b     ON b.id = w.branch_id
        JOIN services s     ON s.id = w.service_id
        LEFT JOIN public_holidays h ON h.holiday_date = w.visit_date
        WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
    """
    with conn.cursor() as cursor:
        cursor.execute(query)
        df = pd.DataFrame(cursor.fetchall())
    if df.empty:
        return df
    df["visit_date"] = pd.to_datetime(df["visit_date"])
    numeric = ["dow", "hour", "month", "wait_time_minutes", "service_time_minutes",
               "queue_length", "staff_count", "active_counters", "is_holiday", "is_month_end"]
    for column in numeric:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def train_model(df):
    """Train the wait-time GBR with a temporal (not random) holdout."""
    served = df[df["wait_time_minutes"].notna() & (df["wait_time_minutes"] >= 0)].copy()
    if len(served) < 40:
        return None

    encoders = {
        "branch": SafeLabelEncoder().fit(served["branch_id"]),
        "service": SafeLabelEncoder().fit(served["service_id"]),
    }
    served["branch_enc"] = encoders["branch"].transform(served["branch_id"])
    served["service_enc"] = encoders["service"].transform(served["service_id"])

    train_df, test_df = temporal_split(served, "visit_date", test_frac=0.2)
    X_train = train_df[WAIT_FEATURES].fillna(0)
    y_train = train_df["wait_time_minutes"]
    X_test = test_df[WAIT_FEATURES].fillna(0)
    y_test = test_df["wait_time_minutes"]

    model = GradientBoostingRegressor(n_estimators=200, max_depth=3, learning_rate=0.08, random_state=13)
    model.fit(X_train, y_train)

    if len(X_test):
        predictions = model.predict(X_test)
        mae = float(mean_absolute_error(y_test, predictions))
        r2 = float(r2_score(y_test, predictions))
    else:
        mae, r2 = float("nan"), float("nan")

    return {
        "model": model,
        "encoders": encoders,
        "features": WAIT_FEATURES,
        "mae": mae,
        "r2": r2,
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "test_window": (
            f"{test_df['visit_date'].min().date()} → {test_df['visit_date'].max().date()}"
            if len(test_df) else "n/a"
        ),
        "frame": served,
    }


def _representative_context(df_scope):
    """Typical operating context for a service/branch slice, used to fill
    the non-queue features when scoring the ETA grid."""
    return {
        "staff_count": float(df_scope["staff_count"].median() or 1),
        "active_counters": float(df_scope["active_counters"].median() or 1),
        "is_holiday": 0,
        "is_month_end": 0,
    }


def _bucket_of(queue_length):
    for bucket in QUEUE_BUCKETS:
        if queue_length <= bucket:
            return bucket
    return QUEUE_BUCKETS[-1]


def wait_eta_grid(trained, df_biz, empirical_min=8):
    """The lookup the backend uses to quote a joining customer their wait.

    For each service we build a (hour × queue-length-bucket) surface so a live
    ticket can be matched on (service_id, hour, position) without invoking
    Python in the request path. Each cell blends two sources:
      • the *actual historical mean wait* for that exact cell when we have
        enough observations (empirical, explainable, accurate where data is
        dense), else
      • the model's prediction (generalises into thin/never-seen cells).
    The model alone scored a weak holdout R² on this data, so leading with
    real cell history and back-filling with the model is the honest choice.
    """
    model = trained["model"]
    enc = trained["encoders"]
    served = df_biz[df_biz["wait_time_minutes"].notna() & (df_biz["wait_time_minutes"] >= 0)].copy()
    served["qbucket"] = served["queue_length"].fillna(0).map(_bucket_of)

    services = []
    for (service_id, service_name), grp in served.groupby(["service_id", "service_name"]):
        branch_mode = grp["branch_id"].mode()
        if branch_mode.empty:
            continue
        weekday_slice = grp[grp["dow"].between(1, 5)]
        dow = int((weekday_slice if len(weekday_slice) else grp)["dow"].mode().iloc[0])
        month = int(grp["month"].mode().iloc[0]) if len(grp["month"].mode()) else datetime.now().month
        ctx = _representative_context(grp)
        branch_enc = int(enc["branch"].transform([branch_mode.iloc[0]])[0])
        service_enc = int(enc["service"].transform([service_id])[0])

        # Empirical cell means: (hour, qbucket) -> (mean_wait, count)
        empirical = (
            grp.groupby(["hour", "qbucket"])["wait_time_minutes"]
            .agg(["mean", "count"]).to_dict("index")
        )

        cells = []
        for hour in BUSINESS_HOURS:
            for bucket in QUEUE_BUCKETS:
                cell = empirical.get((hour, bucket))
                if cell and cell["count"] >= empirical_min:
                    wait, source = float(cell["mean"]), "history"
                else:
                    sample = pd.DataFrame([{
                        "dow": dow, "hour": hour, "month": month,
                        "branch_enc": branch_enc, "service_enc": service_enc,
                        "queue_length": bucket, "staff_count": ctx["staff_count"],
                        "active_counters": ctx["active_counters"],
                        "is_holiday": 0, "is_month_end": 0,
                    }])[trained["features"]]
                    wait, source = float(model.predict(sample)[0]), "model"
                cells.append({
                    "hour": hour,
                    "queue_max": bucket,
                    "predicted_wait": round(max(0.0, wait), 1),
                    "source": source,
                })
        services.append({
            "service_id": service_id,
            "service_name": service_name,
            "cells": cells,
        })
    return services


def service_time_predictions(df_biz):
    """Expected minutes-per-customer per service (and per business hour).

    Feeds the backend's position × service-rate estimate and the staffing
    model's service-rate input. Empirical, robust to sparse hours.
    """
    served = df_biz[df_biz["service_time_minutes"].notna() & (df_biz["service_time_minutes"] > 0)]
    out = []
    for (service_id, service_name), grp in served.groupby(["service_id", "service_name"]):
        if len(grp) < 10:
            continue
        by_hour = [
            {"hour": int(hour), "avg_service_minutes": round(float(hour_grp["service_time_minutes"].mean()), 1)}
            for hour, hour_grp in grp.groupby("hour") if len(hour_grp) >= 5
        ]
        out.append({
            "service_id": service_id,
            "service_name": service_name,
            "avg_service_minutes": round(float(grp["service_time_minutes"].mean()), 1),
            "p90_service_minutes": round(float(grp["service_time_minutes"].quantile(0.9)), 1),
            "by_hour": by_hour,
            "sample_size": int(len(grp)),
        })
    return out


def hourly_forecast(trained, df_biz):
    """Predict tomorrow's wait per business hour using each hour's typical load."""
    tomorrow_dow = (datetime.now().weekday() + 1 + 1) % 7  # python Mon=0 → schema Sun=0
    rows = []
    for hour in BUSINESS_HOURS:
        hour_slice = df_biz[df_biz["hour"] == hour]
        if hour_slice.empty:
            continue
        branch_mode = hour_slice["branch_id"].mode()
        service_mode = hour_slice["service_id"].mode()
        if branch_mode.empty or service_mode.empty:
            continue
        ctx = _representative_context(hour_slice)
        sample = pd.DataFrame([{
            "dow": tomorrow_dow, "hour": hour,
            "month": int(hour_slice["month"].mode().iloc[0]) if len(hour_slice["month"].mode()) else datetime.now().month,
            "branch_enc": int(trained["encoders"]["branch"].transform([branch_mode.iloc[0]])[0]),
            "service_enc": int(trained["encoders"]["service"].transform([service_mode.iloc[0]])[0]),
            "queue_length": float(hour_slice["queue_length"].median()),
            "staff_count": ctx["staff_count"], "active_counters": ctx["active_counters"],
            "is_holiday": 0, "is_month_end": 0,
        }])[trained["features"]]
        predicted = float(trained["model"].predict(sample)[0])
        rows.append({"hour": hour, "predicted_wait": round(max(0.0, predicted), 1)})
    return rows


def abandonment_by_service(df_biz):
    """Empirical queue-length tolerance: the shortest queue at which the
    abandon rate (no-show / cancelled) crosses 30%, per service."""
    out = []
    for (service_id, service_name), group in df_biz.groupby(["service_id", "service_name"]):
        with_queue = group[group["queue_length"] > 0]
        if len(with_queue) < 25:
            continue
        with_queue = with_queue.assign(abandoned=~with_queue["status"].isin(["served"]))
        buckets = with_queue.groupby(pd.cut(with_queue["queue_length"], bins=[0, 3, 6, 10, 15, 25, 60], right=True), observed=True)
        threshold = None
        abandon_at_threshold = None
        for bucket, rows in buckets:
            if len(rows) < 8:
                continue
            rate = float(rows["abandoned"].mean())
            if rate >= 0.30:
                threshold = int(bucket.right)
                abandon_at_threshold = rate
                break
        if threshold is None:
            threshold = int(with_queue["queue_length"].quantile(0.9))
            abandon_at_threshold = float(with_queue["abandoned"].mean())
        out.append({
            "service_id": service_id,
            "service_name": service_name,
            "threshold_queue_length": max(1, threshold),
            "abandon_rate_pct": round(abandon_at_threshold * 100, 1),
            "sample_size": int(len(with_queue)),
        })
    return sorted(out, key=lambda row: row["threshold_queue_length"])


def build_insights(df, trained):
    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(days=1)
    insights = []
    for business_id, df_biz in df.groupby("business_id"):
        business_name = df_biz["business_name"].iloc[0]

        grid = wait_eta_grid(trained, df_biz)
        if grid:
            insights.append({
                "business_id": business_id,
                "insight_type": "wait_eta_grid",
                "insight_data": {
                    "summary": f"{business_name}: model-based wait estimates power the join-time ETA.",
                    "queue_buckets": QUEUE_BUCKETS,
                    "services": grid,
                },
            })

        service_times = service_time_predictions(df_biz)
        if service_times:
            insights.append({
                "business_id": business_id,
                "insight_type": "service_time_predictions",
                "insight_data": {"services": service_times},
            })

        forecast = hourly_forecast(trained, df_biz)
        if forecast:
            peak = max(forecast, key=lambda row: row["predicted_wait"])
            insights.append({
                "business_id": business_id,
                "insight_type": "wait_time_predictions",
                "insight_data": {
                    "summary": f"{business_name}: predicted waits peak at {peak['predicted_wait']:.0f} minutes around {peak['hour']}:00 tomorrow.",
                    "hours": forecast,
                },
            })

        thresholds = abandonment_by_service(df_biz)
        if thresholds:
            tightest = thresholds[0]
            insights.append({
                "business_id": business_id,
                "insight_type": "abandonment_thresholds",
                "insight_data": {
                    "summary": (
                        f"{business_name}: {tightest['service_name']} loses customers fastest — "
                        f"joining drops once about {tightest['threshold_queue_length']} people are in line."
                    ),
                    "services": thresholds,
                },
            })

        insights.append({
            "business_id": business_id,
            "insight_type": "model_performance",
            "insight_data": {
                "summary": "Gradient boosting wait-time model, validated on the most recent 20% of visits (time-based holdout).",
                "model": "GradientBoostingRegressor",
                "validation": "temporal_holdout",
                "test_window": trained["test_window"],
                "mae_minutes": None if np.isnan(trained["mae"]) else round(trained["mae"], 2),
                "r2": None if np.isnan(trained["r2"]) else round(trained["r2"], 3),
                "training_rows": trained["train_rows"],
                "test_rows": trained["test_rows"],
            },
        })
    return insights, generated_at, stale_after


def write_outputs(insights):
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "dashboard_insights.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(insights, handle, indent=2, default=str)
    return path


def write_db(conn, insights, generated_at, stale_after, records_processed):
    with conn.cursor() as cursor:
        for insight in insights:
            cursor.execute(
                "DELETE FROM predictive_results WHERE business_id = %s AND insight_type = %s",
                (insight["business_id"], insight["insight_type"]),
            )
            cursor.execute(
                """INSERT INTO predictive_results
                     (id, business_id, branch_id, service_id, insight_type, insight_data,
                      model_version, records_processed, stale_after, generated_at)
                   VALUES (%s, %s, NULL, NULL, %s, %s, %s, %s, %s, %s)""",
                (
                    str(uuid.uuid4()),
                    insight["business_id"],
                    insight["insight_type"],
                    json.dumps(insight["insight_data"]),
                    MODEL_VERSION,
                    records_processed,
                    stale_after.strftime("%Y-%m-%d %H:%M:%S"),
                    generated_at.strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true", help="Upsert insights into predictive_results")
    args = parser.parse_args()

    conn = connect()
    df = load_records(conn)
    if df.empty:
        print("No wait_time_records found — nothing to model.")
        return

    trained = train_model(df)
    if not trained:
        print(f"Not enough completed visits to train ({len(df)} records).")
        return

    insights, generated_at, stale_after = build_insights(df, trained)
    path = write_outputs(insights)
    mae = trained["mae"]
    print(f"Model: MAE ±{mae:.1f}m, R² {trained['r2']:.2f} on {trained['test_rows']} holdout rows ({trained['test_window']})")
    print(f"Wrote {len(insights)} insights → {path}")

    if args.write_db:
        write_db(conn, insights, generated_at, stale_after, len(df))
        print("Upserted insights into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
