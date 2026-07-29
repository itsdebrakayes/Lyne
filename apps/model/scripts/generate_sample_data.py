"""
generate_sample_data.py — Realistic demo history for the ML layer.

The original demo seed was near-uniform: similar volume every day (weekends
included), no holiday closures, and no relationship between queue length and
wait, or between anything and no-shows. Sound models had nothing to learn, so
they scored poorly and the seasonal-naive baseline beat the forecast.

This regenerates `wait_time_records` (the ML input table) with the structure a
real government-agency queue actually has, so the models have genuine signal:

  • Calendar structure — weekday-only per each branch's open_days, closed on
    public holidays, heavier on Mondays/Fridays, month-end and pre-holiday
    surges. (Lets the demand forecast beat a naive baseline.)
  • A believable intraday curve — mid-morning peak, lunch dip.
  • queue_length → wait — wait grows with the line and the service's base time
    and shrinks with counters open. (Gives the wait model real R².)
  • no-show → conditions — abandonment rises with wait, queue length, late hour,
    and walk-in channel. (Gives the no-show classifier real AUC.)

It preserves everything else (businesses, branches, services, staff, and the
live demo queue tickets) — only the historical ML rows are rebuilt.

Usage:
    python scripts/generate_sample_data.py --days 120
"""
import os
import sys
import argparse
import math
import uuid
from datetime import date, timedelta

import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect                              # noqa: E402
from utils.calendar_features import load_holidays, is_month_end  # noqa: E402

# Deterministic so re-runs are reproducible (Math.random is fine here — not the workflow engine).
RNG = np.random.default_rng(42)

# Intraday shape (relative weight per hour) — morning peak, lunch dip.
HOUR_WEIGHTS = {8: 0.6, 9: 1.3, 10: 1.4, 11: 1.15, 12: 0.55,
                13: 0.9, 14: 1.0, 15: 0.75, 16: 0.4}

# A few flagship (Kingston) branches run chronically over capacity — long waits,
# high no-shows — while the rest are moderate/healthy. This gives the dashboards
# a real stressed-vs-healthy contrast to show and for the models to explain,
# instead of every branch reading the same. (Decision 2026-07-22.)
STRESSED_BRANCHES = {"br-taj-kgn", "br-pica-kgn", "br-nht-kgn"}

# A short, deliberate service SLOWDOWN at one otherwise-healthy branch on the
# most recent couple of days — so the anomaly detector's service-time metric has
# a real chronic productivity pause to catch (the trend companion to the live
# "windows needing attention" board).
SLOW_SERVICE_BRANCH = "br-taj-och"
SLOW_SERVICE_DAYS = 2
SLOW_SERVICE_FACTOR = 1.9

# Demand momentum. Daily volume is not independent day-to-day: it carries an
# AR(1) drift ON TOP OF the calendar pattern (dow / month-end / pre-holiday).
# Seasonal-naive only sees the day-of-week average, so this persistent drift is
# exactly the signal the reworked demand model's lag features exploit to beat
# the naive baseline honestly. Without it, lag features have nothing to learn.
AR_PHI = 0.8      # how much of recent demand level carries into today
AR_SIGMA = 0.14   # size of the day-to-day shock


def load_scope(conn):
    """Valid (business, branch, service) combos + schedule + base service time.

    Derived from the ACTIVE COUNTERS (a counter is a branch×service window), so
    it works on a fresh volume before any history exists — not from
    wait_time_records, which would be empty on first bring-up."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT s.business_id, c.branch_id, c.service_id,
                   s.base_avg_time_minutes AS base_time,
                   b.open_days, b.opening_time, b.closing_time,
                   COUNT(*) AS counters
            FROM counters c
            JOIN services s ON s.id = c.service_id
            JOIN branches b ON b.id = c.branch_id
            WHERE c.is_active = TRUE AND b.is_active = TRUE AND s.is_active = TRUE
            GROUP BY s.business_id, c.branch_id, c.service_id,
                     s.base_avg_time_minutes, b.open_days, b.opening_time, b.closing_time
        """)
        return cur.fetchall()


