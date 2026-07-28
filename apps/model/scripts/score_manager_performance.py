"""
score_manager_performance.py — Score each branch manager on how their branch runs.

The admin app has always asked for a `manager_performance` insight, but nothing
produced one: the pipeline this replaced was retired during the model overhaul
and the insight went with it. The Executive "Managers" tab and the overview's
branch table have been reading an empty array ever since.

This restores it, and does so from the same measures the rest of the system
judges against, so a manager's score can be traced back to numbers they already
see on their own dashboard:

    wait control      the branch's average wait against the target in force
    completion        share of people who joined and were actually served
    no-show control   people who took a ticket and never answered the call
    staff utilisation share of the branch's line staff who actually served

The four are equally weighted and each is capped at 1.0, so a manager cannot
offset a bad wait time by being spectacular somewhere else — which is the point,
because a customer standing in the queue does not care about the average.

A branch target overrides the company target where one is set, so a manager is
scored against the number they are actually held to.

Outputs one `manager_performance` insight per business.

Usage:
    python scripts/score_manager_performance.py [--write-db] [--days 30]
"""
import os
import sys
import json
import argparse
from datetime import datetime, timedelta, timezone

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils.dbio import connect, upsert_insights  # noqa: E402

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs", "admin")
MODEL_VERSION = "manager-score-v1"
DEFAULT_DAYS = 30

# Used only where a business has set no target of its own.
FALLBACK_WAIT = 20.0
FALLBACK_COMPLETION = 85.0
FALLBACK_NO_SHOW = 10.0


def clamp01(v):
    return max(0.0, min(1.0, v))


def load_managers(conn):
    """Every manager, with the branch they are accountable for."""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT s.id           AS manager_id,
                   s.full_name    AS manager_name,
                   s.staff_code   AS staff_code,
                   s.business_id  AS business_id,
                   s.branch_id    AS branch_id,
                   b.name         AS branch_name,
                   biz.name       AS business_name
            FROM staff s
            JOIN roles r      ON r.id = s.role_id AND r.name = 'manager'
            LEFT JOIN branches b   ON b.id = s.branch_id
            LEFT JOIN businesses biz ON biz.id = s.business_id
            WHERE s.is_active = 1 AND s.branch_id IS NOT NULL
        """)
        return cursor.fetchall()


def load_branch_stats(conn, days):
    """Visit outcomes per branch over the window."""
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT w.business_id, w.branch_id,
                   COUNT(*)                             AS total_visits,
                   SUM(w.status = 'served')             AS completed_count,
                   SUM(w.status = 'no_show')            AS no_show_count,
                   ROUND(AVG(w.wait_time_minutes), 1)   AS avg_wait_minutes,
                   ROUND(AVG(w.service_time_minutes), 1) AS avg_service_minutes
            FROM wait_time_records w
            WHERE w.visit_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY w.business_id, w.branch_id
        """, (days,))
        return {(r["business_id"], r["branch_id"]): r for r in cursor.fetchall()}


