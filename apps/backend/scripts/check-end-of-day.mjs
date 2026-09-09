/**
 * check-end-of-day.mjs — what happens to somebody the branch could not serve.
 *
 * The lifecycle this proves, end to end:
 *
 *   A person joins a line. The branch closes before their number comes up.
 *   They are taken OUT of the queue, so tomorrow's line starts empty and
 *   nobody inherits their place — and they are written INTO history, so the
 *   branch can see how many people it turned away and the customer can see
 *   they were there.
 *
 * The second half was missing. The sweep issues its own UPDATE rather than
 * going through PUT /tickets/:id/status, which is where wait_time_records and
 * visit_history are written — so everyone it closed was dequeued and then
 * vanished from both. A person who queued for two hours and was sent home had
 * no record they had ever been in the building.
 *
 * Runs inside the API container, against the demo database:
 *   docker exec lyne_api node scripts/check-end-of-day.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const pool = require(path.join(here, '..', 'src', 'db', 'pool.js'));
const { runTicketExpiry } = require(path.join(here, '..', 'src', 'jobs', 'expireStaleTickets.js'));

const QUEUE = 'zz-eod-queue';
const TICKET = 'zz-eod-ticket';
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function cleanup() {
  await pool.query('DELETE FROM wait_time_records WHERE ticket_id = ?', [TICKET]);
  await pool.query('DELETE FROM visit_history WHERE ticket_id = ?', [TICKET]);
  await pool.query('DELETE FROM queue_events WHERE ticket_id = ?', [TICKET]);
  await pool.query('DELETE FROM queue_tickets WHERE id = ?', [TICKET]);
  await pool.query('DELETE FROM queues WHERE id = ?', [QUEUE]);
}

console.log('\n\x1b[1mEND OF DAY: the person who was not served\x1b[0m\n');
await cleanup();

// A branch/service pair with no queue yesterday, so the scratch queue is unique.
const [[seed]] = await pool.query(
  `SELECT b.id AS branch_id, s.id AS service_id,
          COALESCE(b.closing_time, bz.default_closing_time) AS closes
     FROM branches b
     JOIN businesses bz ON bz.id = b.business_id
     JOIN services s ON s.business_id = b.business_id
    WHERE NOT EXISTS (
      SELECT 1 FROM queues q WHERE q.branch_id = b.id AND q.service_id = s.id
        AND q.queue_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY))
    LIMIT 1`
);
if (!seed) { console.log('  no free branch/service pair'); process.exit(2); }

const [[customer]] = await pool.query('SELECT id FROM users LIMIT 1');

await pool.query(
  `INSERT INTO queues (id, branch_id, service_id, queue_date, is_active, max_capacity)
   VALUES (?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 1 DAY), TRUE, 200)`,
  [QUEUE, seed.branch_id, seed.service_id]
);
// Joined two hours before the branch shut, and never called.
await pool.query(
  `INSERT INTO queue_tickets
     (id, queue_id, user_id, ticket_number, verification_code, position, status, channel, joined_at)
   VALUES (?, ?, ?, 'EOD-001', 'EOD00001', 1, 'waiting', 'app',
           TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), SUBTIME(?, '02:00:00')))`,
  [TICKET, QUEUE, customer.id, seed.closes]
);

const before = await pool.query(
  "SELECT status FROM queue_tickets WHERE id = ?", [TICKET]
);
check('Starts out standing in yesterday’s line', before[0][0].status === 'waiting', 'waiting');

await runTicketExpiry();

const [[after]] = await pool.query(
  'SELECT status, closed_reason, completed_at FROM queue_tickets WHERE id = ?', [TICKET]
);
check('Dequeued when the branch closed',
  after.status === 'cancelled', `status=${after.status}`);
check('History says WHY, not just that it ended',
  after.closed_reason === 'branch_closed_before_called', `${after.closed_reason}`);

/* The whole point of stamping closing time: the recorded wait must not include
   the hours the branch was shut. */
const [[wtr]] = await pool.query(
  'SELECT wait_time_minutes, service_time_minutes, status, visit_date FROM wait_time_records WHERE ticket_id = ?',
  [TICKET]
);
check('Counted in the analytics the branch is measured on', !!wtr,
  wtr ? `status=${wtr.status}` : 'MISSING from wait_time_records');
if (wtr) {
  check('Wait stops at closing time, not overnight',
    wtr.wait_time_minutes > 0 && wtr.wait_time_minutes <= 180,
    `${wtr.wait_time_minutes} min recorded`);
  check('Not credited with a service that never happened',
    wtr.service_time_minutes === null, `service_time=${wtr.service_time_minutes}`);
  check('Filed under the day it happened',
    String(wtr.visit_date).slice(0, 10) !== new Date().toISOString().slice(0, 10),
    `${String(wtr.visit_date).slice(0, 10)} (not today)`);
}

const [[vh]] = await pool.query(
  'SELECT status, wait_time_minutes FROM visit_history WHERE ticket_id = ?', [TICKET]
);
check('Visible in the customer’s own history', !!vh,
  vh ? `${vh.status}, ${vh.wait_time_minutes} min` : 'MISSING from visit_history');

const [events] = await pool.query(
  'SELECT previous_status, new_status, notes FROM queue_events WHERE ticket_id = ?', [TICKET]
);
check('An explanation exists for "why did my ticket cancel?"',
  events.length > 0 && /branch closed/i.test(events[0].notes || ''),
  events[0]?.notes || 'no audit event');

/* Tomorrow's line must not inherit them. */
const [[stillLive]] = await pool.query(
  `SELECT COUNT(*) AS n FROM queue_tickets
    WHERE queue_id = ? AND status IN ('waiting','called','in_service')`, [QUEUE]
);
check('Nobody is left standing in the old line', stillLive.n === 0, `${stillLive.n} live`);

await cleanup();
await pool.end();

const failed = results.filter((r) => !r.ok);
console.log(`\n\x1b[1m${results.length - failed.length}/${results.length} passed\x1b[0m\n`);
process.exit(failed.length ? 1 : 0);
