/**
 * check-integrity.mjs — the invariants a queue system is allowed to break zero
 * times, checked against the live database.
 *
 * Not a test suite. `npm test` runs in memory and proves the code does what it
 * says; this asks whether the DATA a real branch is standing in front of is
 * self-consistent right now. Both of the serious bugs found in this system were
 * invisible to unit tests and obvious here: two tickets sharing position 1, and
 * live tickets surviving five days past their branch closing.
 *
 * Every check states what would go wrong for a person if it failed. A check
 * nobody can act on gets deleted rather than muted.
 *
 *   node scripts/check-integrity.mjs            # demo database (3308)
 *   CHECK_MYSQL_PORT=3307 node scripts/…        # production database
 *
 * Exits non-zero if anything fails, so it can gate a deploy.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config({ path: path.resolve(here, '../.env'), override: false });

const conn = await mysql.createConnection({
  host: process.env.CHECK_MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.CHECK_MYSQL_PORT || 3308),
  user: process.env.CHECK_MYSQL_USER || process.env.MYSQL_USER || 'lyne',
  password: process.env.CHECK_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.CHECK_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'lyne',
});

const LIVE = "('waiting','called','in_service')";
const results = [];

async function check(name, consequence, sql) {
  const [rows] = await conn.query(sql);
  const failed = rows.length > 0;
  results.push({ name, consequence, failed, rows });
  const mark = failed ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
  console.log(`  ${mark} ${name}${failed ? ` — ${rows.length} offending row(s)` : ''}`);
  if (failed) {
    rows.slice(0, 3).forEach((r) => console.log(`      ${JSON.stringify(r)}`));
    if (rows.length > 3) console.log(`      …and ${rows.length - 3} more`);
  }
}

console.log('\n\x1b[1mDATA INTEGRITY\x1b[0m\n');

/* ── the queue itself ─────────────────────────────────────────────────────── */

await check(
  'No two live tickets share a position in the same queue',
  'Two people are told they are next, and one of them is wrong.',
  `SELECT queue_id, position, COUNT(*) AS tickets
     FROM queue_tickets WHERE status IN ${LIVE}
    GROUP BY queue_id, position HAVING COUNT(*) > 1`
);

await check(
  'No ticket number appears twice in the same queue',
  'A clerk calls a number and two people stand up.',
  `SELECT queue_id, ticket_number, COUNT(*) AS tickets
     FROM queue_tickets WHERE status IN ${LIVE}
    GROUP BY queue_id, ticket_number HAVING COUNT(*) > 1`
);

await check(
  'No live ticket predates today',
  "Yesterday's abandoned tickets inflate every wait estimate and block the line.",
  `SELECT t.id, t.ticket_number, t.status, DATE(t.joined_at) AS joined
     FROM queue_tickets t
    WHERE t.status IN ${LIVE} AND DATE(t.joined_at) < CURDATE()`
);

await check(
  'No live ticket sits on a queue dated before today',
  'A queue row reused across dates lets a new arrival be numbered on top of people already in it.',
  `SELECT q.id AS queue_id, q.queue_date, COUNT(t.id) AS live_tickets
     FROM queues q JOIN queue_tickets t ON t.queue_id = q.id
    WHERE t.status IN ${LIVE} AND q.queue_date < CURDATE()
    GROUP BY q.id, q.queue_date`
);

await check(
  'One queue per branch, service and day',
  'Two queues for the same desk on the same day split the line in half.',
  `SELECT branch_id, service_id, queue_date, COUNT(*) AS queues
     FROM queues GROUP BY branch_id, service_id, queue_date HAVING COUNT(*) > 1`
);

await check(
  'Nobody holds more than one live ticket',
  'One person occupying two places is the queue-jumping the product exists to prevent.',
  `SELECT user_id, COUNT(*) AS live_tickets
     FROM queue_tickets WHERE status IN ${LIVE} AND user_id IS NOT NULL
    GROUP BY user_id HAVING COUNT(*) > 1`
);

