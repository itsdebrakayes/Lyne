"""
predict_no_show.py — Per-ticket no-show / abandonment risk.

No-shows and walk-aways are pure waste: a counter sits idle while someone who
would have been served is still in line. The system tracked the no-show *rate*
after the fact but never predicted *who* was at risk, so staff couldn't act.

This model learns the risk that a ticket ends in no_show / left / cancelled
(rather than served) from what is known while the person is still waiting:
time of day, service, how long the line was when they joined, whether they
joined remotely via the app or walked in, and holiday / month-end pressure.

Because the backend can't run Python in the request path, we publish a compact
`no_show_risk` lookup (risk by service × channel × queue-length) plus the model's
quality (ROC-AUC on a time-based holdout) and its top risk drivers, so the staff
dashboard can highlight at-risk tickets and trigger earlier reminders.

Usage:
    python scripts/predict_no_show.py [--write-db]
"""
import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect, upsert_insights          # noqa: E402
from utils.model_utils import SafeLabelEncoder, temporal_split  # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")
MODEL_VERSION = "no-show-gbc-v1"
QUEUE_BUCKETS = [2, 5, 10, 20, 40]
ABANDON_STATUSES = ("no_show", "left", "cancelled")
FEATURES = ["dow", "hour", "month", "branch_enc", "service_enc",
            "queue_length", "is_walk_in", "is_holiday", "is_month_end"]


def load_records(conn):
    query = """
        SELECT w.business_id, biz.name AS business_name,
               w.branch_id, w.service_id, s.name AS service_name,
               w.visit_date, w.day_of_week AS dow, w.hour_of_day AS hour, w.month_of_year AS month,
               COALESCE(w.queue_length_at_time, 0) AS queue_length,
               CASE WHEN t.user_id IS NULL THEN 1 ELSE 0 END AS is_walk_in,
               CASE WHEN h.holiday_date IS NOT NULL THEN 1 ELSE 0 END AS is_holiday,
               CASE WHEN DAYOFMONTH(w.visit_date) >= 26 THEN 1 ELSE 0 END AS is_month_end,
               w.status
        FROM wait_time_records w
        JOIN businesses biz ON biz.id = w.business_id
        JOIN services s     ON s.id = w.service_id
        LEFT JOIN queue_tickets t   ON t.id = w.ticket_id
        LEFT JOIN public_holidays h ON h.holiday_date = w.visit_date
        WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
    """
    with conn.cursor() as cursor:
        cursor.execute(query)
        df = pd.DataFrame(cursor.fetchall())
    if df.empty:
        return df
    df["visit_date"] = pd.to_datetime(df["visit_date"])
    for col in ["dow", "hour", "month", "queue_length", "is_walk_in", "is_holiday", "is_month_end"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["abandoned"] = df["status"].isin(ABANDON_STATUSES).astype(int)
    return df


def train(df):
    enc_b = SafeLabelEncoder().fit(df["branch_id"])
    enc_s = SafeLabelEncoder().fit(df["service_id"])
    df = df.copy()
    df["branch_enc"] = enc_b.transform(df["branch_id"])
    df["service_enc"] = enc_s.transform(df["service_id"])

    train_df, test_df = temporal_split(df, "visit_date", 0.2)
    if train_df["abandoned"].nunique() < 2:
        return None
    model = GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=19)
    model.fit(train_df[FEATURES].fillna(0), train_df["abandoned"])

    auc = None
    if len(test_df) and test_df["abandoned"].nunique() == 2:
        proba = model.predict_proba(test_df[FEATURES].fillna(0))[:, 1]
        auc = round(float(roc_auc_score(test_df["abandoned"], proba)), 3)
    importances = sorted(
        [{"feature": f, "importance": round(float(i), 3)} for f, i in zip(FEATURES, model.feature_importances_)],
        key=lambda x: x["importance"], reverse=True,
    )
    return {"model": model, "enc_b": enc_b, "enc_s": enc_s, "auc": auc,
            "test_rows": int(len(test_df)), "importances": importances,
            "test_window": (f"{test_df['visit_date'].min().date()} → {test_df['visit_date'].max().date()}"
                            if len(test_df) else "n/a")}


def _bucket(q):
    for b in QUEUE_BUCKETS:
        if q <= b:
            return b
    return QUEUE_BUCKETS[-1]


def risk_table(trained, df_biz):
    """Compact risk lookup: service × channel × queue-length → predicted risk%."""
    model, enc_b, enc_s = trained["model"], trained["enc_b"], trained["enc_s"]
    services = []
    for (sid, sname), grp in df_biz.groupby(["service_id", "service_name"]):
        branch_mode = grp["branch_id"].mode()
        if branch_mode.empty:
            continue
        hour = int(grp["hour"].median())
        month = int(grp["month"].mode().iloc[0]) if len(grp["month"].mode()) else datetime.now().month
        dow = int(grp["dow"].mode().iloc[0]) if len(grp["dow"].mode()) else 1
        rows = []
        for channel, is_walk in (("app", 0), ("walk_in", 1)):
            for qb in QUEUE_BUCKETS:
                sample = pd.DataFrame([{
                    "dow": dow, "hour": hour, "month": month,
                    "branch_enc": int(enc_b.transform([branch_mode.iloc[0]])[0]),
                    "service_enc": int(enc_s.transform([sid])[0]),
                    "queue_length": qb, "is_walk_in": is_walk,
                    "is_holiday": 0, "is_month_end": 0,
                }])[FEATURES]
                risk = float(model.predict_proba(sample)[0, 1])
                rows.append({"channel": channel, "queue_max": qb, "risk_pct": round(risk * 100, 1)})
        services.append({"service_id": sid, "service_name": sname,
                         "observed_abandon_rate_pct": round(float(grp["abandoned"].mean()) * 100, 1),
                         "cells": rows})
    return services


def build_insights(df, trained):
    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(days=1)
    insights = []
    for business_id, df_biz in df.groupby("business_id"):
        business_name = df_biz["business_name"].iloc[0]
        overall = round(float(df_biz["abandoned"].mean()) * 100, 1)
        top = trained["importances"][0]["feature"] if trained["importances"] else "n/a"
        insights.append({
            "business_id": business_id,
            "insight_type": "no_show_risk",
            "insight_data": {
                "summary": (f"{business_name}: {overall}% of tickets end in no-show/abandonment. "
                            f"Biggest driver: {top}."),
                "model": "GradientBoostingClassifier",
                "validation": "temporal_holdout",
                "roc_auc": trained["auc"],
                "test_window": trained["test_window"],
                "overall_abandon_rate_pct": overall,
                "top_drivers": trained["importances"][:5],
                "risk_by_service": risk_table(trained, df_biz),
            },
            "records_processed": int(len(df_biz)),
        })
    return insights, generated_at, stale_after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true")
    args = parser.parse_args()

    conn = connect()
    df = load_records(conn)
    if df.empty:
        print("No records — cannot model no-show risk.")
        return
    trained = train(df)
    if not trained:
        print("Not enough outcome variety to train a no-show model.")
        return

    insights, generated_at, stale_after = build_insights(df, trained)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "no_show_risk.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(insights, handle, indent=2, default=str)
    auc = trained["auc"]
    print(f"No-show model AUC {auc} on {trained['test_rows']} holdout rows ({trained['test_window']})")
    print(f"Wrote {len(insights)} no_show_risk insight(s) → {path}")

    if args.write_db:
        upsert_insights(conn, insights, generated_at, stale_after, MODEL_VERSION)
        print("Upserted no_show_risk into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
