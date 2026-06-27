# Q ME NOW — MySQL Database

This folder contains the production MySQL schema, migrations, and analytics export reference queries.

## Files

| File | Purpose |
|---|---|
| `schema.sql` | Full production schema |
| `migrations/` | Incremental security, performance, pipeline, and audit migrations |
| `analytics_exports.sql` | Reference CSV export queries for model development |
| `README.md` | Database setup notes |

Demo seed data is not stored on production `main`. Use the `demo` branch for demo businesses and synthetic activity.

## Fresh Production Setup

For local Docker startup, `docker-compose.yml` mounts `schema.sql` and all migrations into MySQL automatically on first database creation.

For manual setup:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS qmenow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p qmenow < schema.sql
mysql -u root -p qmenow < migrations/001_performance_indexes.sql
mysql -u root -p qmenow < migrations/002_security_and_ocr.sql
mysql -u root -p qmenow < migrations/003_sessions_and_token_security.sql
mysql -u root -p qmenow < migrations/004_pipeline_and_tenant_hardening.sql
mysql -u root -p qmenow < migrations/005_audit_tenant_scope.sql
```

After schema creation, onboard the first company and first authorized admin account through a controlled onboarding script or support workflow. Do not seed demo companies into production.

## Core Tables

- `businesses`, `branches`, `services`, `counters`
- `users`, `roles`, `staff`, `staff_assignments`
- `queues`, `queue_tickets`, `queue_events`
- `wait_time_records`, `analytics_summaries`, `predictive_results`
- `saved_businesses`, `visit_history`, `notifications`
- `session_events`, `revoked_tokens`, `audit_logs`, `pipeline_runs`

## Analytics Flow

The production worker exports tenant-scoped operational data from MySQL, runs the model notebook, and imports standardized insights back through the backend API.

Dashboards should read analytics from backend routes only. They should not read local CSV or notebook files.