def _hours(opening, closing):
    from utils.model_utils import hour_of
    oh, ch = hour_of(opening, 8), hour_of(closing, 16)
    return [h for h in range(oh, ch) if h in HOUR_WEIGHTS]


def _open_days(open_days):
    return {int(x) for x in str(open_days or "1,2,3,4,5").split(",") if str(x).strip().isdigit()} or {1, 2, 3, 4, 5}


def day_factor(d, holiday_set):
    """Volume multiplier for the whole day from the calendar."""
    f = 1.0
    wd = d.weekday()                       # Mon=0..Sun=6
    if wd in (0, 4):                       # Monday / Friday busier
        f *= 1.18
    if is_month_end(d):                    # month-end deadline crunch
        f *= 1.4
    if d.day <= 2:                         # start-of-month
        f *= 1.15
    if (d + timedelta(days=1)) in holiday_set:   # day before a holiday
        f *= 1.45
    if (d - timedelta(days=1)) in holiday_set:   # day after a holiday
        f *= 1.25
    return f


def simulate_hour(n_arrivals, base_time, counters):
    """Yield (queue_length_at_join, wait, service_time) for each arrival in an hour.

    Proper M/D/c-style buildup: arrivals land across the hour; counters serve at a
    fixed rate; the line seen at join is arrivals-so-far minus served-so-far. When
    arrivals outpace capacity (peak / understaffed) the queue genuinely grows to
    10–25, and wait grows with it — the correlation the models need to learn."""
    times = np.sort(RNG.uniform(0, 60, n_arrivals))
    cap_per_min = counters / max(1.0, base_time)       # customers served per minute
    per_counter_min = base_time / max(1, counters)
    rows = []
    for i, t in enumerate(times):
        served_so_far = cap_per_min * t
        q = max(0, int(round(i - served_so_far + RNG.normal(0, 0.8))))
        service_time = max(1.0, RNG.lognormal(math.log(max(1.0, base_time)), 0.28))
        wait = q * per_counter_min * RNG.uniform(0.85, 1.2) + RNG.uniform(0, base_time * 0.2)
        rows.append((q, round(min(wait, 240), 2), round(service_time, 2)))
    return rows


def abandon_status(wait, queue_len, hour, is_walk_in):
    """Probabilistic outcome — abandonment rises with wait/queue/late-hour/walk-in."""
    z = -3.4 + 0.03 * wait + 0.05 * queue_len + (0.3 if is_walk_in else 0.0) + (0.4 if hour >= 15 else 0.0)
    p = 1 / (1 + math.exp(-z))
    if RNG.random() < p:
        return RNG.choice(["no_show", "left", "cancelled"], p=[0.5, 0.3, 0.2])
    return "served"


