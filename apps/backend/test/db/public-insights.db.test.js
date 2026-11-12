/**
 * The organisation decides how much timing detail the public sees (migration 051),
 * against a REAL MySQL server: the setting, who may change it, what the public
 * routes then return, and the audit record.
 *
 *   npm run test:db     (local Docker MySQL; creates and deletes rows "pit-*")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('module');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`public-insights test refuses to run against ${host}: local databases only.`);
}

const BIZ = 'pit-biz';
const BRANCH = 'pit-branch';
const SERVICE = 'pit-svc';
const QUEUE = 'pit-queue';
const EXEC = 'pit-exec-uid';
const MANAGER = 'pit-mgr-uid';
const CUSTOMER = 'pit-user-uid';

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let pool;
let server;
let baseUrl;

async function cleanup() {
  await pool.query('DELETE FROM wait_time_records WHERE business_id = ?', [BIZ]);
  await pool.query('DELETE FROM queue_tickets WHERE queue_id = ?', [QUEUE]);
  await pool.query('DELETE FROM queues WHERE id = ?', [QUEUE]);
  await pool.query('DELETE FROM audit_logs WHERE business_id = ?', [BIZ]);
  await pool.query("DELETE FROM staff WHERE id LIKE 'pit-%'");
  await pool.query("DELETE FROM users WHERE id = 'pit-user'");
  await pool.query('DELETE FROM services WHERE id = ?', [SERVICE]);
  await pool.query('DELETE FROM branches WHERE id = ?', [BRANCH]);
  await pool.query('DELETE FROM businesses WHERE id = ?', [BIZ]);
}

async function seed() {
  await pool.query(
    `INSERT INTO businesses (id, name, slug, subscription_tier_id)
     VALUES (?, 'Public Insights Test Org', 'pit-public-insights-test', (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`,
    [BIZ]
  );
  await pool.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?)', [BRANCH, BIZ, 'Test Branch']);
  await pool.query('INSERT INTO services (id, business_id, name, ticket_prefix) VALUES (?, ?, ?, ?)', [SERVICE, BIZ, 'Registration', 'PI']);
  await pool.query("INSERT INTO queues (id, branch_id, service_id, queue_date) VALUES (?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 1 DAY))", [QUEUE, BRANCH, SERVICE]);
  const role = async (name) => (await pool.query('SELECT id FROM roles WHERE name = ?', [name]))[0][0].id;
  await pool.query(
    `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email) VALUES
       ('pit-exec', ?, NULL, ?, ?, 'PIT-E', 'Test Executive', 'pit-exec@example.test'),
       ('pit-mgr',  ?, ?,    ?, ?, 'PIT-M', 'Test Manager',   'pit-mgr@example.test')`,
    [BIZ, await role('executive'), EXEC, BIZ, BRANCH, await role('manager'), MANAGER]
  );

  await pool.query("INSERT INTO users (id, supabase_uid, email, full_name) VALUES ('pit-user', ?, 'pit-user@example.test', 'Test Customer')", [CUSTOMER]);

  // Enough history for a real grid: 5 weekdays x 9 hours x 9 visits, last 60 days.
  const tickets = [];
  const records = [];
  let n = 0;
  for (let day = 1; day <= 5; day++) {
    for (let hour = 8; hour <= 16; hour++) {
      for (let v = 0; v < 9; v++) {
        n++;
        const id = `pit-t-${n}`;
        const daysAgo = 7 * (v % 8) + ((7 + new Date().getDay() - day) % 7) + 1;
        tickets.push([id, QUEUE, `PI-${n}`, `PIT${String(n).padStart(5, '0')}`, n, 'served']);
        records.push([`pit-w-${n}`, id, BIZ, BRANCH, SERVICE, daysAgo, day, hour, (n % 12) + 1, 11, 'served']);
      }
    }
  }
  await pool.query('INSERT INTO queue_tickets (id, queue_id, ticket_number, verification_code, position, status) VALUES ?', [tickets]);
  await pool.query(
    `INSERT INTO wait_time_records (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, wait_time_minutes, month_of_year, status)
     VALUES ${records.map(() => '(?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?)').join(', ')}`,
    records.flat()
  );
}

async function call(token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try { payload = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: payload };
}

/* As a signed-in customer: while Lyne is free, that is who sees everything. */
const bestTimes = () => call(CUSTOMER, 'GET', `/api/predictions/best-times?business_id=${BIZ}&branch_id=${BRANCH}`);
const publicFeed = (type) => call(null, 'GET', `/api/predictions/public?business_id=${BIZ}&branch_id=${BRANCH}&type=${type}`);

