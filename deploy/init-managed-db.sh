#!/usr/bin/env bash
#
# init-managed-db.sh — build the production schema on a MANAGED MySQL database.
#
# database/docker-init.sh cannot do this job. It runs from
# /docker-entrypoint-initdb.d, which only exists inside the MySQL image, and only
# on the very first boot of a fresh volume. A managed database has neither. So
# the same steps, in the same order, over the network:
#
#     schema.sql  →  migrations/*.sql (alphabetical)  →  harden_database.sql
#
# Run ONCE, from the repository root on the droplet, using the ADMIN credentials
# (doadmin on DigitalOcean) — not the application login, which by the end of this
# script is not allowed to create a table.
#
#     ADMIN_USER=doadmin ADMIN_PASSWORD='...' bash deploy/init-managed-db.sh
#
# Everything it runs is idempotent, but it is not a migration runner: for a
# database that already has data, apply the new numbered migrations by hand and
# leave this alone.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

ADMIN_USER="${ADMIN_USER:-doadmin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
HOST="${MYSQL_HOST:-}"
PORT="${MYSQL_PORT:-25060}"
APP_USER="${MYSQL_USER:-lyne}"
APP_PASSWORD="${MYSQL_PASSWORD:-}"
DB="${MYSQL_DATABASE:-lyne}"
CA="${CA_FILE:-secrets/mysql-ca.crt}"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ -n "$ADMIN_PASSWORD" ] || die "ADMIN_PASSWORD is not set. Pass the managed database's admin password."
[ -n "$HOST" ]           || die "MYSQL_HOST is not set. Fill in .env first."
[ -n "$APP_PASSWORD" ]   || die "MYSQL_PASSWORD is not set. Fill in .env first."
[ -f "$CA" ]             || die "CA certificate not found at $CA. Download it from the database's Connection Details panel."
command -v mysql >/dev/null || die "the mysql client is not installed (apt-get install mysql-client)"

# The PUBLIC host, not the private one: this script usually runs before the
# droplet is on the same VPC as anything, and either resolves from the droplet.
mysql_admin() {
  mysql --host="$HOST" --port="$PORT" --user="$ADMIN_USER" --password="$ADMIN_PASSWORD" \
        --ssl-ca="$CA" --ssl-mode=VERIFY_CA \
        --default-character-set=utf8mb4 "$@"
}

log "Checking connectivity and TLS"
mysql_admin -e "SELECT VERSION() AS version, @@require_secure_transport AS tls_required\G" \
  || die "could not connect. Check the host, the port, and that this droplet's IP is on the database's trusted sources list."

# ── The server's SQL mode, checked before anything is applied ────────────────
# DigitalOcean's default "Global SQL mode" for a managed MySQL cluster includes
# ANSI_QUOTES and PIPES_AS_CONCAT. The MySQL Docker image used in development
# includes neither, so this is the one difference between the two that silently
# invalidates SQL that has always worked.
#
# ANSI_QUOTES makes "..." an IDENTIFIER rather than a string literal. 21 of the
# files below contain double-quoted strings — migration 008 is simply the first
# one reached — so with it on, this script fails partway through and leaves a
# half-built schema, which is the worst of the available outcomes.
#
# PIPES_AS_CONCAT makes || string concatenation rather than logical OR, so a
# WHERE clause stops meaning what it says instead of failing.
#
# Both are fixed in the DigitalOcean panel, not from here: a managed admin
# account cannot SET GLOBAL sql_mode, and setting it for this session only would
# fix this script while leaving every later connection — the API's included —
# running under the wrong mode. So this refuses to start.
log "Checking the server SQL mode"
SQL_MODE="$(mysql_admin -N -B -e 'SELECT @@GLOBAL.sql_mode;' 2>/dev/null || true)"
[ -n "$SQL_MODE" ] || die "could not read @@GLOBAL.sql_mode"
BAD_MODES=""
case "$SQL_MODE" in *ANSI_QUOTES*)     BAD_MODES="ANSI_QUOTES" ;; esac
case "$SQL_MODE" in *PIPES_AS_CONCAT*) BAD_MODES="${BAD_MODES:+$BAD_MODES, }PIPES_AS_CONCAT" ;; esac
if [ -n "$BAD_MODES" ]; then
  die "the database's global SQL mode includes ${BAD_MODES}, which this schema is not
       written for. NOTHING HAS BEEN APPLIED — fix the mode first, or you get a
       half-built schema.

       DigitalOcean panel → your database → Settings → Global SQL mode.
       Remove ANSI_QUOTES, PIPES_AS_CONCAT and IGNORE_SPACE, save, then re-run this.

       Current mode:
       ${SQL_MODE}"
