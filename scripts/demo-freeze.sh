#!/usr/bin/env bash
# demo-freeze.sh — put the demo box in a state that will not move under you.
#
# The scheduled refresh runs on even hours. 14:00 is 2pm, which is when the TAJ
# demo starts, and it re-dates queues and tops up lines while somebody is
# presenting. It no longer destroys work a clerk has done — that is fixed
# separately — but a line that grows by nine people mid-sentence is its own
# problem.
#
# So: fill the day once, deliberately, then stop anything from touching it again
# until the demo is over. `./scripts/demo-thaw.sh` puts it back.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.demo.yml"

echo "1/4  Filling today's lines one last time…"
$COMPOSE exec -T api node -e "
  const { refreshDemoData } = require('./scripts/refresh-demo-data');
  const pool = require('./src/db/pool');
  refreshDemoData().then(() => pool.end()).catch(e => { console.error(e.message); process.exit(1); });
" >/dev/null 2>&1 && echo "     done." || echo "     skipped (refresh unavailable)."

echo "2/4  Stopping the model worker, so predictions stop rewriting themselves…"
$COMPOSE stop model-worker >/dev/null 2>&1 && echo "     stopped." || echo "     was not running."

echo "3/4  Turning the scheduled re-seed off and restarting the API…"
# ALLOW_DEMO_DATA_REFRESH=false makes bootstrap() skip the re-seed entirely;
# the API still serves, and analytics still refresh.
ALLOW_DEMO_DATA_REFRESH=false $COMPOSE up -d --no-deps api >/dev/null 2>&1
sleep 6

echo "4/4  Checking what the demo will actually show…"
$COMPOSE exec -T api node -e "
  const pool = require('./src/db/pool');
  (async () => {
    const q = async (sql) => (await pool.query(sql))[0][0];
    const line   = await q(\"SELECT COUNT(*) n FROM queue_tickets t JOIN queues q ON q.id=t.queue_id WHERE q.queue_date=CURDATE() AND t.status='waiting'\");
    const staff  = await q('SELECT COUNT(*) n FROM staff WHERE supabase_uid IS NOT NULL');
    const models = await q('SELECT COUNT(DISTINCT insight_type) n FROM predictive_results WHERE generated_at > NOW() - INTERVAL 1 DAY');
    console.log('     ' + line.n + ' people waiting across today\\'s lines');
    console.log('     ' + staff.n + ' staff accounts can sign in');
    console.log('     ' + models.n + ' model insight types generated in the last day');
    await pool.end();
  })().catch(e => { console.error(e.message); process.exit(1); });
"

echo
echo "Frozen. Nothing will re-seed or re-predict until you run ./scripts/demo-thaw.sh."
echo "Counter override code: 246810 — any ticket accepts it."
