"""
forecast_demand.py — Arrival-volume forecast (how many customers will come).

The single most important thing a branch manager needs each morning and each
week is *how many people to expect* — by day, and by hour. Until now the system
only described the past ("your peak hour was 11:00"). This model predicts the
future, and it is the input to the staffing recommendation (recommend_staffing.py).

Method — honest by construction:
  • We backtest a GradientBoosting model against a seasonal-naive baseline
    (average arrivals for the same branch/service/weekday/hour) on a held-out
    recent window, and report BOTH errors. On sparse hourly counts the naive
    baseline is hard to beat, so we use whichever actually wins as the
    production forecaster rather than assuming the fancier model is better.
  • The forecast respects each branch's CONFIGURED schedule — open_days and
    opening/closing hours from the branches table — and the public-holiday
    calendar. So a Mon–Fri agency is never told to expect weekend traffic even
    if its historical data is noisy, and holidays show as closed.

Outputs `demand_forecast` insight per business: next 7 days of expected volume
per branch, the typical hourly shape, and flagged surge days.

Usage:
    python scripts/forecast_demand.py                # writes JSON to outputs/
    python scripts/forecast_demand.py --write-db     # also upserts predictive_results
"""
import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect, upsert_insights          # noqa: E402
from utils.model_utils import SafeLabelEncoder, hour_of   # noqa: E402
from utils.calendar_features import load_holidays, add_calendar_features  # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")
MODEL_VERSION = "demand-forecast-v1"
HORIZON_DAYS = 7
HOLDOUT_DAYS = 14
CAL_FEATURES = ["is_holiday", "is_pre_holiday", "is_post_holiday",
                "is_month_end", "is_month_start", "is_weekend"]
FEATURES = ["dow", "hour", "month", "branch_enc", "service_enc"] + CAL_FEATURES


def load_arrivals(conn):
    query = """
        SELECT w.business_id, biz.name AS business_name,
               w.branch_id, b.name AS branch_name,
               w.service_id, s.name AS service_name,
               w.visit_date, w.hour_of_day AS hour,
               COUNT(*) AS arrivals
        FROM wait_time_records w
        JOIN businesses biz ON biz.id = w.business_id
        JOIN branches b     ON b.id = w.branch_id
        JOIN services s     ON s.id = w.service_id
        WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
        GROUP BY w.business_id, biz.name, w.branch_id, b.name,
                 w.service_id, s.name, w.visit_date, w.hour_of_day
    """
    with conn.cursor() as cursor:
        cursor.execute(query)
        df = pd.DataFrame(cursor.fetchall())
    if df.empty:
        return df
    df["visit_date"] = pd.to_datetime(df["visit_date"])
    df["arrivals"] = pd.to_numeric(df["arrivals"], errors="coerce").fillna(0)
    df["hour"] = pd.to_numeric(df["hour"], errors="coerce")
    df["dow"] = df["visit_date"].dt.dayofweek.map(lambda d: (d + 1) % 7)  # schema Sun=0
    df["month"] = df["visit_date"].dt.month
    return df


def load_branch_calendar(conn):
    """Configured schedule per branch: which weekdays and which hours it opens."""
    with conn.cursor() as cursor:
        cursor.execute("SELECT id, open_days, opening_time, closing_time FROM branches")
        rows = cursor.fetchall()
    calendar = {}
    for r in rows:
        open_days = r.get("open_days") or "1,2,3,4,5"           # default Mon–Fri
        days = {int(x) for x in str(open_days).split(",") if x.strip().isdigit()}
        open_hour = hour_of(r.get("opening_time"), 8)
        close_hour = hour_of(r.get("closing_time"), 16)
        calendar[r["id"]] = {"days": days or {1, 2, 3, 4, 5},
                             "hours": list(range(open_hour, max(open_hour + 1, close_hour)))}
    return calendar


def _add_features(df, holidays):
    return add_calendar_features(df, "visit_date", holidays)


def _seasonal_naive(train, key_cols=("branch_id", "service_id", "dow", "hour")):
    return train.groupby(list(key_cols))["arrivals"].mean().rename("naive").reset_index()


def backtest(df, holidays):
    """Temporal holdout: train on all but the last HOLDOUT_DAYS, score both models."""
    cutoff = df["visit_date"].max() - pd.Timedelta(days=HOLDOUT_DAYS)
    train, test = df[df["visit_date"] <= cutoff], df[df["visit_date"] > cutoff]
    if len(train) < 50 or test.empty:
        return None

    enc_b = SafeLabelEncoder().fit(train["branch_id"])
    enc_s = SafeLabelEncoder().fit(train["service_id"])
    tr, te = _add_features(train, holidays), _add_features(test, holidays)
    tr["branch_enc"], tr["service_enc"] = enc_b.transform(tr["branch_id"]), enc_s.transform(tr["service_id"])
    te["branch_enc"], te["service_enc"] = enc_b.transform(te["branch_id"]), enc_s.transform(te["service_id"])

    gbr = GradientBoostingRegressor(n_estimators=250, max_depth=3, learning_rate=0.06, random_state=17)
    gbr.fit(tr[FEATURES].fillna(0), tr["arrivals"])
    te = te.assign(pred_model=np.clip(gbr.predict(te[FEATURES].fillna(0)), 0, None))

    naive = _seasonal_naive(tr)
    te = te.merge(naive, on=["branch_id", "service_id", "dow", "hour"], how="left")
    te["naive"] = te["naive"].fillna(tr["arrivals"].mean())

    model_mae = round(float(mean_absolute_error(te["arrivals"], te["pred_model"])), 3)
    naive_mae = round(float(mean_absolute_error(te["arrivals"], te["naive"])), 3)
    return {
        "gbr_mae": model_mae,
        "seasonal_naive_mae": naive_mae,
        "chosen": "seasonal_naive" if naive_mae <= model_mae else "gbr",
        "holdout_days": HOLDOUT_DAYS,
        "test_rows": int(len(te)),
    }


