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
# Autoregressive lag features — the signal a flat per-weekday naive baseline
# cannot use. yesterday's volume, and the trailing weekly / monthly averages.
LAG_FEATURES = ["lag1", "roll7", "roll28"]
# The demand model works at the DAILY level (where momentum lives); the intraday
# shape is applied separately. hour is NOT a model feature any more.
DAILY_FEATURES = ["dow", "month", "branch_enc", "service_enc"] + CAL_FEATURES + LAG_FEATURES


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


def to_daily(df, holidays):
    """Collapse hourly arrivals to one row per (branch, service, OPEN day), with
    autoregressive lag features (yesterday's volume + trailing weekly/monthly
    averages). These lags are exactly what a flat per-weekday naive baseline
    cannot use — and the reason the model can beat it once the demand series has
    real day-to-day momentum."""
    keys = ["business_id", "business_name", "branch_id", "branch_name",
            "service_id", "service_name"]
    daily = (df.groupby(keys + ["visit_date"])["arrivals"].sum()
               .rename("arrivals").reset_index()
               .sort_values(["branch_id", "service_id", "visit_date"]))
    daily["dow"] = daily["visit_date"].dt.dayofweek.map(lambda d: (d + 1) % 7)
    daily["month"] = daily["visit_date"].dt.month
    g = daily.groupby(["branch_id", "service_id"])["arrivals"]
    daily["lag1"] = g.shift(1)
    daily["roll7"] = g.transform(lambda s: s.shift(1).rolling(7, min_periods=2).mean())
    daily["roll28"] = g.transform(lambda s: s.shift(1).rolling(28, min_periods=4).mean())
    return _add_features(daily, holidays)


def hourly_shape(df):
    """Mean fraction of a day's arrivals in each hour, per (branch, service). The
    intraday shape is stable/seasonal, so it needs no lag model — we forecast the
    daily total, then spread it across the open hours with this shape."""
    tot = df.groupby(["branch_id", "service_id", "visit_date"])["arrivals"].transform("sum")
    fr = df.assign(frac=df["arrivals"] / tot.replace(0, np.nan))
    return (fr.groupby(["branch_id", "service_id", "hour"])["frac"].mean()
              .rename("frac").reset_index())


def _daily_naive(train):
    """Seasonal-naive daily baseline: mean daily arrivals per branch/service/weekday."""
    return (train.groupby(["branch_id", "service_id", "dow"])["arrivals"].mean()
                 .rename("naive").reset_index())


def _fit_gbr(train):
    enc_b = SafeLabelEncoder().fit(train["branch_id"])
    enc_s = SafeLabelEncoder().fit(train["service_id"])
    t = train.copy()
    t["branch_enc"] = enc_b.transform(t["branch_id"])
    t["service_enc"] = enc_s.transform(t["service_id"])
    gbr = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05,
                                    subsample=0.85, random_state=17)
    gbr.fit(t[DAILY_FEATURES].fillna(0), t["arrivals"])
    return gbr, enc_b, enc_s


def backtest(daily):
    """Temporal holdout: fit the lag model on the earlier window, compare its MAE
    on the most recent HOLDOUT_DAYS against the seasonal-naive baseline, and pick
    whichever actually wins — reporting both, honestly."""
    cutoff = daily["visit_date"].max() - pd.Timedelta(days=HOLDOUT_DAYS)
    train = daily[daily["visit_date"] <= cutoff].dropna(subset=LAG_FEATURES).copy()
    test = daily[daily["visit_date"] > cutoff].copy()
    if len(train) < 80 or test.empty:
        return None

    gbr, enc_b, enc_s = _fit_gbr(train)
    test["branch_enc"] = enc_b.transform(test["branch_id"])
    test["service_enc"] = enc_s.transform(test["service_id"])
    test = test.assign(pred_model=np.clip(gbr.predict(test[DAILY_FEATURES].fillna(0)), 0, None))

    naive = _daily_naive(train)
    test = test.merge(naive, on=["branch_id", "service_id", "dow"], how="left")
    test["naive"] = test["naive"].fillna(train["arrivals"].mean())

    model_mae = round(float(mean_absolute_error(test["arrivals"], test["pred_model"])), 3)
    naive_mae = round(float(mean_absolute_error(test["arrivals"], test["naive"])), 3)
    return {
        "gbr_mae": model_mae,
        "seasonal_naive_mae": naive_mae,
        "chosen": "gbr" if model_mae < naive_mae else "seasonal_naive",
        "improvement_pct": round((naive_mae - model_mae) / naive_mae * 100, 1) if naive_mae else 0.0,
        "holdout_days": HOLDOUT_DAYS,
        "test_rows": int(len(test)),
    }


