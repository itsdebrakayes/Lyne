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

COMPOSE="docker compose -f deploy/docker-compose.prod.yml"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

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
    die "the API never became healthy. Its last 60 log lines are above; a database refusing TLS is the usual cause."
  }
  sleep 10
done

log "Checking the public endpoint"
if curl -fsS --max-time 15 "https://${API_DOMAIN}/health" >/dev/null; then
  echo "    https://${API_DOMAIN}/health is answering"
else
  echo "    NOT answering yet over HTTPS."
  echo "    If this is the first deploy, Caddy may still be getting its certificate;"
  echo "    give it a minute, then:  docker compose -f deploy/docker-compose.prod.yml logs caddy"
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
    ./scripts/backup-database.sh   # and then restore it once, before real data exists

EOF
