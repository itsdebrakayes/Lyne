#!/usr/bin/env bash
#
# deploy.sh — build, start and prove it. Run from the repository root on the
# droplet, as the deploy user:
#
#     bash deploy/deploy.sh
#
# The API is a BUILT image: backend source changes do nothing until it is
# rebuilt, which is the single most common way a deploy appears to succeed and
# ships nothing. So the build is unconditional here rather than clever.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --project-directory is not cosmetic. Every path inside the compose file is
# written relative to the REPOSITORY ROOT (./apps/backend, ./secrets/mysql-ca.crt,
# ./deploy/Caddyfile), but Compose resolves relative paths against the directory
# the compose FILE lives in — deploy/ — so without this the build looks for
# /srv/lyne/deploy/apps/model and dies with "path not found". Running from $ROOT
# is not enough; the compose file's own location is what Compose uses.
#
# This does not rename anything: the compose file sets `name: lyne-prod` and every
# service sets container_name explicitly, so the project and containers are
# identified the same way before and after.
COMPOSE="docker compose --project-directory $ROOT -f deploy/docker-compose.prod.yml"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }
warn() { printf '\n\033[1;33mWARNING:\033[0m %s\n' "$*" >&2; }

# ── Rollback ─────────────────────────────────────────────────────────────────
# The commit of the last deploy that actually answered a health check. Written
# only on success, so it can never point at a version that failed to start.
#
# CODE ONLY — this never touches the database, and that is safe for one specific
# reason: every migration in database/migrations is additive. Nothing drops or
# renames a column, so yesterday's code still understands today's schema. If
# anyone ever writes a destructive migration that stops being true and this
# becomes a way to break production quietly. Keep migrations additive; expand
# now, contract in a much later release, or not at all.
LAST_GOOD_FILE="$ROOT/.deploy-last-good"
CURRENT_SHA="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo '')"

rollback_to() {
  local target="$1"
  warn "Rolling back to ${target}"
  git -C "$ROOT" checkout --quiet "$target" || die "could not check out ${target}. Roll back by hand."
  ( cd "$ROOT/apps/admin-desktop" && npm ci --silent && npx vite build ) \
    || warn "the admin app failed to rebuild on the rolled-back commit; the API is what matters here."
  $COMPOSE build --pull || die "the rolled-back image would not build. This droplet needs hands."
  $COMPOSE up -d --remove-orphans || die "the rolled-back containers would not start. This droplet needs hands."
  for attempt in $(seq 1 18); do
    if $COMPOSE exec -T api wget -qO- http://localhost:4000/health >/dev/null 2>&1; then
      log "Rolled back to ${target} and it is healthy."
      echo "    You are now running an OLDER commit than your branch. Fix forward, then deploy again."
      return 0
    fi
    sleep 10
  done
  die "rolled back to ${target} and it STILL will not come up. Check the database and Caddy before anything else."
}

# `bash deploy/deploy.sh rollback` — deliberate, manual, no deploy attempted.
if [ "${1:-}" = "rollback" ]; then
  [ -s "$LAST_GOOD_FILE" ] || die "no recorded last-good deploy, so there is nothing to roll back to."
  rollback_to "$(cat "$LAST_GOOD_FILE")"
  exit 0
fi

# ── Preflight ────────────────────────────────────────────────────────────────
[ -f .env ]                  || die ".env is missing. Copy deploy/env.production.example and fill it in."
[ -f secrets/mysql-ca.crt ]  || die "secrets/mysql-ca.crt is missing. Download the CA certificate from the database's Connection Details panel."

# shellcheck disable=SC1091
set -a && . ./.env && set +a

for required in MYSQL_HOST MYSQL_PASSWORD SUPABASE_URL SUPABASE_SERVICE_KEY PORTAL_HANDOFF_SECRET API_DOMAIN ADMIN_DOMAIN ALLOWED_ORIGINS; do
  [ -n "${!required:-}" ] || die "$required is empty in .env"
  [ "${!required}" != "REQUIRED" ] || die "$required is still the placeholder value"
done

case "${ALLOWED_ORIGINS}" in
  *localhost*|*127.0.0.1*|*'*'*) die "ALLOWED_ORIGINS contains localhost or a wildcard. Production takes exact public origins only." ;;
esac
[ -z "${ALLOW_DEMO_DATA_REFRESH:-}" ] || die "ALLOW_DEMO_DATA_REFRESH is set. Unset it — this is production."

# ── Admin PWA ────────────────────────────────────────────────────────────────
# Caddy serves apps/admin-desktop/dist. `npm run build` there also runs
# electron-builder, which wants a desktop toolchain this droplet does not have,
# so the web build is invoked directly.
log "Building the admin app"
( cd apps/admin-desktop && npm ci --silent && npx vite build )
[ -f apps/admin-desktop/dist/index.html ] || die "the admin build produced no index.html"

# ── Containers ───────────────────────────────────────────────────────────────
log "Building images"
$COMPOSE build --pull

log "Starting"
$COMPOSE up -d --remove-orphans

# ── Prove it ─────────────────────────────────────────────────────────────────
log "Waiting for the API to answer"
for attempt in $(seq 1 30); do
  if $COMPOSE exec -T api wget -qO- http://localhost:4000/health >/dev/null 2>&1; then
    echo "    healthy after ${attempt}0s or less"
    break
  fi
  [ "$attempt" -lt 30 ] || {
    $COMPOSE logs --tail 60 api
    warn "the API never became healthy. Its last 60 log lines are above; a database refusing TLS is the usual cause."
    if [ -s "$LAST_GOOD_FILE" ] && [ "$(cat "$LAST_GOOD_FILE")" != "$CURRENT_SHA" ]; then
      rollback_to "$(cat "$LAST_GOOD_FILE")"
      die "deploy failed and was rolled back. Production is on the previous working commit."
    fi
    die "deploy failed, and there is no recorded last-good commit to fall back to (first deploy?). Fix it here."
  }
  sleep 10
done

# Past the health check, so this commit is known to start and answer. Record it
# as the thing to fall back to next time.
if [ -n "$CURRENT_SHA" ]; then
  printf '%s\n' "$CURRENT_SHA" > "$LAST_GOOD_FILE"
  echo "    recorded $CURRENT_SHA as the last good deploy"
fi

log "Checking the public endpoint"
if curl -fsS --max-time 15 "https://${API_DOMAIN}/health" >/dev/null; then
  echo "    https://${API_DOMAIN}/health is answering"
else
  echo "    NOT answering yet over HTTPS."
  echo "    If this is the first deploy, Caddy may still be getting its certificate;"
  echo "    give it a minute, then:  docker compose --project-directory . -f deploy/docker-compose.prod.yml logs caddy"
  echo "    If it persists, the usual cause is DNS: ${API_DOMAIN} must resolve to this droplet."
fi

log "Running state"
$COMPOSE ps

cat <<EOF

  Deployed.

    API      https://${API_DOMAIN}
    Admin    https://${ADMIN_DOMAIN}

  Worth doing now, not later:
    bash deploy/verify.sh          # the hardening checklist, checked
    bash deploy/deploy.sh rollback # if this release turns out bad — code only, never the database
    ./scripts/backup-database.sh   # and then restore it once, before real data exists

EOF
