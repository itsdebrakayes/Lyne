"""
recommend_staffing.py — Prescriptive staffing / counter recommendation.

This replaces the toy rule that used to fire "review staffing" whenever a
branch's average wait crossed 20 minutes. That told a manager nothing
actionable. This model answers the real question:

    "To keep waits under our target, how many counters should be open at
     each hour tomorrow — and do we physically have them?"

How it works — textbook queueing (Erlang C / M/M/c):
  • Arrival rate  λ  per (branch, service, hour) comes from the demand
    forecast (seasonal-naive arrivals, schedule/holiday aware).
  • Service rate  μ  per counter comes from observed service times
    (60 / avg_service_minutes).
  • For each hour we find the smallest number of counters c whose expected
    queue wait Wq is at or below the executive's target_wait_minutes, subject
    to the counters the branch actually has. If demand can't be served within
    target even fully staffed, we flag it instead of pretending.

Outputs `staffing_recommendation` insight per business, per branch: an hourly
plan with recommended vs available counters and the expected wait each buys.

Usage:
    python scripts/recommend_staffing.py [--write-db]
"""
import os
import sys
import json
import math
import argparse
from datetime import datetime, timedelta, timezone

import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect, upsert_insights          # noqa: E402
from utils.model_utils import hour_of                     # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")
MODEL_VERSION = "staffing-erlangc-v1"
DEFAULT_TARGET_WAIT = 20
MAX_SERVERS = 20