def generate(scope, holiday_set, start, end):
    rows = []
    for combo in scope:
        open_days = _open_days(combo["open_days"])
        hours = _hours(combo["opening_time"], combo["closing_time"])
        if not hours:
            continue
        base_time = float(combo["base_time"] or 15)
        counters_avail = int(combo["counters"] or 3)
        weights = np.array([HOUR_WEIGHTS[h] for h in hours], dtype=float)
        weights /= weights.sum()

        # Stressed branches see heavier footfall AND let the line outrun the
        # counters harder (staff lag further behind peak load), so their waits
        # and abandonment climb well above the moderate branches'.
        stressed = combo["branch_id"] in STRESSED_BRANCHES
        daily_base = RNG.uniform(40, 64) if stressed else RNG.uniform(18, 40)
        counter_lag = 15 if stressed else 10    # bigger = counters lag load more

        # AR(1) demand level, persistent across this combo's days. Seeded off its
        # own random walk so each branch/service has its own momentum history.
        level = 1.0
        d = start
        while d <= end:
            schema_dow = (d.weekday() + 1) % 7   # Sun=0..Sat=6
            if schema_dow not in open_days or d in holiday_set:
                d += timedelta(days=1)
                continue
            # today's level = φ·(recent level) + (1-φ)·baseline + shock, clipped
            level = float(np.clip(AR_PHI * level + (1 - AR_PHI) + RNG.normal(0, AR_SIGMA), 0.55, 1.7))
            day_total = max(0, int(RNG.poisson(daily_base * day_factor(d, holiday_set) * level)))
            per_hour = RNG.multinomial(day_total, weights) if day_total else [0] * len(hours)
            for h, n in zip(hours, per_hour):
                if n <= 0:
                    continue
                # Counters lag load (agencies rarely staff to peak), so busy hours
                # build real queues (10–25) instead of clearing instantly.
                counters_open = max(1, min(counters_avail, int(round(n / counter_lag)) + 1))
                for q, wait, svc in simulate_hour(int(n), base_time, counters_open):
                    is_app = RNG.random() < 0.35
                    channel = "app" if is_app else "walk_in"
                    status = abandon_status(wait, q, h, not is_app)
                    # a walk-away logs the wait endured; a served visit logs service time
                    slow = (SLOW_SERVICE_FACTOR
                            if combo["branch_id"] == SLOW_SERVICE_BRANCH and (end - d).days < SLOW_SERVICE_DAYS
                            else 1.0)
                    svc_time = round(svc * slow, 2) if status == "served" else None
                    rows.append((
                        str(uuid.uuid4()), str(uuid.uuid4()),        # id, orphan ticket_id (matches existing seed)
                        combo["business_id"], combo["branch_id"], combo["service_id"],
                        d.isoformat(), schema_dow, h, d.month,
                        round(wait, 2), svc_time, status, channel,
                        counters_open + int(RNG.integers(0, 3)), q, counters_open,
                    ))
            d += timedelta(days=1)
    return rows


INSERT = """
INSERT INTO wait_time_records
  (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week,
   hour_of_day, month_of_year, wait_time_minutes, service_time_minutes, status,
   channel, staff_count_at_time, queue_length_at_time, active_counters_at_time)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=120)
    parser.add_argument("--keep", action="store_true", help="append instead of clearing history")
    args = parser.parse_args()

    conn = connect()
    scope = load_scope(conn)
    if not scope:
        print("No branch/service combos found — seed the base demo first.")
        return
    holidays = load_holidays(conn)
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=args.days)

    rows = generate(scope, holidays, start, end)
    print(f"Generated {len(rows):,} wait_time_records across {len(scope)} branch/service combos "
          f"({start} → {end}).")

    with conn.cursor() as cur:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        if not args.keep:
            cur.execute("TRUNCATE TABLE wait_time_records")
        for i in range(0, len(rows), 2000):
            cur.executemany(INSERT, rows[i:i + 2000])
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, COUNT(*) n FROM wait_time_records GROUP BY status")
        dist = {r["status"]: r["n"] for r in cur.fetchall()}
        cur.execute("SELECT ROUND(AVG(wait_time_minutes),1) w FROM wait_time_records WHERE status='served'")
        avg_wait = cur.fetchone()["w"]
    total = sum(dist.values())
    abandon = sum(v for k, v in dist.items() if k in ("no_show", "left", "cancelled"))
    print(f"Inserted. status={dist}")
    print(f"avg served wait ≈ {avg_wait} min | abandon rate ≈ {round(abandon/max(1,total)*100,1)}%")

    # Verify the stressed-vs-healthy contrast the demo is meant to show.
    with conn.cursor() as cur:
        cur.execute("""
            SELECT branch_id,
                   ROUND(AVG(CASE WHEN status='served' THEN wait_time_minutes END), 1) AS avg_wait,
                   ROUND(100 * AVG(status IN ('no_show','left','cancelled')), 1) AS abandon_pct,
                   COUNT(*) AS n
            FROM wait_time_records GROUP BY branch_id ORDER BY avg_wait DESC
        """)
        print("\n  branch                avg_wait  abandon%   rows   tier")
        for r in cur.fetchall():
            tier = "STRESSED" if r["branch_id"] in STRESSED_BRANCHES else "moderate"
            print(f"  {r['branch_id']:<20} {str(r['avg_wait']):>7}  {str(r['abandon_pct']):>7}  {r['n']:>6}   {tier}")
    conn.close()


if __name__ == "__main__":
    main()
