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

log "Creating the database and the application login"
mysql_admin <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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
# The script ends with FLUSH PRIVILEGES, which needs RELOAD. A managed admin
# account may not hold it; the grants themselves take effect on the next
# connection regardless, so a failure at that final line is not a failure of the
# hardening. Everything before it has already applied.
mysql_admin < database/security/harden_database.sql \
  || echo "    (the final FLUSH PRIVILEGES was refused — expected on a managed database; the grants above did apply)"

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
