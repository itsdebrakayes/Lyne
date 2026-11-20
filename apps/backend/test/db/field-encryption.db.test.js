/**
 * Field encryption against a REAL MySQL server: a walk-in's phone number and
 * date of birth go into the database sealed, and come back readable through
 * the API's pool.
 *
 *   npm run test:db     (local Docker MySQL; creates and deletes rows "fet-*")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const Module = require('module');
const mysql = require('mysql2/promise');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`field-encryption test refuses to run against ${host}: local databases only.`);
}

const BIZ = 'fet-biz';
const BRANCH = 'fet-branch';
const SERVICE = 'fet-svc';
const CLERK = 'fet-clerk-uid';

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

test('walk-in and app-user personal details are stored sealed, read back plain, and found by fingerprint', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.FIELD_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://field-encryption-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  stubModule('@supabase/supabase-js', {
    createClient: () => ({ auth: { getUser: async (token) => ({ data: { user: { id: token, email: `${token}@Example.test`, user_metadata: { full_name: 'Fet Person' } } }, error: null }) } }),
  }, module);
  stubModule('../../src/utils/pushSender', { sendPushToUser: async () => ({ sent: 0 }) }, module);

  const pool = require('../../src/db/pool');
  const raw = await mysql.createConnection({
    host, port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'lyne',
    password: process.env.MYSQL_PASSWORD || '', database: process.env.MYSQL_DATABASE || 'lyne',
  });
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', require('../../src/routes/tickets'));
  app.use('/api/auth', require('../../src/routes/auth'));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));

  const cleanup = async () => {
    await raw.query('DELETE e FROM queue_events e JOIN queue_tickets t ON t.id = e.ticket_id JOIN queues q ON q.id = t.queue_id WHERE q.branch_id = ?', [BRANCH]);
    await raw.query('DELETE t FROM queue_tickets t JOIN queues q ON q.id = t.queue_id WHERE q.branch_id = ?', [BRANCH]);
    await raw.query('DELETE FROM queues WHERE branch_id = ?', [BRANCH]);
    await raw.query('DELETE FROM counters WHERE branch_id = ?', [BRANCH]);
    await raw.query("DELETE FROM staff WHERE id LIKE 'fet-%'");
    await raw.query("DELETE FROM users WHERE supabase_uid = 'fet-user-uid'");
    await raw.query('DELETE FROM services WHERE id = ?', [SERVICE]);
    await raw.query('DELETE FROM branches WHERE id = ?', [BRANCH]);
    await raw.query('DELETE FROM businesses WHERE id = ?', [BIZ]);
  };
  t.after(async () => {
    await cleanup().catch(() => {});
    await new Promise((r) => server.close(r));
    await raw.end();
    await pool.end();
  });

  await cleanup();
  await raw.query(`INSERT INTO businesses (id, name, slug, subscription_tier_id)
    VALUES (?, 'Field Encryption Test', 'fet-field-encryption', (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`, [BIZ]);
  await raw.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?)', [BRANCH, BIZ, 'FET Branch']);
  await raw.query('INSERT INTO services (id, business_id, name, ticket_prefix, base_avg_time_minutes) VALUES (?, ?, ?, ?, ?)', [SERVICE, BIZ, 'Registration', 'FE', 10]);
  await raw.query('INSERT INTO counters (id, branch_id, service_id, counter_number, label) VALUES (?, ?, ?, 1, ?)', ['fet-counter', BRANCH, SERVICE, 'Window 1']);
  await raw.query(`INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email)
    VALUES ('fet-staff', ?, ?, (SELECT id FROM roles WHERE name = 'kiosk_clerk'), ?, 'FET-K1', 'Clerk', 'fet-clerk@example.test')`, [BIZ, BRANCH, CLERK]);

  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/tickets/walk-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CLERK}` },
    body: JSON.stringify({ service_id: SERVICE, guest_name: 'Walk In', guest_phone: '8765550123', guest_dob: '1990-01-31' }),
  });
  const body = await res.json();
  assert.equal(res.status, 201, JSON.stringify(body));

  const [[stored]] = await raw.query('SELECT guest_phone, guest_dob FROM queue_tickets WHERE id = ?', [body.id]);
  assert.match(stored.guest_phone, /^enc:v1:/, 'the phone number is sealed in the database');
  assert.match(stored.guest_dob, /^enc:v1:/, 'the date of birth is sealed in the database');
  assert.ok(!JSON.stringify(stored).includes('8765550123'));

  const [[read]] = await pool.query('SELECT guest_phone, guest_dob FROM queue_tickets WHERE id = ?', [body.id]);
  assert.deepEqual({ ...read }, { guest_phone: '8765550123', guest_dob: '1990-01-31' });

  await assert.rejects(
    pool.query('UPDATE queue_tickets SET guest_phone = ? WHERE id = ?', ['8765550123', body.id]),
    /guest_phone must be stored sealed/,
  );

  /* An app user signing up: name and email sealed, found again by fingerprint. */
  const signup = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/sync-user`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fet-user-uid' },
    body: JSON.stringify({ phone: '8765550199' }),
  });
  assert.equal(signup.status, 201, await signup.clone().text());
  const [[user]] = await raw.query("SELECT full_name, email, email_hash, phone FROM users WHERE supabase_uid = 'fet-user-uid'");
  for (const col of ['full_name', 'email', 'phone']) assert.match(user[col], /^enc:v1:/, `users.${col} is sealed`);
  const { fingerprint } = require('../../src/lib/fieldCrypto');
  const [[found]] = await pool.query('SELECT full_name, email, phone FROM users WHERE email_hash = ?', [fingerprint('FET-USER-UID@example.test')]);
  assert.deepEqual({ ...found }, { full_name: 'Fet Person', email: 'fet-user-uid@Example.test', phone: '8765550199' });
});
