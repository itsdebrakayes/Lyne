#!/usr/bin/env bash
# offsite-backup.sh — encrypted copies of the nightly database backup, OFF the droplet.
#
# backup-managed-db.sh writes each night's dump to /srv/lyne/backups, which is
# the same disk as everything else: it survives a bad migration, not a lost or
# compromised droplet. This script makes the second copy somewhere else:
#
#   1. encrypts the dump on the droplet (gpg, AES-256, passphrase from
#      secrets/backup-passphrase), so the storage provider only ever holds
#      ciphertext;
#   2. uploads it to the DigitalOcean Spaces bucket in secrets/deploy-values.txt
#      (SPACES_KEY / SPACES_SECRET / SPACES_BUCKET / SPACES_REGION) over HTTPS,
#      signed with AWS Signature v4 by curl itself — nothing to install;
#   3. checks the uploaded object is there and the right size.
#
# Credentials never appear on a command line (curl reads them from stdin) and
# are never printed.
#
#   bash deploy/offsite-backup.sh upload FILE        # encrypt + upload one dump
#   bash deploy/offsite-backup.sh latest             # the newest dump in BACKUP_DIR
#   bash deploy/offsite-backup.sh list               # what is in the bucket
#   bash deploy/offsite-backup.sh fetch NAME OUT     # download + decrypt to OUT (.sql.gz)
#   bash deploy/offsite-backup.sh prune DAYS         # delete copies older than DAYS (keeps the newest)
#
# Retention is done by this script (prune, after each nightly upload), not by a
# bucket lifecycle rule: the Spaces key on the server is deliberately a
# limited-access key (objects in this bucket only), which cannot change bucket
# settings. A stolen server key therefore cannot alter the bucket itself.
#
# THE PASSPHRASE IS THE ONLY WAY BACK IN. If the droplet is lost, the copy on
# the droplet is lost with it. Keep a second copy of secrets/backup-passphrase
# with the owner (the setup step copies it to the owner's Mac, secrets/).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${LYNE_BACKUP_DIR:-${BACKUP_DIR:-/srv/lyne/backups}}"
VALUES="${SPACES_VALUES_FILE:-secrets/deploy-values.txt}"
PASSFILE="${BACKUP_PASSPHRASE_FILE:-secrets/backup-passphrase}"
PREFIX="${OFFSITE_PREFIX:-prod}"
EMPTY_SHA=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

die() { printf 'offsite-backup: %s\n' "$*" >&2; exit 1; }
val() { grep -m1 "^$1=" "$VALUES" 2>/dev/null | cut -d= -f2- || true; }

KEY="$(val SPACES_KEY)"; SECRET="$(val SPACES_SECRET)"
BUCKET="$(val SPACES_BUCKET)"; REGION="$(val SPACES_REGION)"
[ -n "$KEY" ] && [ -n "$SECRET" ] && [ -n "$BUCKET" ] && [ -n "$REGION" ] \
  || die "SPACES_KEY, SPACES_SECRET, SPACES_BUCKET and SPACES_REGION must all be set in $VALUES"
ENDPOINT="https://${BUCKET}.${REGION}.digitaloceanspaces.com"

# curl with SigV4; the key pair goes in on stdin, never in argv or the environment.
s3() {
  printf 'user = "%s:%s"\n' "$KEY" "$SECRET" \
    | curl -K - --silent --show-error --fail-with-body --max-time 900 \
        --aws-sigv4 "aws:amz:${REGION}:s3" "$@"
}

need_passphrase() {
  [ -s "$PASSFILE" ] || die "no passphrase at $PASSFILE"
  [ "$(stat -c %a "$PASSFILE" 2>/dev/null || stat -f %Lp "$PASSFILE")" = 600 ] || die "$PASSFILE must be mode 600"
}

