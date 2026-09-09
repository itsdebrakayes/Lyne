#!/usr/bin/env bash
# demo-thaw.sh — undo demo-freeze. The box goes back to refreshing itself.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.demo.yml"
echo "Restarting the API with the scheduled re-seed on…"
$COMPOSE up -d --no-deps api >/dev/null 2>&1
echo "Restarting the model worker…"
$COMPOSE up -d model-worker >/dev/null 2>&1
echo "Thawed. The demo day will re-seed on the next even hour."
