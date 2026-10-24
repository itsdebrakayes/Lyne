#!/usr/bin/env bash
# demo-switch.sh — point the seven demo.*@uselyne.com logins at the next demo's
# organisation, on the LOCAL demo database (port 3308). Demo-only (CLAUDE.md rule 4).
#
#   bash scripts/demo-switch.sh bank          # Lignum Bank
#   bash scripts/demo-switch.sh creditunion   # Community First Credit Union
#   bash scripts/demo-switch.sh court         # Traffic Court
#   bash scripts/demo-switch.sh hospital      # Wrenfield Health
#
# Add --customer=<email> (or set DEMO_CUSTOMER_EMAIL) for the account the demo
# phone is signed in as: it gets the next appointment slot today, to check in
# to, and no other booking, so a Saturday session can be registered for live.
#   bash scripts/demo-switch.sh blueharbour   # back to exactly what production has
#
# Seats are per day, so run it again on the morning of the demo.
set -euo pipefail
cd "$(dirname "$0")/../apps/backend"
ALLOW_DEMO_SWITCH=true MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 node scripts/demo-switch.js "$@"
