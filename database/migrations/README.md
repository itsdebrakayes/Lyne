# Migrations

## Keep every migration additive

**Never `DROP COLUMN`, `RENAME COLUMN` or `DROP TABLE` in a release that is
still being rolled out.** Expand now; contract in a much later release, or not
at all.

This is not style. `deploy/deploy.sh` rolls back to the last commit that passed
a health check, and that rollback only touches CODE — it never reverts the
database. It is safe precisely because yesterday's code still understands
today's schema. All migrations to date hold that property; the first destructive
one silently turns rollback into a way to break production.

See docs/SCALING.md §3.
