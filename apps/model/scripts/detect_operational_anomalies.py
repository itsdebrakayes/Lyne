"""
detect_operational_anomalies.py — Catch a branch degrading before customers do.

The codebase already had a sound anomaly detector (utils/metrics_utils.detect_anomalies)
but nothing called it — it was wired into notebooks that were retired. This
script puts it back to work: it scans each branch's recent daily history for
days where wait time, volume, or the no-show rate broke sharply from that
branch's own norm, and publishes them as executive alerts.

The point is early warning. A branch whose average wait quietly doubled, or
whose no-show rate spiked, should surface on the executive dashboard the next
morning — not three months later in a quarterly review.

Outputs `operational_anomalies` insight per business (recent, ranked by severity).

Usage:
    python scripts/detect_operational_anomalies.py [--write-db]
"""
import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone

import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect, upsert_insights          # noqa: E402
from utils.metrics_utils import detect_anomalies         # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")
MODEL_VERSION = "anomaly-zscore-v1"
RECENT_DAYS = 14          # only alert on anomalies inside this window
Z_THRESHOLD = 2.0


def load_daily_branch(conn):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT w.business_id, biz.name AS business_name,
                   w.branch_id, b.name AS branch_name, w.visit_date AS date,
                   COUNT(*) AS volume,
                   AVG(w.wait_time_minutes) AS avg_wait,
                   AVG(w.service_time_minutes) AS avg_service,
                   AVG(w.status = 'no_show') * 100 AS no_show_rate,
                   AVG(w.status = 'served') * 100 AS completion_rate
            FROM wait_time_records w
            JOIN businesses biz ON biz.id = w.business_id
            JOIN branches b     ON b.id = w.branch_id
            WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
            GROUP BY w.business_id, biz.name, w.branch_id, b.name, w.visit_date
        """)
        df = pd.DataFrame(cursor.fetchall())
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"])
    for c in ["volume", "avg_wait", "avg_service", "no_show_rate", "completion_rate"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


METRICS = [
    ("avg_wait", "wait time", "higher"),
    # A branch whose per-customer SERVICE time jumps above its own norm is a
    # chronic productivity slowdown — the trend companion to the live board.
    ("avg_service", "service time", "higher"),
    ("no_show_rate", "no-show rate", "higher"),
    ("volume", "visit volume", "either"),
    ("completion_rate", "completion rate", "lower"),
]


def build_insights(df):
    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(days=1)
    recent_cutoff = df["date"].max() - pd.Timedelta(days=RECENT_DAYS)
    insights = []

    for business_id, dfb in df.groupby("business_id"):
        business_name = dfb["business_name"].iloc[0]
        anomalies = []
        for (branch_id, branch_name), gb in dfb.groupby(["branch_id", "branch_name"]):
            gb = gb.sort_values("date")
            if len(gb) < 10:
                continue
            gb_str = gb.assign(date=gb["date"].dt.strftime("%Y-%m-%d"))
            for col, label, bad_dir in METRICS:
                found = detect_anomalies(gb_str, value_col=col, date_col="date", threshold=Z_THRESHOLD)
                for a in found:
                    if pd.Timestamp(a["date"]) < recent_cutoff:
                        continue
                    # Only alert on the "bad" direction for one-sided metrics.
                    if bad_dir == "higher" and a["z_score"] < 0:
                        continue
                    if bad_dir == "lower" and a["z_score"] > 0:
                        continue
                    anomalies.append({
                        "branch_id": branch_id,
                        "branch_name": branch_name,
                        "metric": label,
                        "date": a["date"],
                        "value": round(a["value"], 1),
                        "expected": a["expected"],
                        "z_score": a["z_score"],
                        "severity": a["severity"],
                        "message": (f"{branch_name}: {label} was {round(a['value'],1)} on {a['date']} "
                                    f"vs a typical {a['expected']} (z={a['z_score']})."),
                    })
        anomalies.sort(key=lambda x: (x["severity"] != "critical", -abs(x["z_score"])))
        summary = (f"{business_name}: {len(anomalies)} operational anomaly(ies) in the last "
                   f"{RECENT_DAYS} days." if anomalies
                   else f"{business_name}: no unusual branch days in the last {RECENT_DAYS} days.")
        insights.append({
            "business_id": business_id,
            "insight_type": "operational_anomalies",
            "insight_data": {
                "summary": summary,
                "method": f"per-branch z-score (|z| ≥ {Z_THRESHOLD}) on daily metrics",
                "window_days": RECENT_DAYS,
                "anomalies": anomalies,
            },
            "records_processed": int(len(dfb)),
        })
    return insights, generated_at, stale_after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true")
    args = parser.parse_args()

    conn = connect()
    df = load_daily_branch(conn)
    if df.empty:
        print("No records — nothing to scan for anomalies.")
        return

    insights, generated_at, stale_after = build_insights(df)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "operational_anomalies.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(insights, handle, indent=2, default=str)
    total = sum(len(i["insight_data"]["anomalies"]) for i in insights)
    print(f"Wrote {len(insights)} operational_anomalies insight(s), {total} anomaly(ies) → {path}")

    if args.write_db:
        upsert_insights(conn, insights, generated_at, stale_after, MODEL_VERSION)
        print("Upserted operational_anomalies into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
