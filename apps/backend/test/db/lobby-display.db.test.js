/**
 * Lobby "Now Serving" screens (migration 052), against a REAL MySQL server:
 * who may create one, what its link shows (numbers and counters, never a name),
 * that it is embeddable, and that switching it off kills the link.
 *
 *   npm run test:db     (local Docker MySQL; creates and deletes rows "lbt-*")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('module');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`lobby-display test refuses to run against ${host}: local databases only.`);
}

const A = 'lbt-biz-a';
const B = 'lbt-biz-b';

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let pool;
let server;
let baseUrl;

async function cleanup() {
  for (const biz of [A, B]) {
    await pool.query('DELETE FROM lobby_displays WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM queue_tickets WHERE queue_id LIKE ?', [`${biz}-q%`]);
    await pool.query('DELETE FROM queues WHERE id LIKE ?', [`${biz}-q%`]);
    await pool.query('DELETE FROM audit_logs WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM staff WHERE business_id = ?', [biz]);
    await pool.query('DELETE c FROM counters c JOIN branches br ON br.id = c.branch_id WHERE br.business_id = ?', [biz]);
    await pool.query('DELETE FROM services WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM branches WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM businesses WHERE id = ?', [biz]);
  }
}

async function seedOrg(biz, label) {
  await pool.query(
    `INSERT INTO businesses (id, name, slug, subscription_tier_id)
     VALUES (?, ?, ?, (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`,
    [biz, `${label} Health`, `${biz}-slug`]
  );
  await pool.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?)', [`${biz}-branch`, biz, `${label} Main`]);
  await pool.query('INSERT INTO services (id, business_id, name, ticket_prefix) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
    [`${biz}-svc1`, biz, 'Pharmacy', 'PH', `${biz}-svc2`, biz, 'Radiology', 'RD']);
  await pool.query('INSERT INTO counters (id, branch_id, service_id, counter_number, label) VALUES (?, ?, ?, 1, ?)',
    [`${biz}-ctr`, `${biz}-branch`, `${biz}-svc1`, 'Window 3']);
  await pool.query('INSERT INTO queues (id, branch_id, service_id, queue_date) VALUES (?, ?, ?, CURDATE()), (?, ?, ?, CURDATE())',
    [`${biz}-q1`, `${biz}-branch`, `${biz}-svc1`, `${biz}-q2`, `${biz}-branch`, `${biz}-svc2`]);
  const role = async (name) => (await pool.query('SELECT id FROM roles WHERE name = ?', [name]))[0][0].id;
  await pool.query(
    `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email) VALUES
       (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`${biz}-mgr`, biz, `${biz}-branch`, await role('manager'), `${biz}-mgr-uid`, `LBT-${label}-M`, `${label} Manager`, `${biz}-mgr@example.test`,
      `${biz}-clerk`, biz, `${biz}-branch`, await role('line_staff'), `${biz}-clerk-uid`, `LBT-${label}-C`, `${label} Clerk`, `${biz}-clerk@example.test`]
  );
  await pool.query(
    `INSERT INTO queue_tickets (id, queue_id, ticket_number, verification_code, guest_name, guest_phone, visit_reason, position, status, called_at, served_at_counter_id) VALUES
       (?, ?, 'PH-007', 'LBT001', 'Secret Person', '+18765550111', 'private reason', 1, 'called', NOW(), ?),
       (?, ?, 'PH-008', 'LBT002', 'Another Person', NULL, NULL, 2, 'waiting', NULL, NULL),
       (?, ?, 'PH-009', 'LBT003', 'Third Person', NULL, NULL, 3, 'waiting', NULL, NULL),
       (?, ?, 'RD-001', 'LBT004', 'Fourth Person', NULL, NULL, 1, 'waiting', NULL, NULL)`,
    [`${biz}-t1`, `${biz}-q1`, `${biz}-ctr`, `${biz}-t2`, `${biz}-q1`, `${biz}-t3`, `${biz}-q1`, `${biz}-t4`, `${biz}-q2`]
  );
}

async function call(token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* a page */ }
  return { status: res.status, body: json, text, headers: res.headers };
}