def load_utilisation(conn, days):
    """Share of a branch's line staff who actually served anyone in the window.

    A manager who leaves half the counters dark on a busy day is running the
    branch differently from one who does not, and nothing else in the score
    captures that.
    """
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT s.branch_id,
                   COUNT(DISTINCT s.id) AS line_staff
            FROM staff s
            JOIN roles r ON r.id = s.role_id AND r.name = 'line_staff'
            WHERE s.is_active = 1 AND s.branch_id IS NOT NULL
            GROUP BY s.branch_id
        """)
        rostered = {r["branch_id"]: int(r["line_staff"] or 0) for r in cursor.fetchall()}

        cursor.execute("""
            SELECT c.branch_id,
                   COUNT(DISTINCT t.served_by_staff_id) AS active_staff
            FROM queue_tickets t
            JOIN counters c ON c.id = t.served_at_counter_id
            JOIN queues q   ON q.id = t.queue_id
            WHERE t.served_by_staff_id IS NOT NULL
              AND q.queue_date >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            GROUP BY c.branch_id
        """, (days,))
        active = {r["branch_id"]: int(r["active_staff"] or 0) for r in cursor.fetchall()}

    # A branch with NO attributed tickets at all is one we cannot measure, not
    # one where nobody worked: the historical volume lives in wait_time_records,
    # which carries no per-staff attribution. Returning 0.0 there would dock a
    # manager a quarter of their score for a gap in the data, so those branches
    # are left out entirely and the score is averaged over what is knowable.
    out = {}
    for branch_id, total in rostered.items():
        if not total or branch_id not in active:
            continue
        out[branch_id] = round(clamp01(active[branch_id] / total) * 100, 1)
    return out


def load_targets(conn):
    """Company targets, and any branch override, keyed for quick lookup."""
    with conn.cursor() as cursor:
        cursor.execute("""SELECT business_id, target_wait_minutes, target_completion_rate,
                                 target_no_show_rate FROM business_targets""")
        company = {r["business_id"]: r for r in cursor.fetchall()}
        cursor.execute("""SELECT branch_id, target_wait_minutes, target_completion_rate,
                                 target_no_show_rate FROM branch_targets""")
        branch = {r["branch_id"]: r for r in cursor.fetchall()}
    return company, branch


def effective(company_row, branch_row, key, fallback):
    """A branch target wins where it is set — a manager is scored against the
    number they are actually held to, not a company average they were exempted
    from."""
    for row in (branch_row, company_row):
        if row and row.get(key) is not None:
            try:
                v = float(row[key])
                if v > 0:
                    return v
            except (TypeError, ValueError):
                pass
    return fallback


def score_one(stats, utilisation, t_wait, t_completion, t_no_show):
    total = int(stats["total_visits"] or 0)
    if total <= 0:
        return None

    completed = int(stats["completed_count"] or 0)
    no_shows = int(stats["no_show_count"] or 0)
    avg_wait = float(stats["avg_wait_minutes"] or 0)
    avg_service = float(stats["avg_service_minutes"] or 0)

    completion_rate = round(completed / total * 100, 1)
    no_show_rate = round(no_shows / total * 100, 1)

    # Each part is "how close to the target, capped at meeting it".
    wait_part = clamp01(t_wait / avg_wait) if avg_wait > 0 else 1.0
    completion_part = clamp01(completion_rate / t_completion) if t_completion > 0 else 0.0
    no_show_part = clamp01(t_no_show / no_show_rate) if no_show_rate > 0 else 1.0

    parts = {
        "wait": round(wait_part * 100),
        "done": round(completion_part * 100),
        "noshow": round(no_show_part * 100),
    }
    used = [wait_part, completion_part, no_show_part]

    # Utilisation only counts where it can actually be measured.
    if utilisation is not None:
        util_part = clamp01(utilisation / 100.0)
        parts["staffing"] = round(util_part * 100)
        used.append(util_part)

    score = round(sum(used) / len(used) * 100)

    return {
        "total_visits": total,
        "completed_count": completed,
        "no_show_count": no_shows,
        "avg_wait_minutes": avg_wait,
        "avg_service_minutes": avg_service,
        "completion_rate": completion_rate,
        "no_show_rate": no_show_rate,
        "staff_utilization": utilisation,
        "manager_score": score,
        # The components, so the dashboard can show what made the number rather
        # than an unexplained score out of 100. `measures_used` says how many
        # went into it, so a 3-of-4 score is never passed off as a 4-of-4 one.
        "parts": parts,
        "measures_used": len(used),
    }


def reason_for(row, t_wait):
    """One plain-English sentence. No z-scores, no formulas."""
    parts = row["parts"]
    weakest = min(parts, key=parts.get)
    labels = {
        "wait": f"Average wait is {row['avg_wait_minutes']:.0f} minutes against a target of {t_wait:.0f}.",
        "done": f"{row['completion_rate']:.0f}% of people who joined were served.",
        "noshow": f"{row['no_show_rate']:.1f}% of tickets were never answered.",
    }
    if row.get("staff_utilization") is not None:
        labels["staffing"] = f"{row['staff_utilization']:.0f}% of the branch's line staff served anyone in this period."
    label = labels[weakest]
    if row["manager_score"] >= 80:
        return f"Running well across the board. Weakest measure: {label.lower()}"
    return f"Biggest drag on this score: {label}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-db", action="store_true")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS)
    args = parser.parse_args()

    conn = connect()
    managers = load_managers(conn)
    stats = load_branch_stats(conn, args.days)
    utilisation = load_utilisation(conn, args.days)
    company_targets, branch_targets = load_targets(conn)

    by_business = {}
    records = 0

    for m in managers:
        key = (m["business_id"], m["branch_id"])
        branch_stats = stats.get(key)
        if not branch_stats:
            continue

        t_wait = effective(company_targets.get(m["business_id"]), branch_targets.get(m["branch_id"]),
                           "target_wait_minutes", FALLBACK_WAIT)
        t_completion = effective(company_targets.get(m["business_id"]), branch_targets.get(m["branch_id"]),
                                 "target_completion_rate", FALLBACK_COMPLETION)
        t_no_show = effective(company_targets.get(m["business_id"]), branch_targets.get(m["branch_id"]),
                              "target_no_show_rate", FALLBACK_NO_SHOW)

        scored = score_one(branch_stats, utilisation.get(m["branch_id"]),
                           t_wait, t_completion, t_no_show)
        if scored is None:
            continue

        row = {
            "manager_id": m["manager_id"],
            "manager_name": m["manager_name"],
            "staff_code": m["staff_code"],
            "branch_id": m["branch_id"],
            "branch_name": m["branch_name"],
            **scored,
        }
        row["reason"] = reason_for(row, t_wait)
        by_business.setdefault(m["business_id"], []).append(row)
        records += scored["total_visits"]

    generated_at = datetime.now(timezone.utc)
    stale_after = generated_at + timedelta(hours=6)

    insights = []
    for business_id, rows in by_business.items():
        rows.sort(key=lambda r: r["manager_score"], reverse=True)
        for idx, r in enumerate(rows, start=1):
            r["rank"] = idx
        insights.append({
            "business_id": business_id,
            "insight_type": "manager_performance",
            "insight_data": {
                "window_days": args.days,
                "managers": rows,
            },
        })

    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    path = os.path.join(OUTPUTS_DIR, "manager_performance.json")
    with open(path, "w") as fh:
        json.dump(insights, fh, indent=2, default=str)

    total_managers = sum(len(r["insight_data"]["managers"]) for r in insights)
    print(f"Wrote {len(insights)} manager_performance insight(s), {total_managers} manager(s) → {path}")

    if args.write_db:
        upsert_insights(conn, insights, generated_at, stale_after, MODEL_VERSION, records)
        print("Upserted manager_performance into predictive_results.")
    conn.close()


if __name__ == "__main__":
    main()
