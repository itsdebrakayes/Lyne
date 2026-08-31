#!/usr/bin/env bash
#
# backup-database.sh — the only thing that actually answers a ransom demand.
#
# Least privilege (database/security/harden_database.sql) removed the app's
# ability to DROP anything, which is worth doing and is not a backup. It still
# holds DELETE, so a compromised credential can empty every table row by row;
# and it does nothing at all about the ordinary disasters — a bad migration, a
# fat-fingered UPDATE without a WHERE, a container volume lost on a laptop that
# will not boot. There was no backup of any kind in this repository before this
# file, which meant every one of those was unrecoverable.
#
# Restoring is the point, so this verifies rather than assuming: a dump that has
# never been read back is a file, not a backup. Each run checks the dump gunzips
# cleanly, carries MySQL's own completion marker, and contains the tables the
# product cannot run without.
#
#   ./scripts/backup-database.sh                  # back up the production DB
#   ./scripts/backup-database.sh --demo           # back up the demo DB instead
#   ./scripts/backup-database.sh --restore FILE   # restore, with confirmation
#
# Retention is RETAIN_DAYS (default 14). Keep at least one copy somewhere this
# machine cannot reach — a backup on the same disk as the database is lost to
# the same disk failure, and a backup reachable from a compromised host is
# reachable by whoever compromised it.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${LYNE_BACKUP_DIR:-$REPO_ROOT/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
CONTAINER="lyne_db"
LABEL="prod"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --demo)    CONTAINER="lyne_demo_db"; LABEL="demo"; shift ;;
    --restore) MODE="restore"; RESTORE_FILE="${2:-}"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

# Read the root password from .env rather than taking it on the command line,
# where it would sit in shell history and in `ps` output for any other user on
# the box to read.
if [[ -f "$REPO_ROOT/.env" ]]; then
  MYSQL_ROOT_PASSWORD="$(grep -m1 '^MYSQL_ROOT_PASSWORD=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '"'"'"'' )"
fi
: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is not set and was not found in .env}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running." >&2
  exit 1
fi

# ── restore ──────────────────────────────────────────────────────────────────
if [[ "${MODE:-backup}" == "restore" ]]; then
  [[ -f "$RESTORE_FILE" ]] || { echo "No such backup: $RESTORE_FILE" >&2; exit 1; }
  echo "About to REPLACE the contents of '$LABEL' ($CONTAINER) with:"
  echo "  $RESTORE_FILE"
  echo "Everything currently in that database will be overwritten."
  read -r -p "Type the word restore to continue: " confirm
  [[ "$confirm" == "restore" ]] || { echo "Aborted."; exit 1; }

  gunzip -c "$RESTORE_FILE" \
    | docker exec -i "$CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD"
  echo "Restored $LABEL from $(basename "$RESTORE_FILE")."
  exit 0
fi

# ── back up ──────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/lyne-$LABEL-$STAMP.sql.gz"

# --single-transaction takes a consistent snapshot without locking writers out,
# so this can run against a live branch during opening hours. --routines and
# --triggers because the schema has both and a dump without them restores to a
# database that looks right and behaves differently.
docker exec "$CONTAINER" mysqldump \
  -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --databases lyne \
  2>/dev/null | gzip -9 > "$OUT"

# ── verify, because an unverified dump is not a backup ───────────────────────
fail() { echo "BACKUP FAILED VERIFICATION: $1" >&2; rm -f "$OUT"; exit 1; }

gunzip -t "$OUT" 2>/dev/null || fail "the archive is corrupt"

# Decompressed ONCE, into memory, and every check runs against that.
#
# The obvious way to write this — `gunzip -c "$OUT" | grep -q ...` per table —
# is wrong in a way that passes on small databases and fails on real ones.
# grep -q exits the moment it matches, gunzip gets SIGPIPE, and under `set -o
# pipefail` the pipeline reports failure. The production dump was small enough
# that gunzip finished before grep could exit, so it verified clean; the demo
# dump is large, grep exited early every time, and a perfectly good backup was
# reported corrupt and deleted. A verifier that fails only on big inputs is
# worse than none, because it teaches you to distrust it exactly when it counts.
TAIL="$(gunzip -c "$OUT" | tail -5)"
DUMPED_TABLES="$(gunzip -c "$OUT" | grep -oE 'CREATE TABLE `[^`]+`' | tr -d '`' | sed 's/^CREATE TABLE //')"

# mysqldump writes this marker as its final line only on a clean finish. Without
# it the dump is truncated — which is exactly what a disk filling up mid-backup
# produces, and it looks like a perfectly good file otherwise.
printf '%s' "$TAIL" | grep -q "Dump completed" \
  || fail "the dump is truncated (no completion marker)"

for table in users queue_tickets queues branches businesses staff; do
  printf '%s\n' "$DUMPED_TABLES" | grep -qx "$table" \
    || fail "table '$table' is missing from the dump"
done

TABLE_COUNT="$(printf '%s\n' "$DUMPED_TABLES" | grep -c . || true)"

SIZE="$(du -h "$OUT" | cut -f1)"
echo "Backed up $LABEL -> $(basename "$OUT") ($SIZE, $TABLE_COUNT tables, verified)"

# ── retention ────────────────────────────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "lyne-$LABEL-*.sql.gz" -type f -mtime "+$RETAIN_DAYS" -print -delete | wc -l | tr -d ' ')
[[ "$DELETED" -gt 0 ]] && echo "Removed $DELETED backup(s) older than $RETAIN_DAYS days."

KEPT=$(find "$BACKUP_DIR" -name "lyne-$LABEL-*.sql.gz" -type f | wc -l | tr -d ' ')
echo "$KEPT backup(s) of '$LABEL' retained in $BACKUP_DIR"
