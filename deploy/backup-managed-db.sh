#!/usr/bin/env bash
#
# backup-managed-db.sh — nightly backups of the MANAGED production database.
#
# scripts/backup-database.sh cannot do this job. It shells into a local Docker
# container (`docker exec lyne_db mysqldump -uroot`) using MYSQL_ROOT_PASSWORD,
# and production has neither: the database is DigitalOcean Managed MySQL,
# reached over TLS, with no container and no root account. So the cron line in
# deploy/README.md §5 has been failing every night since the droplet went up,
# with the failure going to a log nobody reads. This is the same job done the
# way production actually works.
#
#   bash deploy/backup-managed-db.sh                       # back up
#   bash deploy/backup-managed-db.sh --restore FILE --into DB   # restore
#   bash deploy/backup-managed-db.sh --list                 # what is on disk
#
# ── Credentials ──────────────────────────────────────────────────────────────
# NOT the application login. harden_database.sql deliberately strips it to
# SELECT/INSERT/UPDATE/DELETE, and mysqldump also needs SHOW VIEW, TRIGGER and
# EVENT — so a dump taken as `lyne` either fails or, worse, silently omits the
# triggers and events and restores to a database that looks right and behaves
# differently.
#
# Create a least-privilege backup login ONCE, as doadmin. These five privileges
# are exactly what the mysqldump flags below need and nothing more — no DDL, no
# writes, and scoped to this one schema:
#
#   CREATE USER 'lyne_backup'@'%' IDENTIFIED BY '<a fresh password>';
#   GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES
#     ON `lyne`.* TO 'lyne_backup'@'%';
#
# Then put it where cron can read it and nothing else can:
#
#   printf 'BACKUP_MYSQL_USER=lyne_backup\nBACKUP_MYSQL_PASSWORD=<it>\n' \
#     > secrets/backup.env && chmod 600 secrets/backup.env
#
# secrets/ is gitignored. Until that exists this script will accept
# ADMIN_USER/ADMIN_PASSWORD (doadmin) so the first backup can be taken
# immediately, but it says so each time: a superuser password sitting in a cron
# job is a bigger prize than the backup it protects.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${LYNE_BACKUP_DIR:-${BACKUP_DIR:-/srv/lyne/backups}}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
LABEL="prod-managed"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
warn() { printf '\n\033[1;33mWARNING:\033[0m %s\n' "$*" >&2; }

MODE=backup
RESTORE_FILE=""
RESTORE_INTO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --restore) MODE=restore; RESTORE_FILE="${2:-}"; shift 2 ;;
    --into)    RESTORE_INTO="${2:-}"; shift 2 ;;
    --list)    MODE=list; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

# ── Configuration ────────────────────────────────────────────────────────────
# .env for where the database is; secrets/backup.env for who to connect as.
# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a
# shellcheck disable=SC1091
[ -f secrets/backup.env ] && set -a && . ./secrets/backup.env && set +a

HOST="${MYSQL_HOST:-}"
PORT="${MYSQL_PORT:-25060}"
DB="${MYSQL_DATABASE:-lyne}"
CA="${CA_FILE:-secrets/mysql-ca.crt}"

if [ -n "${BACKUP_MYSQL_USER:-}" ] && [ -n "${BACKUP_MYSQL_PASSWORD:-}" ]; then
  DUMP_USER="$BACKUP_MYSQL_USER"
  DUMP_PASSWORD="$BACKUP_MYSQL_PASSWORD"