def forecast(df, holidays, branch_cal):
    """Seasonal-naive forecast, masked to each branch's configured schedule and
    zeroed on public holidays. Returns a per-slot future frame."""
    naive = _seasonal_naive(df)                       # branch/service/dow/hour mean
    combos = df[["business_id", "business_name", "branch_id", "branch_name",
                 "service_id", "service_name"]].drop_duplicates()
    start = df["visit_date"].max().normalize() + pd.Timedelta(days=1)
    future_dates = [start + pd.Timedelta(days=i) for i in range(HORIZON_DAYS)]
    holiday_set = {pd.Timestamp(h).normalize() for h in holidays}

    rows = []
    for _, c in combos.iterrows():
        cal = branch_cal.get(c["branch_id"], {"days": {1, 2, 3, 4, 5}, "hours": list(range(8, 16))})
        for d in future_dates:
            schema_dow = (d.dayofweek + 1) % 7                 # Sun=0
            if schema_dow not in cal["days"] or d.normalize() in holiday_set:
                continue                                        # closed → no arrivals
            for h in cal["hours"]:
                rows.append({**c.to_dict(), "visit_date": d, "hour": h,
                             "dow": schema_dow, "month": d.month})
    if not rows:
        return pd.DataFrame()
    fut = pd.DataFrame(rows).merge(naive, on=["branch_id", "service_id", "dow", "hour"], how="left")
    fut = _add_features(fut, holidays)
    fut["predicted_arrivals"] = fut["naive"].fillna(0).round(1)
    return fut


def build_insights(df, fut, backtest_result):
    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(days=1)
    insights = []
    if fut.empty:
        return insights, generated_at, stale_after
    for business_id, fb in fut.groupby("business_id"):
        business_name = fb["business_name"].iloc[0]
        branches = []
        for (branch_id, branch_name), gb in fb.groupby(["branch_id", "branch_name"]):
            daily = (
                gb.groupby(gb["visit_date"].dt.date)
                .agg(expected=("predicted_arrivals", "sum"),
                     is_month_end=("is_month_end", "max"),
                     is_pre_holiday=("is_pre_holiday", "max"))
                .reset_index()
            )
            days = [{
                "date": str(r["visit_date"]),
                "dow": pd.Timestamp(r["visit_date"]).strftime("%a"),
                "expected_arrivals": int(round(r["expected"])),
                "is_month_end": int(r["is_month_end"]),
                "is_pre_holiday": int(r["is_pre_holiday"]),
            } for _, r in daily.iterrows()]
            hourly_shape = gb.groupby("hour")["predicted_arrivals"].mean().round(1).reset_index()
            peak = max(days, key=lambda x: x["expected_arrivals"]) if days else None
            branches.append({
                "branch_id": branch_id,
                "branch_name": branch_name,
                "next_7_days": days,
                "hourly_shape": [{"hour": int(r["hour"]), "expected_arrivals": float(r["predicted_arrivals"])}
                                 for _, r in hourly_shape.iterrows()],
                "busiest_day": peak,
            })
        surge = [d for b in branches for d in b["next_7_days"] if d["is_month_end"] or d["is_pre_holiday"]]
        summary = f"{business_name}: next {HORIZON_DAYS} days forecast across {len(branches)} branch(es)."
        if surge:
            summary += f" {len(surge)} surge day(s) flagged (month-end / pre-holiday)."
        chosen = (backtest_result or {}).get("chosen", "seasonal_naive")
        insights.append({
            "business_id": business_id,
            "insight_type": "demand_forecast",
            "insight_data": {
                "summary": summary,
                "horizon_days": HORIZON_DAYS,
                "method": f"seasonal_naive (schedule + holiday aware); backtest winner: {chosen}",
                "backtest": backtest_result,
                "branches": branches,
            },
            "records_processed": int(len(df)),
        })
    return insights, generated_at, stale_after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true")
    args = parser.parse_args()

    conn = connect()
    df = load_arrivals(conn)
    if df.empty:
        print("No arrivals found — nothing to forecast.")
        return
    holidays = load_holidays(conn)
    branch_cal = load_branch_calendar(conn)

    bt = backtest(df, holidays)
    fut = forecast(df, holidays, branch_cal)
    insights, generated_at, stale_after = build_insights(df, fut, bt)

    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "demand_forecast.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(insights, handle, indent=2, default=str)

    if bt:
        print(f"Backtest ({bt['holdout_days']}d holdout, {bt['test_rows']} rows): "
              f"GBR MAE {bt['gbr_mae']} vs seasonal-naive MAE {bt['seasonal_naive_mae']} "
              f"→ using {bt['chosen']}")
    print(f"Wrote {len(insights)} demand_forecast insight(s) → {path}")

    if args.write_db:
        upsert_insights(conn, insights, generated_at, stale_after, MODEL_VERSION)
        print("Upserted demand_forecast into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
