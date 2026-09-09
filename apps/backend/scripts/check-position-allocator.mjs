/**
 * check-position-allocator.mjs — the two properties a place in line must have.
 *
 * Needs a live database, which is why it is a script and not a test: `npm test`
 * runs entirely in memory, and this logic lives in a SQL WHERE clause. A mocked
 * connection here would only prove that the mock agrees with itself.
 *
 *   1. A new arrival is never placed at or below anyone still live. Otherwise
 *      somebody who waited overnight is leapfrogged, two tickets share a
 *      position, and "you're next" is shown to both.
 *
 *   2. Numbering still restarts at 1 each morning once the previous day is
 *      closed off — the reason the CURDATE() scoping exists at all. Without it
 *      MAX(position) climbs forever and the seventh person in line is handed
 *      ticket PAY-904.
 *
 * A change that satisfies either one alone is not a fix. Run it against the
 * demo database after touching utils/ticketSlot.js:
 *
 *   node scripts/check-position-allocator.mjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { issueTicketSlot } = require(path.join(here, '..', 'src', 'utils', 'ticketSlot.js'));

dotenv.config({ path: path.resolve(here, '../../../.env') });
dotenv.config({ path: path.resolve(here, '../.env'), override: false });

/* Connects as the APPLICATION user, not root, and that is deliberate on two
   counts. root@'%' no longer exists (see database/security/harden_database.sql),
   so a root-over-TCP default would simply fail. More usefully: the allocator is
   application code, so checking it through the application's own privileges
   proves the least-privilege grant is actually sufficient for it. */
const conn = await mysql.createConnection({
  host: process.env.CHECK_MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.CHECK_MYSQL_PORT || 3308),
  user: process.env.CHECK_MYSQL_USER || process.env.MYSQL_USER || 'lyne',
  password: process.env.CHECK_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.CHECK_MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'lyne',
});

const QUEUE = 'zz-check-position-allocator';
async function cleanup() {
  await conn.query('DELETE FROM queue_tickets WHERE queue_id = ?', [QUEUE]);
  await conn.query('DELETE FROM queues WHERE id = ?', [QUEUE]);
}

/* A real branch/service, so counters and the ETA model behave normally — but a
   pair with no queue today, because (branch, service, date) is unique. */
const [[seed]] = await conn.query(
  `SELECT b.id AS branch_id, s.id AS service_id
     FROM branches b
     JOIN services s ON s.business_id = b.business_id
    WHERE NOT EXISTS (
      SELECT 1 FROM queues q
       WHERE q.branch_id = b.id AND q.service_id = s.id AND q.queue_date = CURDATE())
    LIMIT 1`
);
if (!seed) {
  console.log('No free branch/service pair to test with — every pair already has a queue today.');
  await conn.end();
  process.exit(2);
}

async function scenario({ title, yesterdayStatus, expectation, assert: check }) {
  await cleanup();
  await conn.query(
    `INSERT INTO queues (id, branch_id, service_id, queue_date, is_active, max_capacity)
     VALUES (?, ?, ?, CURDATE(), TRUE, 500)`,
    [QUEUE, seed.branch_id, seed.service_id]
  );
  for (let i = 1; i <= 5; i += 1) {
    await conn.query(
      `INSERT INTO queue_tickets (id, queue_id, ticket_number, verification_code, position, status, joined_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY))`,
      [`zz-old-${i}`, QUEUE, `OLD-00${i}`, `CODE000${i}`, i, yesterdayStatus]
    );
  }
  const slot = await issueTicketSlot(conn, {
    queueId: QUEUE, branchId: seed.branch_id, serviceId: seed.service_id,
    prefix: 'NEW', avgTimeMinutes: 15, waitingAhead: 5,
  });
  const ok = check(slot.position);
  console.log(`\n  ${title}`);
  console.log(`    yesterday's five tickets are : ${yesterdayStatus}`);
  console.log(`    expected                     : ${expectation}`);
  console.log(`    new arrival got              : position ${slot.position} (${slot.ticketNumber})`);
  console.log(ok ? '    PASS' : '    FAIL');
  return ok;
}

console.log('\nPOSITION ALLOCATOR');

const results = [
  await scenario({
    title: 'Queue was NOT tidied overnight',
    yesterdayStatus: 'waiting',
    expectation: 'position 6 — behind the five still waiting',
    assert: (pos) => pos === 6,
  }),
  await scenario({
    title: 'Queue WAS tidied overnight',
    yesterdayStatus: 'cancelled',
    expectation: 'position 1 — a fresh morning, numbering restarts',
    assert: (pos) => pos === 1,
  }),
  await scenario({
    title: 'Someone is mid-service at rollover',
    yesterdayStatus: 'in_service',
    expectation: 'position 6 — their place is still occupied',
    assert: (pos) => pos === 6,
  }),
];

await cleanup();
await conn.end();

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} properties hold\n`);
process.exit(passed === results.length ? 0 : 1);