test('an executive decides how much timing detail the public sees', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://public-insights-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  stubModule('@supabase/supabase-js', {
    createClient: () => ({ auth: { getUser: async (token) => ({ data: { user: { id: token } }, error: null }) } }),
  }, module);

  pool = require('../../src/db/pool');
  const app = express();
  app.use(express.json());
  app.use('/api/predictions', require('../../src/routes/predictions'));
  app.use('/api/settings', require('../../src/routes/settings'));
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

  // ── A new organisation starts on 'full': today's behaviour, nothing changes.
  const start = await call(EXEC, 'GET', '/api/settings/public-insights');
  assert.equal(start.status, 200, JSON.stringify(start.body));
  assert.equal(start.body.level, 'full');

  let bt = await bestTimes();
  assert.equal(bt.status, 200, JSON.stringify(bt.body));
  assert.equal(bt.body.detail_shared, true);
  assert.ok(bt.body.services.length, 'the seeded service should appear');
  assert.ok(Array.isArray(bt.body.services[0].grid) && bt.body.services[0].grid.length, 'full detail includes the heatmap grid');

  // ── Only an executive may change it.
  const asManager = await call(MANAGER, 'PUT', '/api/settings/public-insights', { level: 'limited' });
  assert.equal(asManager.status, 403);
  const asNobody = await call(null, 'PUT', '/api/settings/public-insights', { level: 'limited' });
  assert.equal(asNobody.status, 401);
  const bad = await call(EXEC, 'PUT', '/api/settings/public-insights', { level: 'everything' });
  assert.equal(bad.status, 400);
  const smuggled = await call(EXEC, 'PUT', '/api/settings/public-insights', { level: 'limited', business_id: 'someone-else' });
  assert.equal(smuggled.status, 400, 'no business_id may be sent: it is always the caller\'s own organisation');

  // ── Limited: the old free tier, whoever asks.
  const off = await call(EXEC, 'PUT', '/api/settings/public-insights', { level: 'limited' });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(off.body.level, 'limited');
  assert.equal(off.body.last_changed_by, 'Test Executive');

  bt = await bestTimes();
  assert.equal(bt.status, 200);
  assert.equal(bt.body.detail_shared, false);
  assert.equal(bt.body.premium, false);
  for (const svc of bt.body.services) {
    assert.deepEqual(Object.keys(svc).sort(), ['best', 'service_id', 'service_name'], 'only the headline best time per service');
  }
  assert.ok('branch_best' in bt.body && 'today' in bt.body, 'the headline and today\'s shape stay');

  const heat = await publicFeed('heatmap_data');
  assert.equal(heat.status, 200);
  assert.deepEqual(heat.body, []);
  const waits = await publicFeed('wait_time_predictions');
  assert.deepEqual(waits.body, []);
  const best = await publicFeed('best_time_to_visit');
  assert.equal(best.status, 200, 'the headline best time is still public');

  // ── Audit trail: who, and which level.
  const [audit] = await pool.query(
    "SELECT action, actor_id FROM audit_logs WHERE business_id = ? AND action LIKE 'public_insights_set_%' ORDER BY created_at",
    [BIZ]
  );
  assert.deepEqual(audit.map((a) => a.action), ['public_insights_set_limited']);
  assert.equal(audit[0].actor_id, 'pit-exec');

  // ── Back on: full detail returns at once, and that is recorded too.
  const on = await call(EXEC, 'PUT', '/api/settings/public-insights', { level: 'full' });
  assert.equal(on.status, 200);
  bt = await bestTimes();
  assert.equal(bt.body.detail_shared, true);
  assert.ok(bt.body.services[0].grid?.length, 'grid returns when switched back');
  const [audit2] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE business_id = ? AND action = 'public_insights_set_full'", [BIZ]);
  assert.equal(Number(audit2[0].n), 1);
});