upload() {
  local file="$1"
  [ -f "$file" ] || die "no such file: $file"
  need_passphrase
  gzip -t "$file" || die "$file is not a valid gzip; refusing to copy a damaged backup"
  local name enc size remote
  name="$(basename "$file").gpg"
  enc="$(mktemp "${TMPDIR:-/tmp}/offsite.XXXXXX")"
  trap 'rm -f "$enc"' RETURN
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASSFILE" \
      --symmetric --cipher-algo AES256 --compress-algo none -o "$enc" "$file"
  size="$(wc -c < "$enc" | tr -d ' ')"
  s3 -X PUT -H "x-amz-content-sha256: UNSIGNED-PAYLOAD" -H "Content-Type: application/octet-stream" \
     --upload-file "$enc" "${ENDPOINT}/${PREFIX}/${name}" > /dev/null
  remote="$(s3 -I -H "x-amz-content-sha256: ${EMPTY_SHA}" "${ENDPOINT}/${PREFIX}/${name}" \
            | tr -d '\r' | awk -F': ' 'tolower($1)=="content-length"{print $2}')"
  [ "$remote" = "$size" ] || die "uploaded ${name} but the bucket reports ${remote:-nothing} bytes, expected ${size}"
  echo "    off-site: ${BUCKET}/${PREFIX}/${name} — ${size} bytes, encrypted, verified"
}

latest() {
  local f
  f="$(ls -1t "$BACKUP_DIR"/lyne-*.sql.gz 2>/dev/null | head -1 || true)"
  [ -n "$f" ] || die "no backups in $BACKUP_DIR"
  upload "$f"
}

list() {
  s3 -H "x-amz-content-sha256: ${EMPTY_SHA}" "${ENDPOINT}/?list-type=2&prefix=${PREFIX}/" \
    | tr '<' '\n' | awk -F'>' '$1=="Key"{k=$2} $1=="LastModified"{m=$2} $1=="Size"{print k"\t"$2"\t"m}'
}

fetch() {
  local name="$1" out="$2" enc
  need_passphrase
  [ -n "$out" ] || die "usage: fetch NAME OUT"
  enc="$(mktemp "${TMPDIR:-/tmp}/offsite.XXXXXX")"
  trap 'rm -f "$enc"' RETURN
  s3 -H "x-amz-content-sha256: ${EMPTY_SHA}" -o "$enc" "${ENDPOINT}/${PREFIX}/${name%.gpg}.gpg"
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$PASSFILE" -o "$out" --decrypt "$enc"
  gzip -t "$out" || die "decrypted file is not a valid gzip"
  echo "    fetched and decrypted to $out"
}

prune() {
  local days="$1" cutoff rows keep n=0 k
  [[ "$days" =~ ^[0-9]+$ ]] && [ "$days" -ge 7 ] || die "prune needs a number of days, at least 7"
  cutoff="$(date -u -d "-${days} days" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-"${days}"d +%Y-%m-%dT%H:%M:%S)"
  rows="$(list | grep -E "^${PREFIX}/lyne-[^/]*\.sql\.gz\.gpg"$'\t' || true)"
  [ -n "$rows" ] || { echo "    nothing off-site to prune"; return 0; }
  keep="$(printf '%s\n' "$rows" | sort -t$'\t' -k3 | tail -1 | cut -f1)"
  while IFS=$'\t' read -r k _ m; do
    [ "$k" = "$keep" ] && continue
    [[ "$m" < "$cutoff" ]] || continue
    s3 -X DELETE -H "x-amz-content-sha256: ${EMPTY_SHA}" "${ENDPOINT}/${k}" > /dev/null || die "could not delete $k"
    n=$((n + 1))
  done <<< "$rows"
  echo "    off-site: removed ${n} copies older than ${days} days"
}

case "${1:-}" in
  upload)    upload "${2:-}" ;;
  latest)    latest ;;
  list)      list ;;
  fetch)     fetch "${2:-}" "${3:-}" ;;
  prune)     prune "${2:-}" ;;
  *) sed -n '2,36p' "$0"; exit 2 ;;
esac
