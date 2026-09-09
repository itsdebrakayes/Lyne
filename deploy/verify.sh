#!/usr/bin/env bash
#
# verify.sh — check the hardening checklist in docs/HOSTING.md, on the box, out
# loud. Run on the droplet after deploy/deploy.sh:
#
#     bash deploy/verify.sh
#
# A checklist nobody re-runs is a checklist that was true once. This is the same
# list, executable, so it can be run again after every change to the server.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[ -f .env ] && set -a && . ./.env && set +a

PASS=0; FAIL=0; WARN=0
ok()   { printf '  \033[1;32m✓\033[0m %s\n' "$*"; PASS=$((PASS+1)); }
no()   { printf '  \033[1;31m✗\033[0m %s\n' "$*"; FAIL=$((FAIL+1)); }
hmm()  { printf '  \033[1;33m!\033[0m %s\n' "$*"; WARN=$((WARN+1)); }
head_() { printf '\n\033[1;34m%s\033[0m\n' "$*"; }

head_ "Firewall"
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ok "ufw is active"
  ufw status | grep -qE '^3306' && no "3306 is open to the world — close it" || ok "MySQL is not exposed"
  ufw status | grep -qE '^4000' && no "4000 is open — the API should only be reachable through Caddy" || ok "the API port is not exposed"
else
  no "ufw is not active"
fi

head_ "SSH"
sshd -T 2>/dev/null | grep -q '^permitrootlogin no' && ok "root login disabled" || no "root login is still permitted"
sshd -T 2>/dev/null | grep -q '^passwordauthentication no' && ok "password authentication disabled" || no "password authentication is still on"

head_ "Automatic updates and fail2ban"
systemctl is-active --quiet fail2ban && ok "fail2ban is running" || no "fail2ban is not running"
systemctl is-enabled --quiet unattended-upgrades && ok "unattended security upgrades enabled" || no "unattended upgrades are off"

head_ "Containers"
COMPOSE="docker compose -f deploy/docker-compose.prod.yml"
for svc in caddy api model-worker; do
  state="$($COMPOSE ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$svc" '$1==s{print $2}')"
  [ "$state" = "running" ] && ok "$svc is running" || no "$svc is ${state:-absent}"
done
$COMPOSE ps --format '{{.Publishers}}' 2>/dev/null | grep -q '4000' \
  && no "the API is publishing a host port — it should be reachable only via Caddy" \
  || ok "the API publishes no host port"

head_ "TLS"
if [ -n "${API_DOMAIN:-}" ]; then
  if curl -fsS --max-time 15 "https://${API_DOMAIN}/health" >/dev/null 2>&1; then
    ok "https://${API_DOMAIN}/health answers"
    expiry="$(echo | openssl s_client -servername "$API_DOMAIN" -connect "${API_DOMAIN}:443" 2>/dev/null \
              | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
    [ -n "$expiry" ] && ok "certificate valid until ${expiry}" || hmm "could not read the certificate expiry"
  else
    no "https://${API_DOMAIN}/health does not answer"
  fi
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${API_DOMAIN}/health" 2>/dev/null | grep -qE '30[128]' \
    && ok "plain HTTP redirects to HTTPS" || hmm "HTTP did not redirect (check separately)"
else
  hmm "API_DOMAIN is not set — skipping the TLS checks"
fi

head_ "Database"
if [ -f secrets/mysql-ca.crt ] && [ -n "${MYSQL_HOST:-}" ]; then
  ok "the CA certificate is present"
  GRANTS="$(mysql --host="$MYSQL_HOST" --port="${MYSQL_PORT:-25060}" --user="${MYSQL_USER:-lyne}" \
                  --password="${MYSQL_PASSWORD:-}" --ssl-ca=secrets/mysql-ca.crt --ssl-mode=VERIFY_CA \
                  -N -B -e 'SHOW GRANTS FOR CURRENT_USER();' 2>/dev/null)"
  if [ -n "$GRANTS" ]; then
    ok "the application login connects over verified TLS"
    echo "$GRANTS" | grep -qiE 'ALL PRIVILEGES|\bDROP\b|\bALTER\b|GRANT OPTION' \
      && no "the application login holds DDL — run deploy/init-managed-db.sh's hardening step again" \
      || ok "the application login holds DML only"
  else
    no "the application login could not connect over TLS"
  fi
  case "${MYSQL_HOST}" in
    private-*) ok "using the private (VPC) database host" ;;
    *) hmm "MYSQL_HOST is not the private- host; traffic is crossing the public internet" ;;
  esac
else
  no "secrets/mysql-ca.crt or MYSQL_HOST is missing"
fi

head_ "Configuration"
[ -z "${ALLOW_DEMO_DATA_REFRESH:-}" ] && ok "ALLOW_DEMO_DATA_REFRESH is unset" || no "ALLOW_DEMO_DATA_REFRESH is SET — unset it"
case "${ALLOWED_ORIGINS:-}" in
  *localhost*|*127.0.0.1*|*'*'*) no "ALLOWED_ORIGINS contains localhost or a wildcard" ;;
  '') no "ALLOWED_ORIGINS is empty" ;;
  *) ok "ALLOWED_ORIGINS is public origins only" ;;
esac
: "${PORTAL_HANDOFF_SECRET:=}"
[ "${#PORTAL_HANDOFF_SECRET}" -ge 32 ] && ok "PORTAL_HANDOFF_SECRET looks generated" || no "PORTAL_HANDOFF_SECRET is short or missing"
if git -C "$ROOT" ls-files --error-unmatch .env >/dev/null 2>&1; then
  no ".env is TRACKED BY GIT — remove it from the index immediately"
else
  ok ".env is not tracked by git"
fi

head_ "Backups"
if [ -x scripts/backup-database.sh ]; then
  ok "the backup script is present and executable"
  latest="$(ls -t /srv/lyne/backups/*.sql.gz 2>/dev/null | head -1)"
  if [ -n "$latest" ]; then
    age=$(( ( $(date +%s) - $(date -r "$latest" +%s) ) / 86400 ))
    [ "$age" -le 2 ] && ok "most recent backup is ${age} day(s) old" || no "most recent backup is ${age} days old"
  else
    no "no backup has ever been taken"
  fi
  crontab -l 2>/dev/null | grep -q backup-database && ok "a backup cron entry exists" || no "backups are not scheduled"
else
  no "scripts/backup-database.sh is missing or not executable"
fi

printf '\n\033[1m%d passed, %d failed, %d to look at\033[0m\n\n' "$PASS" "$FAIL" "$WARN"
[ "$FAIL" -eq 0 ] || exit 1