test('a lobby screen shows numbers and counters by private link, and nothing else', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://lobby-display-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  stubModule('@supabase/supabase-js', {
    createClient: () => ({ auth: { getUser: async (token) => ({ data: { user: { id: token } }, error: null }) } }),
  }, module);

  pool = require('../../src/db/pool');
  const display = require('../../src/routes/display');
  const { forget } = require('../../src/lib/lobbyDisplay');
  const app = express();
  app.use(express.json());
  app.use('/display', display.pages);
  app.use('/api/display', display.feed);
  app.use('/api/displays', display.manage);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await cleanup().catch(() => {});
    await new Promise((r) => server.close(r));
    await pool.end();
  });

  await cleanup();
  await seedOrg(A, 'Alpha');
  await seedOrg(B, 'Bravo');

  // ── Who may create one: a manager for their own branch. Not a clerk, not next door.
  const create = (uid, body) => call(uid, 'POST', '/api/displays', body);
  assert.equal((await create(null, { branch_id: `${A}-branch`, name: 'Hall' })).status, 401);
  assert.equal((await create(`${A}-clerk-uid`, { branch_id: `${A}-branch`, name: 'Hall' })).status, 403);
  assert.equal((await create(`${B}-mgr-uid`, { branch_id: `${A}-branch`, name: 'Hall' })).status, 403, 'another organisation');
  assert.equal((await create(`${A}-mgr-uid`, { branch_id: `${A}-branch`, name: '' })).status, 400);
  assert.equal((await create(`${A}-mgr-uid`, { branch_id: `${A}-branch`, name: 'Hall', service_id: `${B}-svc1` })).status, 400, 'a service from another organisation');

  const made = await create(`${A}-mgr-uid`, { branch_id: `${A}-branch`, name: 'Main Hall' });
  assert.equal(made.status, 201, made.text);
  assert.match(made.body.path, /^\/display\/[A-Za-z0-9_-]{43}$/);
  const token = made.body.path.split('/').pop();

  // ── The feed: numbers, counters, counts. No names, phones, reasons or codes.
  const feed = await call(null, 'GET', `/api/display/${token}`);
  assert.equal(feed.status, 200, feed.text);
  assert.equal(feed.body.organisation, 'Alpha Health');
  assert.equal(feed.body.branch, 'Alpha Main');
  assert.deepEqual(feed.body.serving.map((s) => [s.ticket, s.counter, s.state]), [['PH-007', 'Window 3', 'called']]);
  const pharmacy = feed.body.lines.find((l) => l.service === 'Pharmacy');
  assert.equal(pharmacy.waiting, 2);
  assert.deepEqual(pharmacy.next, ['PH-008', 'PH-009']);
  assert.equal(feed.body.lines.find((l) => l.service === 'Radiology').waiting, 1);
  for (const secret of ['Secret Person', 'Another Person', '8765550111', 'private reason', 'LBT001', 'Bravo', A]) {
    assert.ok(!feed.text.includes(secret), `the feed must not contain ${secret}`);
  }

  // ── A screen for one line shows that line only.
  const one = await create(`${A}-mgr-uid`, { branch_id: `${A}-branch`, name: 'Radiology Door', service_id: `${A}-svc2` });
  const oneFeed = await call(null, 'GET', `/api/display/${one.body.path.split('/').pop()}`);
  assert.deepEqual(oneFeed.body.lines.map((l) => l.service), ['Radiology']);
  assert.deepEqual(oneFeed.body.serving, []);

  // ── The page: served for a well-formed link, embeddable, no inline script.
  const page = await call(null, 'GET', `/display/${token}`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors \*/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), null);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(page.text), 'no inline script');
  assert.equal((await call(null, 'GET', '/display/not-a-token')).status, 404);
  assert.equal((await call(null, 'GET', '/display/display.js')).status, 200);

  // ── Unknown link: 404, and the same for a made-up one of the right shape.
  assert.equal((await call(null, 'GET', `/api/display/${'x'.repeat(43)}`)).status, 404);

  // ── Listing: the branch's own screens only.
  const list = await call(`${A}-mgr-uid`, 'GET', `/api/displays?branch_id=${A}-branch`);
  assert.equal(list.body.displays.length, 2);
  assert.equal((await call(`${B}-mgr-uid`, 'GET', `/api/displays?branch_id=${A}-branch`)).status, 403);

  // ── Switched off: next door cannot, the manager can, and the link dies at once.
  assert.equal((await call(`${B}-mgr-uid`, 'DELETE', `/api/displays/${made.body.id}`)).status, 403);
  assert.equal((await call(`${A}-mgr-uid`, 'DELETE', `/api/displays/${made.body.id}`)).status, 200);
  assert.equal((await call(null, 'GET', `/api/display/${token}`)).status, 404);
  forget();

  const [audit] = await pool.query("SELECT action FROM audit_logs WHERE business_id = ? AND action LIKE 'lobby_display_%' ORDER BY created_at, action", [A]);
  assert.deepEqual(audit.map((a) => a.action).sort(), ['lobby_display_created', 'lobby_display_created', 'lobby_display_revoked']);
});
