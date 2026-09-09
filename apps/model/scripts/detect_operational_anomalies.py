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


def friendly_date(iso):
    """"Last Thursday" beats "2026-07-23" for someone reading an alert."""
    try:
        d = pd.Timestamp(iso).date()
    except Exception:
        return str(iso)
    today = datetime.now().date()
    delta = (today - d).days
    if delta <= 0:
        return "today"
    if delta == 1:
        return "yesterday"
    if delta < 7:
        return f"on {d.strftime('%A')}"
    if delta < 14:
        return f"last {d.strftime('%A')}"
    return f"on {d.strftime('%-d %B')}"


# Each measure, written the way somebody would say it out loud. Separate words
# for the up and down case because the same movement is not equally good in
# both directions — a wait getting shorter is good news, visits collapsing is
# not, and calling a 90% drop in customers "better" is worse than saying
# nothing at all.
PHRASING = {
    "avg_wait": {
        "subject": "the average wait", "unit": " minutes", "plural": False,
        "up": "longer than usual", "down": "shorter than usual",
    },
    "avg_service": {
        "subject": "the time each visit took at the counter", "unit": " minutes", "plural": False,
        "up": "longer than usual", "down": "quicker than usual",
    },
    "no_show_rate": {
        "subject": "the no-show rate", "unit": "%", "plural": False,
        "up": "higher than usual", "down": "lower than usual",
    },
    "volume": {
        # A count, so the gap needs a noun ("363 fewer"), not an adjective —
        # "363 quieter than usual" is not a sentence anyone would say.
        "subject": "the number of people served", "unit": "", "plural": False,
        "up": "more people than usual", "down": "fewer people than usual",
    },
    "completion_rate": {
        "subject": "the share of visits completed", "unit": "%", "plural": False,
        "up": "higher than usual", "down": "lower than usual",
    },
}


def headline(branch_name, label, z_score):
    """The line a manager reads first, and the only one they may read.

    The insight carried a `message` and no `title`, so the dashboard fell back
    to printing the bare branch name as the heading — "Kingston - Constant
    Spring" tells somebody scanning a list nothing about whether to act.

    This names the SHAPE of the problem, not the statistic: what is unusual, and
    at which branch. The number and the comparison stay in the message
    underneath, where somebody who has decided to care can find them.
    """
    short = branch_name.split(" - ")[-1].strip() or branch_name
    direction = "Higher Than Usual" if z_score > 0 else "Lower Than Usual"
    return f"{short}: {label.title()} Is {direction}"


def plain_message(branch_name, label, col, value, expected, date_iso):
    """A sentence a branch manager would actually say.

    This used to read "Ocho Rios: service time was 36.8 on 2026-07-23 vs a
    typical 20.7 (z=2.56)" — a statistics readout rather than an alert. No
    z-score, no ISO date, no jargon, and the gap stated in the measure's own
    units. Written as two short sentences because one long one with a dash in
    the middle is harder to scan.
    """
    p = PHRASING.get(col)
    if not p:
        return (f"{branch_name}: {label} {friendly_date(date_iso)} was {value:.1f}, "
                f"against a normal {float(expected):.1f}.")

    value = float(value)
    expected = float(expected)
    unit = p["unit"]
    decimals = 1 if unit == "%" else 0
    fmt = lambda v: f"{v:.{decimals}f}{unit}"

    gap = abs(value - expected)
    how = p["up"] if value > expected else p["down"]

    return (f"{branch_name}: {p['subject']} {friendly_date(date_iso)} was "
            f"{fmt(value)}, against a normal {fmt(expected)}. "
            f"That is {fmt(gap)} {how}.")



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
                        "message": plain_message(branch_name, label, col,
                                                 a["value"], a["expected"], a["date"]),
                        "title": headline(branch_name, label, a["z_score"]),
                        # How far from normal, in the branch's own history — the
                        # deck says "2.3 sigma above your normal Tuesday" and it
                        # is the phrase that makes the claim checkable.
                        "sigma_label": f"{abs(a['z_score']):.1f} sigma from this branch's normal",
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
