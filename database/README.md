# Q ME NOW — MySQL Database

This folder contains the complete MySQL database schema, seed data, and CSV export queries for the Q ME NOW platform.

---

## Files

| File | Purpose |
|---|---|
| `schema.sql` | Full CREATE TABLE statements for all 19 tables |
| `seed.sql` | Demo data: TAJ, NHT, PICA + 90 days of synthetic queue history |
| `analytics_exports.sql` | SELECT … INTO OUTFILE queries to produce CSV files for the Jupyter model |
| `README.md` | This file |

---

## Setup

### 1. Create the database and schema

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS qme_now CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p qme_now < schema.sql
```

### 2. Load seed data

```bash
mysql -u root -p qme_now < seed.sql
```

### 3. Verify

```bash
mysql -u root -p qme_now -e "SHOW TABLES;"
```

Expected output: 19 tables.

---

## Schema Overview

```
subscription_tiers          — Feature flags per tier (Basic → Executive)
businesses                  — Top-level organizations
branches                    — Physical locations
services                    — Service types with ticket prefixes
counters                    — Physical service windows
users                       — End-user clients
roles                       — line_staff / manager / executive
staff                       — Employees (auto-generated staff codes)
staff_assignments           — Daily counter-to-staff shift assignments
intake_forms                — Dynamic JSON form data at queue join
queues                      — Per-service, per-branch, per-day queues
queue_tickets               — Core operational table
queue_events                — Immutable audit log of every status change
wait_time_records           — Denormalized historical data (ML input)
analytics_summaries         — Pre-aggregated daily metrics
predictive_results          — JSON blobs written back by Jupyter
saved_businesses            — User favourites (mobile app)
visit_history               — Denormalized user-facing visit feed
notifications               — Push/SMS notification log
```

---

## Exporting CSV for the Jupyter Model

Ensure `secure_file_priv` is set to `/var/lib/mysql-files/` in `my.cnf`, then run:

```bash
mysql -u root -p qme_now < analytics_exports.sql
```

This produces five CSV files:
- `queue_history.csv` — Full visit-level data
- `service_performance.csv` — Aggregated per-service metrics
- `branch_performance.csv` — Daily branch-level aggregates
- `staff_activity.csv` — Per-staff service counts
- `prediction_inputs.csv` — Full ML feature set

Copy these to `../analytics/data/` before running the Jupyter notebooks.

---

## Replacing the Previous Supabase/PostgreSQL Setup

The `supabase/` folder at the root of the repository is now **deprecated**. The Supabase project is retained **only for authentication** (login/signup). All application data has moved to this MySQL schema.

The migration path:
1. Run `schema.sql` on your MySQL server.
2. Run `seed.sql` for demo data.
3. Configure the backend `.env` with your MySQL credentials.
4. The backend API handles all data reads/writes; Supabase Auth issues JWTs that the backend verifies.
