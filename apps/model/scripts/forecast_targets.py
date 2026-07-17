"""
forecast_targets.py — Will we hit the targets the executive set?

Executives set operational targets (business_targets: target wait, completion
rate, no-show rate, and a horizon). The dashboard could only show where things
stand *today* against those targets. This model answers the forward-looking
question a leader actually asks: "on our current trajectory, will we get there?"

For each metric we fit a linear trend to the recent daily series, project it to
the target date, and compare the projection (with a residual-based confidence
band) to the target — reporting on-track / at-risk / off-track and the current
direction of travel. Honest and simple: a trend line, not a crystal ball, and
labelled as such.

Outputs `target_attainment` insight per business.

Usage:
    python scripts/forecast_targets.py [--write-db]
"""
import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect, upsert_insights          # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")
MODEL_VERSION = "target-trend-v1"


def load_daily(conn):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT w.business_id, biz.name AS business_name, w.visit_date,
                   AVG(w.wait_time_minutes) AS avg_wait,
                   AVG(w.status = 'served') * 100 AS completion_rate,
                   AVG(w.status = 'no_show') * 100 AS no_show_rate
            FROM wait_time_records w
            JOIN businesses biz ON biz.id = w.business_id
            WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
            GROUP BY w.business_id, biz.name, w.visit_date
        """)
        df = pd.DataFrame(cursor.fetchall())
        cursor.execute("""
            SELECT business_id, target_wait_minutes, target_completion_rate,
                   target_no_show_rate, horizon_months, target_date
            FROM business_targets
        """)
        targets = {r["business_id"]: r for r in cursor.fetchall()}
    if not df.empty:
        df["visit_date"] = pd.to_datetime(df["visit_date"])
        for c in ["avg_wait", "completion_rate", "no_show_rate"]:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df, targets


def project(series_df, value_col, horizon_days):
    """Linear trend projection to `horizon_days` ahead, with a ±band."""
    s = series_df.dropna(subset=[value_col]).sort_values("visit_date")
    if len(s) < 5:
        return None
    x = (s["visit_date"] - s["visit_date"].min()).dt.days.to_numpy(dtype=float)
    y = s[value_col].to_numpy(dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    resid_std = float(np.std(y - (slope * x + intercept)))
    x_target = x.max() + horizon_days
    projected = float(slope * x_target + intercept)
    return {
        "current": round(float(y[-3:].mean()), 1),      # smoothed recent value
        "projected": round(projected, 1),
        "band": round(1.96 * resid_std, 1),
        "slope_per_day": round(float(slope), 4),
    }


def assess(metric, proj, target, lower_is_better):
    if proj is None or target is None:
        return None
    p, band = proj["projected"], proj["band"]
    if lower_is_better:
        on_track = p <= target
        best, worst = p - band, p + band
        uncertain = best <= target <= worst
    else:
        on_track = p >= target
        best, worst = p + band, p - band
        uncertain = worst <= target <= best
    status = "on_track" if on_track and not uncertain else ("at_risk" if uncertain else "off_track")
    direction = "improving" if (proj["slope_per_day"] < 0) == lower_is_better else "worsening"
    return {
        "metric": metric,
        "current": proj["current"],
        "projected": proj["projected"],
        "confidence_band": proj["band"],
        "target": target,
        "status": status,
        "trend": direction,
    }


def build_insights(df, targets):
    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(days=1)
    insights = []
    for business_id, dfb in df.groupby("business_id"):
        t = targets.get(business_id)
        if not t:
            continue
        business_name = dfb["business_name"].iloc[0]
        # Days until the target date (fall back to horizon_months from today).
        if t.get("target_date"):
            horizon_days = max(7, (pd.Timestamp(t["target_date"]) - dfb["visit_date"].max()).days)
        else:
            horizon_days = int((t.get("horizon_months") or 6) * 30)

        metrics = []
        for metric, col, target_key, lower, bounds in [
            ("avg_wait_minutes", "avg_wait", "target_wait_minutes", True, (0, None)),
            ("completion_rate_pct", "completion_rate", "target_completion_rate", False, (0, 100)),
            ("no_show_rate_pct", "no_show_rate", "target_no_show_rate", True, (0, 100)),
        ]:
            proj = project(dfb, col, horizon_days)
            if proj:  # clip projection to the metric's real-world range
                lo, hi = bounds
                if lo is not None:
                    proj["projected"] = max(lo, proj["projected"])
                if hi is not None:
                    proj["projected"] = min(hi, proj["projected"])
            row = assess(metric, proj, t.get(target_key), lower)
            if row:
                metrics.append(row)

        off = [m for m in metrics if m["status"] == "off_track"]
        at_risk = [m for m in metrics if m["status"] == "at_risk"]
        if off:
            headline = f"{business_name}: off track on {', '.join(m['metric'] for m in off)}."
        elif at_risk:
            headline = f"{business_name}: at risk on {', '.join(m['metric'] for m in at_risk)}."
        else:
            headline = f"{business_name}: on track to hit all targets by the horizon."

        insights.append({
            "business_id": business_id,
            "insight_type": "target_attainment",
            "insight_data": {
                "summary": headline,
                "method": "linear trend projection to target date (±95% residual band)",
                "horizon_days": horizon_days,
                "metrics": metrics,
            },
            "records_processed": int(len(dfb)),
        })
    return insights, generated_at, stale_after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true")
    args = parser.parse_args()

    conn = connect()
    df, targets = load_daily(conn)
    if df.empty:
        print("No records — cannot project target attainment.")
        return
    if not targets:
        print("No business_targets set — nothing to project against.")
        return

    insights, generated_at, stale_after = build_insights(df, targets)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "target_attainment.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(insights, handle, indent=2, default=str)
    print(f"Wrote {len(insights)} target_attainment insight(s) → {path}")

    if args.write_db:
        upsert_insights(conn, insights, generated_at, stale_after, MODEL_VERSION)
        print("Upserted target_attainment into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
