/**
 * Customer Directory search against a REAL MySQL server, with field encryption on
 * (src/lib/fieldCrypto.js). Names, emails and phones are sealed in the database,
 * so SQL cannot match them; GET /api/analytics/customers reads the window and
 * matches in JavaScript after the pool decrypts. This locks that in:
 *
 *   - an account-holder is found by part of their PHONE number,
 *   - and by part of their NAME,
 *   - the row comes back READABLE (never "enc:v1:…"),
 *   - a walk-in (guest, no account) is NOT in the directory, by design,
 *     even when its phone matches the search.
 *
 *   npm run test:db     (local Docker MySQL; creates and deletes rows "cps-*")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('module');
const { seal, fingerprint } = require('../../src/lib/fieldCrypto');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`customer-phone-search test refuses to run against ${host}: local databases only.`);
}

const BIZ = 'cps-biz';
const BRANCH = 'cps-branch';
const SERVICE = 'cps-svc';
const QUEUE = 'cps-queue';
const EXEC = 'cps-exec-uid';

const NAME = 'Marcus Reid';
const PHONE = '8765550147';
const EMAIL = 'marcus.reid@example.test';

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let pool;
let server;
let baseUrl;

async function cleanup() {
  await pool.query('DELETE FROM queue_tickets WHERE queue_id = ?', [QUEUE]);
  await pool.query('DELETE FROM queues WHERE id = ?', [QUEUE]);
  await pool.query("DELETE FROM staff WHERE id LIKE 'cps-%'");
  await pool.query("DELETE FROM users WHERE id = 'cps-user'");
  await pool.query('DELETE FROM services WHERE id = ?', [SERVICE]);
  await pool.query('DELETE FROM branches WHERE id = ?', [BRANCH]);
  await pool.query('DELETE FROM businesses WHERE id = ?', [BIZ]);
}

async function seed() {
  await pool.query(
    `INSERT INTO businesses (id, name, slug, subscription_tier_id)
     VALUES (?, 'Customer Search Test Org', 'cps-customer-search-test', (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`,
    [BIZ]
  );
  await pool.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?)', [BRANCH, BIZ, 'Test Branch']);
  await pool.query('INSERT INTO services (id, business_id, name, ticket_prefix) VALUES (?, ?, ?, ?)', [SERVICE, BIZ, 'Registration', 'CP']);
  await pool.query("INSERT INTO queues (id, branch_id, service_id, queue_date) VALUES (?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 1 DAY))", [QUEUE, BRANCH, SERVICE]);

  const role = async (name) => (await pool.query('SELECT id FROM roles WHERE name = ?', [name]))[0][0].id;
  await pool.query(
    `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email, email_hash)
     VALUES ('cps-exec', ?, NULL, ?, ?, 'CPS-E', ?, ?, ?)`,
    [BIZ, await role('executive'), EXEC, seal('Test Executive'), seal('cps-exec@example.test'), fingerprint('cps-exec@example.test')]
  );

  // The account-holder: sealed name, email and phone.
  await pool.query(
    'INSERT INTO users (id, supabase_uid, email, email_hash, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
    ['cps-user', 'cps-user-uid', seal(EMAIL), fingerprint(EMAIL), seal(NAME), seal(PHONE)]
  );
  // An ended visit, so they appear in the directory window.
  await pool.query(
    "INSERT INTO queue_tickets (id, queue_id, user_id, ticket_number, verification_code, position, status) VALUES (?, ?, 'cps-user', 'CP-1', 'CPS01', 1, 'served')",
    ['cps-t-user', QUEUE]
  );

  // A walk-in with a DIFFERENT phone, sealed. No account, so the directory must
  // not return it even when searched by its number.
  await pool.query(
    `INSERT INTO queue_tickets (id, queue_id, user_id, guest_name, guest_name_hash, guest_phone, ticket_number, verification_code, position, status)
     VALUES (?, ?, NULL, ?, ?, ?, 'CP-2', 'CPS02', 2, 'served')`,
    ['cps-t-walkin', QUEUE, seal('Wanda Walker'), fingerprint('Wanda Walker'), seal('8765559999')]
  );
}

async function customers(q) {
  const res = await fetch(`${baseUrl}/api/analytics/customers?business_id=${BIZ}&days=90${q ? `&q=${encodeURIComponent(q)}` : ''}`, {
    headers: { Authorization: `Bearer ${EXEC}` },
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: payload };
}

test('the Customer Directory finds an account-holder by sealed phone and name, readable, and excludes walk-ins', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://customer-search-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  stubModule('@supabase/supabase-js', {
    createClient: () => ({ auth: { getUser: async (token) => ({ data: { user: { id: token } }, error: null }) } }),
  }, module);

  pool = require('../../src/db/pool');
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', require('../../src/routes/analytics'));
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

  const noCipher = (body) => assert.ok(!JSON.stringify(body).includes('enc:v1:'), 'no sealed ciphertext leaks to the client');

  // ── By part of the phone number.
  const byPhone = await customers('5550147');
  assert.equal(byPhone.status, 200, JSON.stringify(byPhone.body));
  assert.equal(byPhone.body.customers.length, 1, 'exactly the one account-holder matches the phone fragment');
  const row = byPhone.body.customers[0];
  assert.equal(row.user_id, 'cps-user');
  assert.equal(row.full_name, NAME, 'the name comes back readable, not ciphertext');
  assert.ok(row.phone && !String(row.phone).includes('enc:v1:'), 'the phone is readable (masked), not ciphertext');
  noCipher(byPhone.body);

  // A spaced form of the same number still matches (digits, not exact text).
  assert.equal((await customers('876 555 0147')).body.customers.length, 1, 'spacing in the query does not matter');

  // ── By part of the name.
  const byName = await customers('marcus');
  assert.equal(byName.status, 200, JSON.stringify(byName.body));
  assert.equal(byName.body.customers.length, 1);
  assert.equal(byName.body.customers[0].full_name, NAME);

  // ── A walk-in's number finds nobody: guests have no account and are not in the directory.
  const walkin = await customers('5559999');
  assert.equal(walkin.status, 200, JSON.stringify(walkin.body));
  assert.equal(walkin.body.customers.length, 0, 'walk-ins (no account) are excluded by design');

  // ── A number nobody has finds nobody.
  assert.equal((await customers('5550000')).body.customers.length, 0);
});
