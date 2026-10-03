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

## Production is stricter than the dev image — two ways

The development database is the MySQL Docker image with default settings.
Production is DigitalOcean Managed MySQL, which differs in ways that turn
perfectly good migrations into deploy-time failures. Both of these are settings
of the server, not of this repository, so a migration cannot work around them.

### Every new table needs an explicit PRIMARY KEY

`sql_require_primary_key` is **ON** in production. A `CREATE TABLE` without a
primary key is refused outright:

```
ERROR 3750 (HY000): Unable to create or change a table without a primary key
```

It applies cleanly in development and fails on the droplet, which is the worst
place to find out. Every table to date has one; keep it that way. If you need a
pure join table, give it a composite primary key over the two foreign keys
rather than leaving it keyless.

### Do not use `"` for string literals

Production's global SQL mode must not include `ANSI_QUOTES` — with it on, `"x"`
is an identifier, not a string, and 21 of the files in this directory and
`schema.sql` break. `deploy/init-managed-db.sh` refuses to run if the mode is
wrong, before it applies anything, so the failure cannot leave a half-built
schema. Even so: write string literals as `'single quoted'` and identifiers as
`` `backticked` ``, which is correct under either mode.
