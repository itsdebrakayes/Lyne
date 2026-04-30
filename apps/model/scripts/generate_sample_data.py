"""
generate_sample_data.py
Generates realistic synthetic CSV files that match the Q ME NOW MySQL export format.
Produces 6 months of queue history for TAJ, NHT, and PICA across their branches.

Outputs (written to apps/model/data_exports/):
  - queue_history.csv
  - service_performance.csv
  - branch_performance.csv
"""

import os
import random
import uuid
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

random.seed(42)
np.random.seed(42)

# ── Output directory ─────────────────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data_exports")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Business / branch / service definitions ──────────────────────────────────
BUSINESSES = {
    "biz-taj-001": {
        "name": "Tax Administration Jamaica",
        "branches": {
            "br-taj-kingston": {"name": "TAJ Kingston", "parish": "Kingston"},
            "br-taj-montego":  {"name": "TAJ Montego Bay", "parish": "St. James"},
            "br-taj-portmore": {"name": "TAJ Portmore", "parish": "St. Catherine"},
            "br-taj-mandeville": {"name": "TAJ Mandeville", "parish": "Manchester"},
        },
        "services": {
            "svc-taj-tin":      {"name": "TIN Registration",       "avg_min": 12, "prefix": "T"},
            "svc-taj-filing":   {"name": "Tax Filing",             "avg_min": 18, "prefix": "F"},
            "svc-taj-payment":  {"name": "Tax Payment",            "avg_min": 8,  "prefix": "P"},
            "svc-taj-compliance":{"name": "Compliance Certificate","avg_min": 22, "prefix": "C"},
            "svc-taj-refund":   {"name": "Refund Processing",      "avg_min": 25, "prefix": "R"},
            "svc-taj-general":  {"name": "General Enquiry",        "avg_min": 6,  "prefix": "G"},
        },
    },
    "biz-nht-001": {
        "name": "National Housing Trust",
        "branches": {
            "br-nht-kingston": {"name": "NHT Kingston", "parish": "Kingston"},
            "br-nht-spanish":  {"name": "NHT Spanish Town", "parish": "St. Catherine"},
            "br-nht-montego":  {"name": "NHT Montego Bay", "parish": "St. James"},
        },
        "services": {
            "svc-nht-benefit":  {"name": "Benefit Application",    "avg_min": 20, "prefix": "B"},
            "svc-nht-loan":     {"name": "Mortgage Loan",          "avg_min": 30, "prefix": "M"},
            "svc-nht-contrib":  {"name": "Contribution Enquiry",   "avg_min": 10, "prefix": "C"},
            "svc-nht-general":  {"name": "General Enquiry",        "avg_min": 7,  "prefix": "G"},
        },
    },
    "biz-pica-001": {
        "name": "PICA",
        "branches": {
            "br-pica-kingston": {"name": "PICA Kingston", "parish": "Kingston"},
            "br-pica-montego":  {"name": "PICA Montego Bay", "parish": "St. James"},
        },
        "services": {
            "svc-pica-passport": {"name": "Passport Application",  "avg_min": 15, "prefix": "P"},
            "svc-pica-renew":    {"name": "Passport Renewal",      "avg_min": 12, "prefix": "R"},
            "svc-pica-citizen":  {"name": "Citizenship",           "avg_min": 35, "prefix": "C"},
            "svc-pica-visa":     {"name": "Visa Endorsement",      "avg_min": 20, "prefix": "V"},
            "svc-pica-general":  {"name": "General Enquiry",       "avg_min": 6,  "prefix": "G"},
        },
    },
}

# ── Date range: 6 months ending today ────────────────────────────────────────
END_DATE   = date.today()
START_DATE = END_DATE - timedelta(days=180)

# ── Traffic weights by hour (0-23) ────────────────────────────────────────────
# Peaks at 9am and 1pm, low before 8am and after 4pm
HOUR_WEIGHTS = {
    8:  0.06, 9:  0.14, 10: 0.12, 11: 0.10,
    12: 0.04, 13: 0.13, 14: 0.11, 15: 0.10,
    16: 0.08, 17: 0.04, 18: 0.02,
}

