/**
 * Walk-in numbering under real concurrency, against a REAL MySQL server.
 *
 * Robert Lawrence's question after the 10 November 2026 demo: three clerks
 * enter walk-ins in the same second while people join from the app — who
 * hands out the numbers, and can two people end up with the same place?
 *
 * The in-memory harnesses cannot answer that: they have no locks and no
 * transactions. So this file runs the real ticket routes over the real pool,
 * against a throwaway organisation in a local database, and fires every join
 * at once:
 *
 *   - several kiosk clerks adding walk-ins (POST /api/tickets/walk-in)
 *   - several customers joining from the app (POST /api/tickets)
 *
 * and then checks the line: every request succeeded, positions are exactly
 * 1..N with no duplicate and no gap, and every ticket number and verification
 * code is unique. It repeats the burst several times, because a race that
 * loses one round in five is still a race.
 *
 * It needs a database, so it only runs when asked:
 *
 *   npm run test:db        (local Docker MySQL on 127.0.0.1:3307, from ../../.env)
 *
 * It creates rows with ids starting "cct-" and deletes them afterwards. Never
 * point it at production.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('module');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`walk-in concurrency test refuses to run against ${host}: local databases only.`);
}

const CLERKS = 3;
const WALKINS_PER_CLERK = 6;
const APP_USERS = 10;
const ROUNDS = 5;

const BIZ = 'cct-biz';
const BRANCH = 'cct-branch';
const SERVICE = 'cct-svc';
const clerkUid = (i) => `cct-clerk-${i}`;
const userUid = (i) => `cct-user-${i}`;

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let pool;
let server;
let baseUrl;

async function cleanup() {
  const q = (sql, p) => pool.query(sql, p);
  await q(`DELETE e FROM queue_events e JOIN queue_tickets t ON t.id = e.ticket_id JOIN queues q ON q.id = t.queue_id WHERE q.branch_id = ?`, [BRANCH]);
  await q(`DELETE t FROM queue_tickets t JOIN queues q ON q.id = t.queue_id WHERE q.branch_id = ?`, [BRANCH]);
  await q('DELETE FROM queues WHERE branch_id = ?', [BRANCH]);
  await q('DELETE FROM counters WHERE branch_id = ?', [BRANCH]);
  await q("DELETE FROM staff WHERE id LIKE 'cct-%'");
  await q("DELETE FROM users WHERE id LIKE 'cct-%'");
  await q('DELETE FROM services WHERE id = ?', [SERVICE]);
  await q('DELETE FROM branches WHERE id = ?', [BRANCH]);
  await q('DELETE FROM businesses WHERE id = ?', [BIZ]);
}

async function seed() {
  await pool.query(
    `INSERT INTO businesses (id, name, slug, subscription_tier_id)
     VALUES (?, 'Concurrency Test Org', 'cct-concurrency-test', (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`,
    [BIZ]
  );
  // No opening/closing hours: the branch is always open, so the test does not
  // depend on the time of day it runs.
  await pool.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?)', [BRANCH, BIZ, 'Concurrency Test Branch']);
  await pool.query(
    'INSERT INTO services (id, business_id, name, ticket_prefix, base_avg_time_minutes) VALUES (?, ?, ?, ?, ?)',
    [SERVICE, BIZ, 'Registration', 'CT', 10]
  );
  await pool.query(
    'INSERT INTO counters (id, branch_id, service_id, counter_number, label) VALUES (?, ?, ?, 1, ?)',
    ['cct-counter-1', BRANCH, SERVICE, 'Window 1']
  );
  for (let i = 1; i <= CLERKS; i++) {
    await pool.query(
      `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'kiosk_clerk'), ?, ?, ?, ?)`,
      [`cct-staff-${i}`, BIZ, BRANCH, clerkUid(i), `CCT-K${i}`, `Clerk ${i}`, `cct-clerk-${i}@example.test`]
    );
  }
  for (let i = 1; i <= APP_USERS; i++) {
    await pool.query(
      'INSERT INTO users (id, supabase_uid, email, full_name) VALUES (?, ?, ?, ?)',
      [`cct-user-${i}`, userUid(i), `cct-user-${i}@example.test`, `App User ${i}`]
    );
  }
}

async function post(token, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: payload };
}

test('simultaneous walk-ins and app joins never share or skip a place', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://concurrency-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  // The join limiter keys on the signed-in actor, so each clerk and user has
  // their own allowance and the burst reaches the lock under test.

  // Only identity is faked: the token IS the Supabase uid. Everything after
  // that — staff/user lookup, transactions, row locks, numbering — is real.
  stubModule('@supabase/supabase-js', {
    createClient: () => ({
      auth: { getUser: async (token) => ({ data: { user: { id: token } }, error: null }) },
    }),
  }, module);
  stubModule('../../src/utils/pushSender', { sendPushToUser: async () => ({ sent: 0 }) }, module);

  pool = require('../../src/db/pool');
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', require('../../src/routes/tickets'));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await cleanup().catch(() => {});
    await new Promise((r) => server.close(r));
    await pool.end();
  });

  await cleanup();
  await seed();

  for (let round = 1; round <= ROUNDS; round++) {
    // Clear the line between rounds; the throwaway rows stay.
    await pool.query(`DELETE e FROM queue_events e JOIN queue_tickets t ON t.id = e.ticket_id JOIN queues q ON q.id = t.queue_id WHERE q.branch_id = ?`, [BRANCH]);
    await pool.query(`DELETE t FROM queue_tickets t JOIN queues q ON q.id = t.queue_id WHERE q.branch_id = ?`, [BRANCH]);
    await pool.query('DELETE FROM queues WHERE branch_id = ?', [BRANCH]);

    // The first walk-in of the day opens the line; the app needs its id.
    // Rounds alternate: odd rounds open it first, even rounds let the burst
    // race to create today's queue row as well.
    let queueId = null;
    let opened = 0;
    if (round % 2 === 1) {
      const first = await post(clerkUid(1), '/api/tickets/walk-in', { service_id: SERVICE, guest_name: 'Opener' });
      assert.equal(first.status, 201, `opening walk-in failed: ${JSON.stringify(first.body)}`);
      queueId = first.body.queue_id;
      opened = 1;
    } else {
      await pool.query(
        "INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity) VALUES (?, ?, ?, CURDATE(), 50)",
        [`cct-queue-${round}`, BRANCH, SERVICE]
      );
      queueId = `cct-queue-${round}`;
    }

    const requests = [];
    for (let c = 1; c <= CLERKS; c++) {
      for (let k = 1; k <= WALKINS_PER_CLERK; k++) {
        requests.push(post(clerkUid(c), '/api/tickets/walk-in', { service_id: SERVICE, guest_name: `Walk-in ${c}.${k}` }));
      }
    }
    for (let u = 1; u <= APP_USERS; u++) {
      requests.push(post(userUid(u), '/api/tickets', { queue_id: queueId }));
    }
    const results = await Promise.all(requests);

    const failed = results.filter((r) => r.status !== 201);
    assert.equal(failed.length, 0, `round ${round}: ${failed.length} joins failed: ${JSON.stringify(failed.slice(0, 3))}`);

    const [rows] = await pool.query(
      `SELECT t.position, t.ticket_number, t.verification_code, t.channel
         FROM queue_tickets t JOIN queues q ON q.id = t.queue_id
        WHERE q.branch_id = ? ORDER BY t.position`,
      [BRANCH]
    );
    const expected = opened + CLERKS * WALKINS_PER_CLERK + APP_USERS;
    assert.equal(rows.length, expected, `round ${round}: expected ${expected} tickets, found ${rows.length}`);

    const positions = rows.map((r) => Number(r.position));
    const dupes = positions.filter((p, i) => positions.indexOf(p) !== i);
    assert.deepEqual(dupes, [], `round ${round}: two people were given the same place: ${dupes.join(', ')}`);
    assert.deepEqual(positions, Array.from({ length: expected }, (_, i) => i + 1), `round ${round}: places are not 1..${expected} with no gaps`);
    assert.equal(new Set(rows.map((r) => r.ticket_number)).size, expected, `round ${round}: a ticket number was issued twice`);
    assert.equal(new Set(rows.map((r) => r.verification_code)).size, expected, `round ${round}: a verification code was issued twice`);
    assert.equal(rows.filter((r) => r.channel === 'kiosk').length, opened + CLERKS * WALKINS_PER_CLERK);
    assert.equal(rows.filter((r) => r.channel === 'app').length, APP_USERS);
  }
});
