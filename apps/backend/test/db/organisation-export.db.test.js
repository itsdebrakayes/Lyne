/**
 * An executive's full export, against a REAL MySQL server: every query runs,
 * the archive opens, it holds this organisation's records and NOTHING of the
 * organisation next door, no credential leaves, and the download is audited.
 *
 *   npm run test:db     (local Docker MySQL; creates and deletes rows "oxt-*")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`organisation-export test refuses to run against ${host}: local databases only.`);
}

const A = 'oxt-biz-a';
const B = 'oxt-biz-b';
const SECRET_CODE = 'OXQ7Z';
const SECRET_TOKEN = 'oxt-guest-token-0123456789abcdef';
const SECRET_UID = 'oxt-exec-a-uid';

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let pool;
let server;
let baseUrl;

async function cleanup() {
  for (const biz of [A, B]) {
    await pool.query('DELETE e FROM queue_events e JOIN queue_tickets t ON t.id = e.ticket_id WHERE t.queue_id = ?', [`${biz}-queue`]);
    await pool.query('DELETE FROM wait_time_records WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM queue_tickets WHERE queue_id = ?', [`${biz}-queue`]);
    await pool.query('DELETE FROM queues WHERE id = ?', [`${biz}-queue`]);
    await pool.query('DELETE FROM audit_logs WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM staff WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM services WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM branches WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM businesses WHERE id = ?', [biz]);
  }
}

async function seedOrg(biz, label, visitorName) {
  await pool.query(
    `INSERT INTO businesses (id, name, slug, subscription_tier_id)
     VALUES (?, ?, ?, (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`,
    [biz, `${label} Export Test`, `${biz}-slug`]
  );
  await pool.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?)', [`${biz}-branch`, biz, `${label} Branch`]);
  await pool.query('INSERT INTO services (id, business_id, name, ticket_prefix) VALUES (?, ?, ?, ?)', [`${biz}-svc`, biz, `${label} Service`, 'OX']);
  await pool.query('INSERT INTO queues (id, branch_id, service_id, queue_date) VALUES (?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 2 DAY))', [`${biz}-queue`, `${biz}-branch`, `${biz}-svc`]);
  const role = async (name) => (await pool.query('SELECT id FROM roles WHERE name = ?', [name]))[0][0].id;
  await pool.query(
    `INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email) VALUES
       (?, ?, NULL, ?, ?, ?, ?, ?),
       (?, ?, ?,    ?, ?, ?, ?, ?)`,
    [`${biz}-exec`, biz, await role('executive'), `${biz === A ? SECRET_UID : 'oxt-exec-b-uid'}`, `OXT-${label}-E`, `${label} Executive`, `${biz}-exec@example.test`,
      `${biz}-mgr`, biz, `${biz}-branch`, await role('manager'), `${biz}-mgr-uid`, `OXT-${label}-M`, `${label} Manager`, `${biz}-mgr@example.test`]
  );
  await pool.query(
    `INSERT INTO queue_tickets (id, queue_id, ticket_number, verification_code, guest_access_token, guest_name, position, status, channel)
     VALUES (?, ?, 'OX-001', ?, ?, ?, 1, 'served', 'kiosk'),
            (?, ?, 'OX-002', ?, NULL, ?, 2, 'served', 'kiosk')`,
    [`${biz}-t1`, `${biz}-queue`, SECRET_CODE, `${SECRET_TOKEN}${biz === A ? 'a' : 'b'}`, visitorName,
      `${biz}-t2`, `${biz}-queue`, `${SECRET_CODE}2`, '=HYPERLINK("http://evil.example","click")']
  );
  await pool.query(
    `INSERT INTO queue_events (id, ticket_id, previous_status, new_status, triggered_by_staff_id, notes) VALUES (?, ?, 'waiting', 'served', ?, 'done')`,
    [`${biz}-e1`, `${biz}-t1`, `${biz}-mgr`]
  );
  await pool.query(
    `INSERT INTO wait_time_records (id, ticket_id, business_id, branch_id, service_id, visit_date, day_of_week, hour_of_day, wait_time_minutes, month_of_year, status)
     VALUES (?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 2, 10, 7, 11, 'served')`,
    [`${biz}-w1`, `${biz}-t1`, biz, `${biz}-branch`, `${biz}-svc`]
  );
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('an executive exports their whole organisation, and only theirs', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://org-export-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  stubModule('@supabase/supabase-js', {
    createClient: () => ({ auth: { getUser: async (token) => ({ data: { user: { id: token } }, error: null }) } }),
  }, module);

  pool = require('../../src/db/pool');
  const router = require('../../src/routes/orgExport');
  const app = express();
  app.use(express.json());
  app.use('/api/export', router);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyne-export-'));
  t.after(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await cleanup().catch(() => {});
    await new Promise((r) => server.close(r));
    await pool.end();
  });

  await cleanup();
  await seedOrg(A, 'Alpha', 'Alpha Visitor');
  await seedOrg(B, 'Bravo', 'Bravo Visitor');

  // ── Who may: executives only; a business_id in the query changes nothing.
  assert.equal((await fetch(`${baseUrl}/api/export/organisation`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/export/organisation`, { headers: auth(`${A}-mgr-uid`) })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/export/organisation`, { method: 'POST', headers: auth(`${A}-mgr-uid`) })).status, 403);

  // ── The summary: every dataset's query runs on a real schema.
  const summary = await (await fetch(`${baseUrl}/api/export/organisation?business_id=${B}`, { headers: auth(SECRET_UID) })).json();
  const rowsOf = (file) => summary.files.find((f) => f.file === file).rows;
  assert.equal(rowsOf('organisation.csv'), 1);
  assert.equal(rowsOf('visits.csv'), 2);
  assert.equal(rowsOf('staff.csv'), 2);
  assert.equal(summary.last_exported_at, null);

  // ── The export itself.
  const res = await fetch(`${baseUrl}/api/export/organisation?business_id=${B}`, { method: 'POST', headers: auth(SECRET_UID) });
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(res.headers.get('content-type'), 'application/zip');
  assert.match(res.headers.get('content-disposition'), /lyne-export-oxt-biz-a-slug-\d{4}-\d{2}-\d{2}\.zip/);
  const archive = path.join(dir, 'export.zip');
  fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));

  let unzip = true;
  try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { unzip = false; }
  if (!unzip) return t.diagnostic('unzip not installed: archive contents not inspected');

  execFileSync('unzip', ['-t', archive], { stdio: 'ignore' });
  execFileSync('unzip', ['-o', '-q', archive, '-d', path.join(dir, 'out')]);
  const names = fs.readdirSync(path.join(dir, 'out')).sort();
  assert.deepEqual(names, ['README.txt', ...summary.files.map((f) => f.file)].sort());
  const all = names.map((n) => fs.readFileSync(path.join(dir, 'out', n), 'utf8')).join('\n');
  const visits = fs.readFileSync(path.join(dir, 'out', 'visits.csv'), 'utf8');

  // Theirs is there.
  assert.match(visits, /Alpha Visitor/);
  assert.match(visits, /OX-001/);
  assert.match(fs.readFileSync(path.join(dir, 'out', 'staff.csv'), 'utf8'), /Alpha Manager/);
  assert.match(fs.readFileSync(path.join(dir, 'out', 'README.txt'), 'utf8'), /Alpha Export Test/);

  // The organisation next door is not, even though its id was in the query.
  assert.doesNotMatch(all, /Bravo/);
  assert.doesNotMatch(all, /oxt-biz-b/);

  // No credential leaves.
  assert.doesNotMatch(all, new RegExp(SECRET_CODE));
  assert.doesNotMatch(all, /oxt-guest-token/);
  assert.doesNotMatch(all, new RegExp(SECRET_UID));
  assert.doesNotMatch(all, /-mgr-uid/);

  // A visitor's name cannot run as a formula on the executive's computer.
  assert.match(visits, /"'=HYPERLINK/);

  // ── Recorded, and not repeatable straight away.
  const [audit] = await pool.query("SELECT actor_id FROM audit_logs WHERE business_id = ? AND action = 'organisation_export'", [A]);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_id, `${A}-exec`);
  const [auditB] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE business_id = ? AND action = 'organisation_export'", [B]);
  assert.equal(Number(auditB[0].n), 0);

  const again = await fetch(`${baseUrl}/api/export/organisation`, { method: 'POST', headers: auth(SECRET_UID) });
  assert.equal(again.status, 429);

  const after = await (await fetch(`${baseUrl}/api/export/organisation`, { headers: auth(SECRET_UID) })).json();
  assert.equal(after.last_exported_by, 'Alpha Executive');
});