def forecast(daily, df, holidays, branch_cal, chosen):
    """Roll the chosen model forward HORIZON_DAYS, RECURSIVELY — each predicted
    day becomes the lag for the next — then spread each day's predicted total
    across the open hours with the stable intraday shape. (The previous version
    always used naive even when the backtest said the model won; this uses the
    actual winner.)"""
    if daily.empty:
        return pd.DataFrame()
    gbr, enc_b, enc_s = _fit_gbr(daily.dropna(subset=LAG_FEATURES)) if chosen == "gbr" else (None, None, None)
    naive = _daily_naive(daily).set_index(["branch_id", "service_id", "dow"])["naive"]
    shape = hourly_shape(df)
    holiday_set = {pd.Timestamp(h).normalize() for h in holidays}
    start = daily["visit_date"].max().normalize() + pd.Timedelta(days=1)

    combos = daily[["business_id", "business_name", "branch_id", "branch_name",
                    "service_id", "service_name"]].drop_duplicates()
    rows = []
    for _, c in combos.iterrows():
        bid, sid = c["branch_id"], c["service_id"]
        cal = branch_cal.get(bid, {"days": {1, 2, 3, 4, 5}, "hours": list(range(8, 16))})
        hist = list(daily[(daily.branch_id == bid) & (daily.service_id == sid)]
                    .sort_values("visit_date")["arrivals"].astype(float))
        if not hist:
            continue
        b_enc = int(enc_b.transform([bid])[0]) if gbr is not None else 0
        s_enc = int(enc_s.transform([sid])[0]) if gbr is not None else 0
        sh = shape[(shape.branch_id == bid) & (shape.service_id == sid)]
        sh = sh[sh.hour.isin(cal["hours"])]

        for i in range(HORIZON_DAYS):
            d = start + pd.Timedelta(days=i)
            schema_dow = (d.dayofweek + 1) % 7
            if schema_dow not in cal["days"] or d.normalize() in holiday_set:
                continue
            if gbr is not None:
                feat = _add_features(pd.DataFrame([{
                    "visit_date": d, "dow": schema_dow, "month": d.month,
                    "branch_enc": b_enc, "service_enc": s_enc,
                    "lag1": hist[-1], "roll7": float(np.mean(hist[-7:])),
                    "roll28": float(np.mean(hist[-28:])),
                }]), holidays)
                pred = float(np.clip(gbr.predict(feat[DAILY_FEATURES].fillna(0))[0], 0, None))
            else:
                pred = float(naive.get((bid, sid, schema_dow), np.mean(hist)))
            hist.append(pred)
            denom = sh["frac"].sum()
            for _, hr in sh.iterrows():
                w = (hr["frac"] / denom) if denom else (1.0 / max(1, len(cal["hours"])))
                rows.append({**c.to_dict(), "visit_date": d, "hour": int(hr["hour"]),
                             "dow": schema_dow, "month": d.month,
                             "predicted_arrivals": round(pred * w, 2)})
    if not rows:
        return pd.DataFrame()
    return _add_features(pd.DataFrame(rows), holidays)


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
        method = ("gradient boosting on autoregressive lags (schedule + holiday aware)"
                  if chosen == "gbr" else "seasonal-naive (schedule + holiday aware)")
        insights.append({
            "business_id": business_id,
            "insight_type": "demand_forecast",
            "insight_data": {
                "summary": summary,
                "horizon_days": HORIZON_DAYS,
                "method": f"{method}; backtest winner: {chosen}",
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

    daily = to_daily(df, holidays)
    bt = backtest(daily)
    chosen = (bt or {}).get("chosen", "seasonal_naive")
    fut = forecast(daily, df, holidays, branch_cal, chosen)
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