# ── DOW weights (0=Mon … 6=Sun) ───────────────────────────────────────────────
DOW_WEIGHTS = {0: 0.22, 1: 0.20, 2: 0.18, 3: 0.17, 4: 0.15, 5: 0.06, 6: 0.02}

# ── Jamaican public holidays (simplified) ────────────────────────────────────
HOLIDAYS = {
    date(2024, 8, 6), date(2024, 8, 7),   # Independence Day
    date(2024, 10, 21),                    # National Heroes Day
    date(2024, 12, 25), date(2024, 12, 26),
    date(2025, 1, 1),
    date(2025, 4, 18), date(2025, 4, 21),  # Easter
    date(2025, 5, 23),                     # Labour Day
    date(2025, 8, 6),
}


def daily_volume(biz_id: str, branch_id: str, d: date) -> int:
    """Return the number of tickets issued on a given day."""
    dow = d.weekday()
    if d in HOLIDAYS or dow == 6:
        return 0
    base = 120 if "taj" in biz_id else (80 if "nht" in biz_id else 60)
    # Kingston branches are busier
    if "kingston" in branch_id:
        base = int(base * 1.4)
    # Saturday is lighter
    if dow == 5:
        base = int(base * 0.35)
    # Add seasonal noise
    noise = random.gauss(1.0, 0.12)
    return max(0, int(base * noise))


def sample_hour() -> int:
    hours  = list(HOUR_WEIGHTS.keys())
    probs  = [HOUR_WEIGHTS[h] for h in hours]
    total  = sum(probs)
    probs  = [p / total for p in probs]
    return int(np.random.choice(hours, p=probs))


def wait_minutes(service_avg: int, queue_len: int, staff: int) -> float:
    """Simulate wait time: base + queue pressure - staff relief + noise."""
    base    = service_avg * 0.4
    pressure = (queue_len / max(staff, 1)) * 2.5
    noise   = random.gauss(0, service_avg * 0.15)
    raw     = base + pressure + noise
    return max(1.0, round(raw, 1))


def service_minutes(service_avg: int) -> float:
    return max(1.0, round(random.gauss(service_avg, service_avg * 0.2), 1))


def ticket_status() -> str:
    r = random.random()
    if r < 0.82:   return "completed"
    if r < 0.92:   return "cancelled"
    if r < 0.97:   return "no_show"
    return "serving"


# ── Generate queue_history rows ───────────────────────────────────────────────
print("Generating queue_history.csv …")
rows = []
ticket_counters: dict = {}

current = START_DATE
while current <= END_DATE:
    for biz_id, biz in BUSINESSES.items():
        for branch_id, branch in biz["branches"].items():
            n = daily_volume(biz_id, branch_id, current)
            if n == 0:
                current_date = current
                continue

            services_list = list(biz["services"].items())
            # Distribute tickets across services (weighted by avg_min inverse — shorter = more popular)
            svc_weights = [1 / max(s["avg_min"], 1) for _, s in services_list]
            total_w = sum(svc_weights)
            svc_probs = [w / total_w for w in svc_weights]

            # Simulate queue length building up through the day
            queue_len = 0
            staff_count = random.randint(3, 7)

            for _ in range(n):
                svc_id, svc = services_list[
                    int(np.random.choice(len(services_list), p=svc_probs))
                ]
                hour = sample_hour()
                # Queue length peaks mid-morning and mid-afternoon
                if 9 <= hour <= 11 or 13 <= hour <= 15:
                    queue_len = random.randint(8, 25)
                else:
                    queue_len = random.randint(1, 10)

                wm  = wait_minutes(svc["avg_min"], queue_len, staff_count)
                sm  = service_minutes(svc["avg_min"])
                sta = ticket_status()

                # Ticket counter per branch per day
                key = (branch_id, current)
                ticket_counters[key] = ticket_counters.get(key, 0) + 1
                ticket_num = f"{svc['prefix']}{ticket_counters[key]:04d}"

                rows.append({
                    "visit_id":               str(uuid.uuid4()),
                    "ticket_id":              str(uuid.uuid4()),
                    "ticket_number":          ticket_num,
                    "business_id":            biz_id,
                    "business_name":          biz["name"],
                    "branch_id":              branch_id,
                    "branch_name":            branch["name"],
                    "parish":                 branch["parish"],
                    "service_id":             svc_id,
                    "service_name":           svc["name"],
                    "visit_date":             current.isoformat(),
                    "dow":                    current.weekday(),
                    "hour":                   hour,
                    "month":                  current.month,
                    "week_of_year":           current.isocalendar()[1],
                    "is_weekend":             1 if current.weekday() >= 5 else 0,
                    "is_holiday":             1 if current in HOLIDAYS else 0,
                    "wait_time_minutes":      wm if sta not in ("cancelled",) else None,
                    "service_time_minutes":   sm if sta == "completed" else None,
                    "status":                 sta,
                    "queue_length_at_join":   queue_len,
                    "staff_count_at_time":    staff_count,
                    "active_counters":        max(1, staff_count - random.randint(0, 2)),
                })

    current += timedelta(days=1)