await check(
  'No verification code is reused within a queue',
  'The code at the counter stops proving who somebody is.',
  `SELECT queue_id, verification_code, COUNT(*) AS tickets
     FROM queue_tickets WHERE status IN ${LIVE}
    GROUP BY queue_id, verification_code HAVING COUNT(*) > 1`
);

await check(
  'Positions are positive',
  'A zero or negative position sorts ahead of everyone, forever.',
  `SELECT id, ticket_number, position FROM queue_tickets
    WHERE status IN ${LIVE} AND position < 1`
);

/* ── the operating model the daily sweep depends on ───────────────────────── */

await check(
  'Every branch resolves to a closing time',
  'A branch with no closing time is never swept, so its queue never empties.',
  `SELECT b.id, b.name FROM branches b
     JOIN businesses bz ON bz.id = b.business_id
    WHERE COALESCE(b.closing_time, bz.default_closing_time) IS NULL`
);

await check(
  'Opening time precedes closing time',
  'A branch that closes before it opens is never open, so nobody can ever join it.',
  `SELECT b.id, b.name,
          COALESCE(b.opening_time, bz.default_opening_time) AS opens,
          COALESCE(b.closing_time, bz.default_closing_time) AS closes
     FROM branches b JOIN businesses bz ON bz.id = b.business_id
    WHERE COALESCE(b.opening_time, bz.default_opening_time)
          >= COALESCE(b.closing_time, bz.default_closing_time)`
);

/* ── referential sanity ───────────────────────────────────────────────────── */

await check(
  'No ticket is orphaned from its queue',
  'A ticket with no queue cannot be called, and cannot be found to explain why.',
  `SELECT t.id FROM queue_tickets t
     LEFT JOIN queues q ON q.id = t.queue_id WHERE q.id IS NULL`
);

await check(
  'No queue is orphaned from its branch or service',
  'A queue nobody owns appears in no dashboard and is served by nobody.',
  `SELECT q.id FROM queues q
     LEFT JOIN branches b ON b.id = q.branch_id
     LEFT JOIN services s ON s.id = q.service_id
    WHERE b.id IS NULL OR s.id IS NULL`
);

await check(
  'Every staff member has a role that exists',
  'A staff account with a dangling role is either locked out or unbounded.',
  `SELECT s.id, s.email FROM staff s
     LEFT JOIN roles r ON r.id = s.role_id WHERE r.id IS NULL`
);

/* ── states that contradict themselves ────────────────────────────────────── */

await check(
  'A served ticket has a completion time',
  'Analytics measure service duration from it; without it the visit is invisible.',
  `SELECT id, ticket_number FROM queue_tickets
    WHERE status = 'served' AND completed_at IS NULL`
);

await check(
  'Nothing was served before it was joined',
  'A negative wait poisons every average it lands in.',
  `SELECT id, ticket_number, joined_at, completed_at FROM queue_tickets
    WHERE completed_at IS NOT NULL AND completed_at < joined_at`
);

await check(
  'An in-service ticket has actually started',
  'The service timer on the staff screen counts from a timestamp that is not there.',
  `SELECT id, ticket_number FROM queue_tickets
    WHERE status = 'in_service' AND started_serving_at IS NULL`
);

await check(
  'A called ticket has a call expiry',
  'Without it the no-show timer never fires and the desk blocks forever.',
  `SELECT id, ticket_number FROM queue_tickets
    WHERE status = 'called' AND call_expires_at IS NULL`
);

/* ── summary ──────────────────────────────────────────────────────────────── */
await conn.end();

const failed = results.filter((r) => r.failed);
console.log(`\n\x1b[1m${results.length - failed.length}/${results.length} invariants hold\x1b[0m`);
if (failed.length) {
  console.log('\n\x1b[31mBROKEN:\x1b[0m');
  failed.forEach((f) => console.log(`  · ${f.name}\n      ${f.consequence}`));
}
console.log();
process.exit(failed.length ? 1 : 0);