elif [ -n "${ADMIN_USER:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  DUMP_USER="$ADMIN_USER"
  DUMP_PASSWORD="$ADMIN_PASSWORD"
  warn "backing up as the ADMIN login (${ADMIN_USER}).
         That works, but create the least-privilege lyne_backup user instead —
         the SQL is in the header of this script. A superuser password in a cron
         job is worth more to an attacker than the backup it is protecting."
else
  die "no backup credentials. Create secrets/backup.env with BACKUP_MYSQL_USER and
       BACKUP_MYSQL_PASSWORD (see the header of this script for the exact GRANT),
       or pass ADMIN_USER and ADMIN_PASSWORD for a one-off."
fi

# The application login cannot take a correct dump — it holds no SHOW VIEW,
# TRIGGER or EVENT — so refuse rather than write a quietly incomplete file.
if [ "$DUMP_USER" = "${MYSQL_USER:-lyne}" ]; then
  die "refusing to dump as '${DUMP_USER}', the application login. It holds DML only, so the
       dump would be missing views, triggers and events — and would restore into a
       database that looks correct and behaves differently. See the header."
fi

[ -n "$HOST" ] || die "MYSQL_HOST is not set. Run this from the repository root, where .env is."
[ -f "$CA" ]   || die "the CA certificate is missing at ${CA}. Download it from the database's Connection Details panel."
command -v mysqldump >/dev/null || die "mysqldump is not installed (apt-get install mysql-client)"

# ── Credentials file, not the command line ───────────────────────────────────
# A password in argv is readable by every other user on the box via `ps`, and it
# lands in shell history. An option file at mode 600 is the supported way.
CNF="$(mktemp)"
chmod 600 "$CNF"
cleanup() { rm -f "$CNF"; }
trap cleanup EXIT INT TERM
cat > "$CNF" <<CNFEOF
[client]
host=${HOST}
port=${PORT}
user=${DUMP_USER}
password="${DUMP_PASSWORD}"
ssl-ca=${CA}
ssl-mode=VERIFY_CA
CNFEOF

# ── --list ───────────────────────────────────────────────────────────────────
if [ "$MODE" = list ]; then
  ls -lh "$BACKUP_DIR"/lyne-"$LABEL"-*.sql.gz 2>/dev/null || echo "No backups in ${BACKUP_DIR}."
  exit 0
fi

# ── --restore ────────────────────────────────────────────────────────────────
# `--into` is required and has no default on purpose. The whole reason this
# exists is the restore REHEARSAL, which must go into a scratch schema; a
# default of the production database would make the dangerous thing the easy
# thing to type.
if [ "$MODE" = restore ]; then
  [ -f "$RESTORE_FILE" ] || die "no such backup: ${RESTORE_FILE}"
  [ -n "$RESTORE_INTO" ] || die "--restore needs --into <database>. Name the target explicitly:
       --into lyne_restore_test  to rehearse, --into ${DB}  to actually replace production."

  echo
  echo "  Restoring:  ${RESTORE_FILE}"
  echo "  Into:       ${RESTORE_INTO}  on  ${HOST}"
  [ "$RESTORE_INTO" = "$DB" ] \
    && echo "  THIS IS THE PRODUCTION DATABASE. Everything in it will be overwritten." \
    || echo "  (a scratch database — production is '${DB}' and is not touched)"
  echo
  read -r -p "  Type the word restore to continue: " confirm
  [ "$confirm" = "restore" ] || { echo "Aborted."; exit 1; }

  mysql --defaults-extra-file="$CNF" -e "CREATE DATABASE IF NOT EXISTS \`${RESTORE_INTO}\` CHARACTER SET utf8mb4;" \
    || die "could not create ${RESTORE_INTO}. The backup login is read-only by design — use ADMIN_USER/ADMIN_PASSWORD for a restore."
  gunzip -c "$RESTORE_FILE" | mysql --defaults-extra-file="$CNF" "$RESTORE_INTO" \
    || die "the restore failed partway through. ${RESTORE_INTO} is now in an unknown state."

  COUNT="$(mysql --defaults-extra-file="$CNF" -N -B -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${RESTORE_INTO}';")"
  log "Restored into ${RESTORE_INTO}: ${COUNT} tables."
  echo "    Drop it when you are done:  DROP DATABASE \`${RESTORE_INTO}\`;"
  exit 0
fi

# ── Back up ──────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/lyne-$LABEL-$STAMP.sql.gz"

