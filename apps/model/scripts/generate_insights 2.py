"""
generate_insights.py — Train the wait-time model and write dashboard insights.

Produces the structured, chartable payloads the admin dashboards read:

    wait_time_predictions   — predicted wait per hour (8:00–17:00), per business
    abandonment_thresholds  — queue length at which people stop joining, per service
    model_performance       — holdout MAE / R² of the trained model

The model is the same one as notebooks/05_predictive_model.ipynb: a
GradientBoostingRegressor over (day-of-week, hour, branch, service,
queue length at join). Notebook 07_dashboard_insights.ipynb wraps this
script so it runs as part of the notebook pipeline.

Usage:
    python scripts/generate_insights.py                # writes JSON to outputs/
    python scripts/generate_insights.py --write-db     # also upserts into predictive_results

DB connection comes from MYSQL_HOST / MYSQL_PORT / MYSQL_USER /
MYSQL_PASSWORD / MYSQL_DATABASE (defaults match the local demo stack).
"""

import os
import json
import argparse
import uuid
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pymysql
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "..", "outputs", "admin")

MODEL_VERSION = "gbr-wait-v2"
BUSINESS_HOURS = list(range(8, 18))


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
               w.day_of_week AS dow, w.hour_of_day AS hour,
               w.wait_time_minutes, w.status,
               COALESCE(w.queue_length_at_time, 0) AS queue_length
        FROM wait_time_records w
        JOIN businesses biz ON biz.id = w.business_id
        JOIN branches b     ON b.id = w.branch_id
        JOIN services s     ON s.id = w.service_id
        WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
    """
    with conn.cursor() as cursor:
        cursor.execute(query)
        df = pd.DataFrame(cursor.fetchall())
    if df.empty:
        return df
    for column in ("dow", "hour", "wait_time_minutes", "queue_length"):
        df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def train_model(df):
    served = df[df["wait_time_minutes"].notna() & (df["wait_time_minutes"] >= 0)].copy()
    if len(served) < 40:
        return None
    encoders = {
        "branch": LabelEncoder().fit(served["branch_id"]),
        "service": LabelEncoder().fit(served["service_id"]),
    }
    served["branch_enc"] = encoders["branch"].transform(served["branch_id"])
    served["service_enc"] = encoders["service"].transform(served["service_id"])
    features = ["dow", "hour", "branch_enc", "service_enc", "queue_length"]
    X = served[features].fillna(0)
    y = served["wait_time_minutes"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=13)
    model = GradientBoostingRegressor(n_estimators=160, max_depth=3, learning_rate=0.08, random_state=13)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    return {
        "model": model,
        "encoders": encoders,
        "features": features,
        "mae": float(mean_absolute_error(y_test, predictions)),
        "r2": float(r2_score(y_test, predictions)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "frame": served,
    }


def hourly_forecast(trained, df_biz):
    """Predict tomorrow's wait per business hour using each hour's typical load."""
    tomorrow_dow = (datetime.now().weekday() + 1 + 1) % 7  # python Mon=0 → schema Sun=0
    rows = []
    for hour in BUSINESS_HOURS:
        hour_slice = df_biz[df_biz["hour"] == hour]
        if hour_slice.empty:
            continue
        queue_len = float(hour_slice["queue_length"].median())
        branch_mode = hour_slice["branch_id"].mode()
        service_mode = hour_slice["service_id"].mode()
        if branch_mode.empty or service_mode.empty:
            continue
        sample = pd.DataFrame([{
            "dow": tomorrow_dow,
            "hour": hour,
            "branch_enc": int(trained["encoders"]["branch"].transform([branch_mode.iloc[0]])[0]),
            "service_enc": int(trained["encoders"]["service"].transform([service_mode.iloc[0]])[0]),
            "queue_length": queue_len,
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
                "summary": "Gradient boosting wait-time model trained on the last 120 days of visits.",
                "model": "GradientBoostingRegressor",
                "mae_minutes": round(trained["mae"], 2),
                "r2": round(trained["r2"], 3),
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
    print(f"Model: MAE ±{trained['mae']:.1f}m, R² {trained['r2']:.2f} on {trained['test_rows']} holdout rows")
    print(f"Wrote {len(insights)} insights → {path}")

    if args.write_db:
        write_db(conn, insights, generated_at, stale_after, len(df))
        print("Upserted insights into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