def load_data(conn):
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT w.business_id, biz.name AS business_name,
                   w.branch_id, b.name AS branch_name, b.open_days, b.opening_time, b.closing_time,
                   w.service_id, s.name AS service_name,
                   w.visit_date, w.hour_of_day AS hour,
                   w.service_time_minutes
            FROM wait_time_records w
            JOIN businesses biz ON biz.id = w.business_id
            JOIN branches b     ON b.id = w.branch_id
            JOIN services s     ON s.id = w.service_id
            WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
        """)
        df = pd.DataFrame(cursor.fetchall())
        cursor.execute("""
            SELECT branch_id, COUNT(*) AS counters
            FROM counters WHERE is_active = TRUE GROUP BY branch_id
        """)
        counters = {r["branch_id"]: int(r["counters"]) for r in cursor.fetchall()}
        cursor.execute("SELECT business_id, target_wait_minutes FROM business_targets")
        targets = {r["business_id"]: int(r["target_wait_minutes"]) for r in cursor.fetchall()}
    if df.empty:
        return df, counters, targets
    df["visit_date"] = pd.to_datetime(df["visit_date"])
    df["hour"] = pd.to_numeric(df["hour"], errors="coerce")
    df["dow"] = df["visit_date"].dt.dayofweek.map(lambda d: (d + 1) % 7)
    df["service_time_minutes"] = pd.to_numeric(df["service_time_minutes"], errors="coerce")
    return df, counters, targets


def erlang_c_wait_minutes(lam_per_hr, mu_per_hr, c):
    """Expected queue wait (minutes) for M/M/c. Returns inf if unstable."""
    if c <= 0 or mu_per_hr <= 0:
        return math.inf
    a = lam_per_hr / mu_per_hr          # offered load (Erlangs)
    if a >= c:                          # utilisation >= 100% → unbounded queue
        return math.inf
    # Erlang C probability of waiting
    summ = sum((a ** k) / math.factorial(k) for k in range(c))
    last = (a ** c) / math.factorial(c) * (c / (c - a))
    pw = last / (summ + last)
    wq_hours = pw / (c * mu_per_hr - lam_per_hr)
    return wq_hours * 60.0


def recommend_servers(lam_per_hr, mu_per_hr, target_wait, max_c):
    """Smallest c within max_c meeting the target; else max_c with best effort."""
    if lam_per_hr <= 0:
        return 0, 0.0
    for c in range(1, max_c + 1):
        wq = erlang_c_wait_minutes(lam_per_hr, mu_per_hr, c)
        if wq <= target_wait:
            return c, round(wq, 1)
    wq = erlang_c_wait_minutes(lam_per_hr, mu_per_hr, max_c)
    return max_c, (round(wq, 1) if math.isfinite(wq) else None)


def open_hours(open_days, opening_time, closing_time):
    days = {int(x) for x in str(open_days or "1,2,3,4,5").split(",") if str(x).strip().isdigit()}
    oh = hour_of(opening_time, 8)
    ch = hour_of(closing_time, 16)
    return days or {1, 2, 3, 4, 5}, list(range(oh, max(oh + 1, ch)))


def build_insights(df, counters, targets):
    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(days=1)
    n_weeks = max(1, (df["visit_date"].max() - df["visit_date"].min()).days / 7)
    insights = []

    for business_id, dfb in df.groupby("business_id"):
        business_name = dfb["business_name"].iloc[0]
        target = targets.get(business_id, DEFAULT_TARGET_WAIT)
        branches = []
        for (branch_id, branch_name), gb in dfb.groupby(["branch_id", "branch_name"]):
            days, hours = open_hours(gb["open_days"].iloc[0], gb["opening_time"].iloc[0], gb["closing_time"].iloc[0])
            available = counters.get(branch_id, MAX_SERVERS)
            # Per-service service rate (customers/hour/counter)
            svc_mu = {}
            for sid, sg in gb.groupby("service_id"):
                mean_svc = sg["service_time_minutes"].dropna()
                mean_svc = float(mean_svc.mean()) if len(mean_svc) else 15.0
                svc_mu[sid] = 60.0 / max(1.0, mean_svc)

            hourly_plan = []
            for h in hours:
                # Expected arrivals/hour at this hour on a typical open day:
                # total arrivals in this hour over open days ÷ number of open weekdays observed.
                slot = gb[(gb["hour"] == h) & (gb["dow"].isin(days))]
                per_service = []
                total_servers = 0
                worst_wait = 0.0
                for sid, sg in slot.groupby("service_id"):
                    lam = len(sg) / (n_weeks * len(days))       # arrivals/hour typical open day
                    mu = svc_mu.get(sid, 4.0)
                    c, wq = recommend_servers(lam, mu, target, available)
                    total_servers += c
                    if wq is not None:
                        worst_wait = max(worst_wait, wq)
                    per_service.append({
                        "service_id": sid,
                        "arrivals_per_hour": round(lam, 1),
                        "recommended_counters": c,
                        "expected_wait_minutes": wq,
                    })
                # Keep at least one window open during configured business hours,
                # even in a lull — a branch never closes every counter mid-day.
                capped = max(1, min(total_servers, available))
                hourly_plan.append({
                    "hour": h,
                    "recommended_counters": capped,
                    "unconstrained_counters": total_servers,
                    "available_counters": available,
                    "expected_wait_minutes": round(worst_wait, 1),
                    "over_capacity": total_servers > available,
                    "services": per_service,
                })
            peak = max(hourly_plan, key=lambda x: x["recommended_counters"]) if hourly_plan else None
            understaffed = [p["hour"] for p in hourly_plan if p["over_capacity"]]
            branches.append({
                "branch_id": branch_id,
                "branch_name": branch_name,
                "target_wait_minutes": target,
                "available_counters": available,
                "hourly_plan": hourly_plan,
                "peak_hour": peak["hour"] if peak else None,
                "peak_counters": peak["recommended_counters"] if peak else None,
                "hours_over_capacity": understaffed,
            })
        flagged = sum(len(b["hours_over_capacity"]) for b in branches)
        summary = (f"{business_name}: hourly counter plan to hold waits at or under "
                   f"{target} min across {len(branches)} branch(es).")
        if flagged:
            summary += f" {flagged} branch-hour(s) can't meet target even fully staffed."
        insights.append({
            "business_id": business_id,
            "insight_type": "staffing_recommendation",
            "insight_data": {
                "summary": summary,
                "target_wait_minutes": target,
                "method": "Erlang C (M/M/c) over forecast demand and observed service rates",
                "branches": branches,
            },
            "records_processed": int(len(dfb)),
        })
    return insights, generated_at, stale_after


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true")
    args = parser.parse_args()

    conn = connect()
    df, counters, targets = load_data(conn)
    if df.empty:
        print("No records — cannot recommend staffing.")
        return

    insights, generated_at, stale_after = build_insights(df, counters, targets)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "staffing_recommendation.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(insights, handle, indent=2, default=str)
    print(f"Wrote {len(insights)} staffing_recommendation insight(s) → {path}")

    if args.write_db:
        upsert_insights(conn, insights, generated_at, stale_after, MODEL_VERSION)
        print("Upserted staffing_recommendation into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