log "Dumping ${DB} from ${HOST} as ${DUMP_USER}"
# --single-transaction  consistent snapshot without locking writers out, so this
#                       can run while the branches are open.
# --routines/--triggers/--events  the schema has all three; a dump without them
#                       restores to something that looks right and behaves
#                       differently.
# --no-tablespaces      tablespace metadata needs the PROCESS privilege, which a
#                       least-privilege backup login does not have and does not
#                       need. Without this flag the dump fails outright.
# --set-gtid-purged=OFF the managed cluster has GTIDs on; left in, the dump
#                       carries @@GLOBAL.GTID_PURGED statements that make it
#                       unrestorable into any other cluster — including the
#                       scratch schema used for the rehearsal.
#
# Deliberately NOT --databases: that would write CREATE DATABASE/USE lyne into
# the dump and pin it to that one schema name. Without it the dump is portable,
# which is what makes `--restore --into lyne_restore_test` possible.
mysqldump --defaults-extra-file="$CNF" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --no-tablespaces \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$DB" 2>"$BACKUP_DIR/.last-dump-stderr" | gzip -9 > "$OUT" || {
    warn "mysqldump failed. Its stderr:"
    sed 's/^/      /' "$BACKUP_DIR/.last-dump-stderr" >&2
    rm -f "$OUT"
    die "no backup was written."
  }

# ── Verify, because an unverified dump is not a backup ───────────────────────
fail() { echo "BACKUP FAILED VERIFICATION: $1" >&2; rm -f "$OUT"; exit 1; }

gunzip -t "$OUT" 2>/dev/null || fail "the archive is corrupt"

# Decompressed into variables ONCE, and every check runs against those.
#
# The obvious form — `gunzip -c "$OUT" | grep -q ...` per table — is wrong in a
# way that passes on small databases and fails on real ones: grep -q exits at
# the first match, gunzip takes SIGPIPE, and under `set -o pipefail` the whole
# pipeline reports failure. That deleted perfectly good backups of the larger
# database while passing on the smaller one. A verifier that only fails on big
# inputs is worse than none.
TAIL="$(gunzip -c "$OUT" | tail -5)"
DUMPED_TABLES="$(gunzip -c "$OUT" | grep -oE 'CREATE TABLE `[^`]+`' | tr -d '`' | sed 's/^CREATE TABLE //')"

# mysqldump writes this marker as its last line only on a clean finish. Without
# it the dump is truncated — exactly what a disk filling up mid-backup produces,
# and it looks like a perfectly good file otherwise.
printf '%s' "$TAIL" | grep -q "Dump completed" \
  || fail "the dump is truncated (no completion marker)"

for table in users queue_tickets queues branches businesses staff; do
  printf '%s\n' "$DUMPED_TABLES" | grep -qx "$table" \
    || fail "table '$table' is missing from the dump"
done

TABLE_COUNT="$(printf '%s\n' "$DUMPED_TABLES" | grep -c . || true)"
SIZE="$(du -h "$OUT" | cut -f1)"
rm -f "$BACKUP_DIR/.last-dump-stderr"
echo "    $(basename "$OUT") — ${SIZE}, ${TABLE_COUNT} tables, verified"

# ── Retention ────────────────────────────────────────────────────────────────
DELETED="$(find "$BACKUP_DIR" -name "lyne-$LABEL-*.sql.gz" -type f -mtime "+$RETAIN_DAYS" -print -delete | wc -l | tr -d ' ')"
[ "$DELETED" -gt 0 ] && echo "    removed ${DELETED} backup(s) older than ${RETAIN_DAYS} days"
KEPT="$(find "$BACKUP_DIR" -name "lyne-$LABEL-*.sql.gz" -type f | wc -l | tr -d ' ')"
echo "    ${KEPT} backup(s) retained in ${BACKUP_DIR}"

cat <<EOF

  This backup is on the SAME DISK as the database it protects, which means it
  survives a bad migration and not a lost droplet. Two things still to do:

    - Copy it off the box (DigitalOcean Spaces, SPACES_* in secrets/deploy-values.txt)
    - Rehearse the restore, while the data is still worthless:
        bash deploy/backup-managed-db.sh --restore ${OUT} --into lyne_restore_test

EOF