df_hist = pd.DataFrame(rows)
df_hist.to_csv(os.path.join(OUT_DIR, "queue_history.csv"), index=False)
print(f"  → {len(df_hist):,} rows written to queue_history.csv")

# ── Generate service_performance.csv ─────────────────────────────────────────
print("Generating service_performance.csv …")
svc_rows = []
for biz_id, biz in BUSINESSES.items():
    for svc_id, svc in biz["services"].items():
        subset = df_hist[(df_hist.business_id == biz_id) & (df_hist.service_id == svc_id)]
        if subset.empty:
            continue
        completed = subset[subset.status == "completed"]
        svc_rows.append({
            "service_id":             svc_id,
            "service_name":           svc["name"],
            "business_id":            biz_id,
            "business_name":          biz["name"],
            "total_visits":           len(subset),
            "completed":              len(subset[subset.status == "completed"]),
            "cancelled":              len(subset[subset.status == "cancelled"]),
            "no_show":                len(subset[subset.status == "no_show"]),
            "completion_rate":        round(len(completed) / max(len(subset), 1), 4),
            "avg_wait_minutes":       round(subset.wait_time_minutes.dropna().mean(), 2),
            "avg_service_minutes":    round(completed.service_time_minutes.dropna().mean(), 2),
            "p50_wait_minutes":       round(subset.wait_time_minutes.dropna().quantile(0.50), 2),
            "p90_wait_minutes":       round(subset.wait_time_minutes.dropna().quantile(0.90), 2),
        })
df_svc = pd.DataFrame(svc_rows)
df_svc.to_csv(os.path.join(OUT_DIR, "service_performance.csv"), index=False)
print(f"  → {len(df_svc):,} rows written to service_performance.csv")

# ── Generate branch_performance.csv ──────────────────────────────────────────
print("Generating branch_performance.csv …")
grp = (
    df_hist.groupby(["branch_id", "branch_name", "business_id", "business_name",
                     "visit_date", "dow", "month", "week_of_year"])
    .agg(
        total_visits    = ("visit_id",              "count"),
        avg_wait_minutes= ("wait_time_minutes",      "mean"),
        completed       = ("status",                 lambda x: (x == "completed").sum()),
        no_shows        = ("status",                 lambda x: (x == "no_show").sum()),
        avg_queue_len   = ("queue_length_at_join",   "mean"),
        avg_staff       = ("staff_count_at_time",    "mean"),
    )
    .reset_index()
)
grp["avg_wait_minutes"] = grp["avg_wait_minutes"].round(2)
grp["avg_queue_len"]    = grp["avg_queue_len"].round(1)
grp["avg_staff"]        = grp["avg_staff"].round(1)
grp.to_csv(os.path.join(OUT_DIR, "branch_performance.csv"), index=False)
print(f"  → {len(grp):,} rows written to branch_performance.csv")

print("\nAll sample data generated successfully.")
print(f"Files saved to: {os.path.abspath(OUT_DIR)}")