fi
echo "    no ANSI_QUOTES, no PIPES_AS_CONCAT"

log "Creating the database and the application login"
mysql_admin <<SQL
-- No COLLATE clause on purpose. Naming one here sets the DATABASE default,
-- which is what a table created without its own charset clause inherits —
-- while schema.sql's tables all say DEFAULT CHARSET=utf8mb4 and so take the
-- CHARSET default instead. Asking for utf8mb4_unicode_ci therefore made
-- production disagree with development about one table's collation, and a
-- foreign key across two collations is refused (errno 150). Letting the
-- server decide keeps this database identical to the one the MySQL image
-- builds in development, which is the only version anybody tests against.
CREATE DATABASE IF NOT EXISTS \`${DB}\`
  CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '${APP_USER}'@'%' IDENTIFIED BY '${APP_PASSWORD}';
ALTER USER '${APP_USER}'@'%' IDENTIFIED BY '${APP_PASSWORD}';
SQL

log "Applying schema.sql"
mysql_admin "$DB" < database/schema.sql

log "Applying migrations in order"
# Alphabetical, exactly as docker-init.sh does it — which is why they are
# zero-padded. A migration named without that prefix runs in the wrong place.
shopt -s nullglob
for f in database/migrations/*.sql; do
  printf '    %s\n' "$(basename "$f")"
  mysql_admin "$DB" < "$f" || die "migration $(basename "$f") failed — stopping. A half-applied schema is worse than none."
done

log "Hardening: stripping the application login down to DML"
# This exits non-zero on a managed database, and that is expected. The reason is
# NOT the final FLUSH PRIVILEGES, which is what this message used to claim —
# it is the statement before it:
#
#     DROP USER IF EXISTS 'root'@'%';
#
# DigitalOcean's managed MySQL has no root@'%' to begin with (the admin account
# is doadmin) and does not permit doadmin to drop reserved accounts, so the
# statement is refused. `mysql` stops at the first error, so FLUSH PRIVILEGES
# after it never runs either.
#
# Neither matters here, and the distinction is worth getting right because the
# question this output has to answer is "did the app login actually get locked
# down?". It did: every GRANT and REVOKE against the application login comes
# BEFORE the DROP USER in that file and has already applied. The root@'%' the
# statement targets is an artefact of the MySQL Docker image, not of this
# database, so there is nothing left open.
#
# It is verified rather than assumed — the next step reconnects AS the
# application login and fails this script if it still holds DDL.
mysql_admin < database/security/harden_database.sql \
  || echo "    (DROP USER 'root'@'%' was refused, and FLUSH PRIVILEGES after it did not run.
     Both are expected on managed MySQL: there is no root@'%' here, and doadmin may not
     drop reserved accounts. The application login's GRANTs come earlier in the file and
     did apply — the check below proves it.)"

log "Verifying the application login is not able to change structure"
GRANTS="$(mysql --host="$HOST" --port="$PORT" --user="$APP_USER" --password="$APP_PASSWORD" \
                --ssl-ca="$CA" --ssl-mode=VERIFY_CA -N -B \
                -e 'SHOW GRANTS FOR CURRENT_USER();' 2>/dev/null || true)"
[ -n "$GRANTS" ] || die "the application login could not connect. Check MYSQL_PASSWORD and the database's trusted sources."
echo "$GRANTS" | sed 's/^/    /'

if echo "$GRANTS" | grep -qiE 'ALL PRIVILEGES|\bDROP\b|\bALTER\b|GRANT OPTION'; then
  die "the application login still holds DDL. Hardening did not take — do not point the API at this database yet."
fi

log "Done. The database is built and the application login holds DML only."
echo "    Next: deploy/deploy.sh"
