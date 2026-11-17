/**
 * Two-factor sign-in (migration 053), against a REAL MySQL server. Supabase is
 * stubbed: a test token is an unsigned JWT whose payload names the user, the
 * assurance level ("aal") and whether they have an authenticator app ("totp").
 *
 *   npm run test:db     (local Docker MySQL; creates and deletes rows "mfa-*")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('module');

const ENABLED = process.env.LYNE_TEST_DB === '1';
const host = process.env.MYSQL_HOST || '127.0.0.1';
if (ENABLED && !/^(127\.0\.0\.1|localhost|::1)$/.test(host)) {
  throw new Error(`two-factor test refuses to run against ${host}: local databases only.`);
}

const A = 'mfa-biz-a';
const B = 'mfa-biz-b';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const tok = (sub, aal = 'aal1', totp = false) => `${b64({ alg: 'none' })}.${b64({ sub, aal, totp })}.x`;
const claims = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());

/* What the stubbed Supabase admin API holds: uid -> factors. */
const factors = new Map();
const deleted = [];

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let pool;
let server;
let baseUrl;

async function cleanup() {
  for (const biz of [A, B]) {
    await pool.query('DELETE FROM audit_logs WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM user_sessions WHERE supabase_uid LIKE ?', [`${biz}-%`]).catch(() => {});
    await pool.query('DELETE FROM staff WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM branches WHERE business_id = ?', [biz]);
    await pool.query('DELETE FROM businesses WHERE id = ?', [biz]);
  }
}

async function seedOrg(biz, label) {
  await pool.query(
    `INSERT INTO businesses (id, name, slug, subscription_tier_id)
     VALUES (?, ?, ?, (SELECT id FROM subscription_tiers ORDER BY id LIMIT 1))`,
    [biz, `${label} Bank`, `${biz}-slug`]
  );
  await pool.query('INSERT INTO branches (id, business_id, name) VALUES (?, ?, ?), (?, ?, ?)',
    [`${biz}-branch`, biz, `${label} Main`, `${biz}-branch2`, biz, `${label} East`]);
  const role = async (name) => (await pool.query('SELECT id FROM roles WHERE name = ?', [name]))[0][0].id;
  for (const [who, r, br] of [['exec', 'executive', 'branch'], ['exec2', 'executive', 'branch'], ['mgr', 'manager', 'branch'], ['sup', 'supervisor', 'branch'],
    ['clerk', 'line_staff', 'branch'], ['kiosk', 'kiosk_clerk', 'branch'], ['mgr2', 'manager', 'branch2'], ['sup2', 'supervisor', 'branch2']]) {
    await pool.query(
      'INSERT INTO staff (id, business_id, branch_id, role_id, supabase_uid, staff_code, full_name, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [`${biz}-${who}`, biz, `${biz}-${br}`, await role(r), `${biz}-${who}-uid`, `MFA-${label}-${who}`.slice(0, 20), `${label} ${who}`, `${biz}-${who}@example.test`]
    );
  }
}

async function call(token, method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text };
}

test('two-factor is enforced by the server, switched on by an enrolled executive, and resettable', { skip: !ENABLED && 'set LYNE_TEST_DB=1 (npm run test:db)' }, async (t) => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://two-factor-test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'test-key';
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
  const userFor = (uid, totp) => ({ id: uid, factors: totp ? [{ id: `${uid}-f`, factor_type: 'totp', status: 'verified' }] : [] });
  stubModule('@supabase/supabase-js', {
    createClient: () => ({
      auth: {
        getUser: async (token) => {
          try { const c = claims(token); return { data: { user: userFor(c.sub, c.totp) }, error: null }; } catch { return { data: { user: null }, error: new Error('bad') }; }
        },
        admin: {
          getUserById: async (uid) => ({ data: { user: userFor(uid, (factors.get(uid) || []).length > 0) }, error: null }),
          mfa: {
            listFactors: async ({ userId }) => ({ data: { factors: factors.get(userId) || [] }, error: null }),
            deleteFactor: async ({ id, userId }) => { deleted.push(id); factors.set(userId, (factors.get(userId) || []).filter((f) => f.id !== id)); return { data: { id }, error: null }; },
          },
        },
      },
    }),
  }, module);

  pool = require('../../src/db/pool');
  const { forgetOrg } = require('../../src/lib/mfa');
  const app = express();
  app.use(express.json());
  app.use('/api/auth/mfa', require('../../src/routes/mfa'));
  app.use('/api/auth', require('../../src/routes/auth'));
  app.use('/api/staff', require('../../src/routes/staff'));
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
  const u = (who, aal, totp, biz = A) => tok(`${biz}-${who}-uid`, aal, totp);

  // ── Off by default: a password alone works for everyone not enrolled.
  let me = await call(u('mgr'), 'GET', '/api/auth/me');
  assert.equal(me.status, 200, me.text);
  assert.equal(me.body.mfa.required, false);
  assert.equal((await call(u('mgr'), 'GET', `/api/staff?business_id=${A}`)).status, 200);

  // ── Off means off: even someone with an app is not asked.
  assert.equal((await call(u('mgr', 'aal1', true), 'GET', `/api/staff?business_id=${A}`)).status, 200);

  // ── A MANAGER's switch: their own branch only, never another branch or organisation.
  const needs = async (who, biz = A) => (await call(u(who, 'aal1', false, biz), 'GET', '/api/auth/me')).body.mfa.required;
  assert.equal((await call(u('mgr'), 'PUT', '/api/auth/mfa/branch', { require_2fa: true, branch_id: `${A}-branch2` })).status, 403, 'not another branch');
  assert.equal((await call(u('mgr'), 'PUT', '/api/auth/mfa/branch', { require_2fa: true, branch_id: `${B}-branch` })).status, 403, 'not another organisation');
  assert.equal((await call(u('sup'), 'PUT', '/api/auth/mfa/branch', { require_2fa: true })).status, 403, 'supervisors cannot');
  assert.equal((await call(u('mgr'), 'PUT', '/api/auth/mfa/branch', { require_2fa: true })).status, 200, 'own branch');
  assert.equal(await needs('mgr'), true, 'the manager of that branch');
  assert.equal(await needs('sup'), true, 'its supervisor');
  assert.equal(await needs('clerk'), false, 'not its desk staff');
  assert.equal(await needs('exec'), false, 'not the executive: the branch switch is not theirs');
  assert.equal(await needs('mgr2'), false, 'not the other branch');
  assert.equal(await needs('sup2'), false, 'not the other branch');
  for (const who of ['exec', 'mgr', 'sup', 'mgr2', 'sup2']) assert.equal(await needs(who, B), false, `not ${who} at the other organisation`);
  const [[bRow]] = await pool.query('SELECT require_2fa FROM branches WHERE id = ?', [`${B}-branch`]);
  assert.equal(Number(bRow.require_2fa), 0, 'the other organisation\'s branch row is untouched');
  // The manager sees their branch only; an executive of the SAME organisation may switch any of its branches.
  const mine = await call(u('mgr', 'aal2', true), 'GET', '/api/auth/mfa/branch');
  assert.equal(mine.status, 200, mine.text);
  assert.deepEqual(mine.body.staff.map((x) => x.id).sort(), [`${A}-mgr`, `${A}-sup`]);
  assert.equal((await call(u('mgr', 'aal2', true), 'GET', `/api/auth/mfa/branch?branch_id=${A}-branch2`)).status, 403);
  assert.equal((await call(u('exec'), 'PUT', '/api/auth/mfa/branch', { require_2fa: true, branch_id: `${B}-branch2` })).status, 403, 'an executive cannot reach another organisation');
  assert.equal((await call(u('exec'), 'PUT', '/api/auth/mfa/branch', { require_2fa: true, branch_id: `${A}-branch2` })).status, 200);
  assert.equal(await needs('mgr2'), true);
  assert.equal((await call(u('exec'), 'PUT', '/api/auth/mfa/branch', { require_2fa: false, branch_id: `${A}-branch2` })).status, 200);
  assert.equal((await call(u('mgr', 'aal2', true), 'PUT', '/api/auth/mfa/branch', { require_2fa: false })).status, 200);
  assert.equal(await needs('mgr'), false);
  assert.equal(await needs('mgr2'), false);

  // ── Only an executive switches it on, and then they are asked to set it up too.
  assert.equal((await call(u('mgr'), 'PUT', '/api/auth/mfa/organisation', { require_2fa: true })).status, 403, 'managers cannot');
  const on = await call(u('exec'), 'PUT', '/api/auth/mfa/organisation', { require_2fa: true });
  assert.equal(on.status, 200, on.text);
  const execNext = await call(u('exec'), 'GET', `/api/staff?business_id=${A}`);
  assert.equal(execNext.status, 403);
  assert.equal(execNext.body.code, 'mfa_enrollment_required');
  me = await call(u('exec'), 'GET', '/api/auth/me');
  assert.equal(me.status, 200, 'who-am-I stays open so the app can show the set-up');
  assert.equal(me.body.mfa.satisfied, false);
  assert.equal(me.body.record.email, undefined, 'nothing beyond the name until set up');
  assert.equal(me.body.record.business_name, undefined);

  // ── On: managers and executives without a code are stopped on every staff route.
  const noApp = await call(u('mgr'), 'GET', `/api/staff?business_id=${A}`);
  assert.equal(noApp.status, 403);
  assert.equal(noApp.body.code, 'mfa_enrollment_required');
  assert.equal((await call(u('mgr', 'aal1', true), 'GET', `/api/staff?business_id=${A}`)).body.code, 'mfa_required');
  assert.equal((await call(u('mgr', 'aal2', true), 'GET', `/api/staff?business_id=${A}`)).status, 200, 'password + code');
  // A forged "aal2" with no app enrolled is still just a token Supabase signed;
  // the claim comes from Supabase, so this only proves the check reads it.
  assert.equal((await call(u('mgr', 'aal2', false), 'GET', `/api/staff?business_id=${A}`)).status, 200);

  // ── Desk staff and kiosks are not required by the switch.
  const clerk = await call(u('clerk'), 'GET', '/api/auth/me');
  assert.equal(clerk.body.mfa.required, false);
  assert.ok(clerk.body.record.business_name, 'full profile for a desk clerk on a password');
  assert.equal((await call(u('kiosk'), 'GET', '/api/auth/me')).body.mfa.required, false);

  // ── The organisation switch covers every branch of A, and nothing of B.
  assert.equal(await needs('mgr2'), true, 'the other branch of the same organisation');
  assert.equal(await needs('clerk'), false, 'still not desk staff');
  assert.equal((await call(u('mgr', 'aal1', false, B), 'GET', `/api/staff?business_id=${B}`)).status, 200);
  for (const who of ['exec', 'mgr', 'sup', 'mgr2']) assert.equal(await needs(who, B), false, `not ${who} at the other organisation`);

  // ── The executive's view: who has set it up.
  factors.set(`${A}-mgr-uid`, [{ id: 'mgr-f1', factor_type: 'totp', status: 'verified' }]);
  const org = await call(u('exec', 'aal2', true), 'GET', '/api/auth/mfa/organisation');
  assert.equal(org.status, 200, org.text);
  assert.equal(org.body.require_2fa, true);
  const row = (id) => org.body.staff.find((s) => s.id === id);
  assert.equal(row(`${A}-mgr`).enrolled, true);
  assert.equal(row(`${A}-exec2`).enrolled, false);
  assert.equal(row(`${A}-mgr`).must_use, true);
  assert.equal(org.body.branches.length, 2);
  assert.equal(row(`${A}-clerk`).must_use, false);
  assert.equal(row(`${A}-kiosk`), undefined, 'kiosks are not listed');
  assert.ok(!org.text.includes(B), 'no other organisation in the list');

  // ── Reset: an executive clears a lost phone; not their own, not next door's.
  assert.equal((await call(u('exec', 'aal2', true), 'POST', '/api/auth/mfa/reset', { staff_id: `${A}-exec` })).status, 400);
  assert.equal((await call(u('exec', 'aal2', true), 'POST', '/api/auth/mfa/reset', { staff_id: `${B}-mgr` })).status, 404);
  assert.equal((await call(u('mgr', 'aal2', true), 'POST', '/api/auth/mfa/reset', { staff_id: `${A}-clerk` })).status, 403);
  const reset = await call(u('exec', 'aal2', true), 'POST', '/api/auth/mfa/reset', { staff_id: `${A}-mgr` });
  assert.equal(reset.status, 200, reset.text);
  assert.equal(reset.body.removed, 1);
  assert.deepEqual(deleted, ['mgr-f1']);

  // ── Off again, and the log has all of it.
  assert.equal((await call(u('exec', 'aal2', true), 'PUT', '/api/auth/mfa/organisation', { require_2fa: false })).status, 200);
  forgetOrg();
  assert.equal((await call(u('mgr'), 'GET', `/api/staff?business_id=${A}`)).status, 200);
  const [log] = await pool.query("SELECT action FROM audit_logs WHERE business_id = ? AND action LIKE 'two_factor_%' AND action NOT LIKE 'two_factor_branch_%'", [A]);
  assert.deepEqual(log.map((r) => r.action).sort(), ['two_factor_not_required', 'two_factor_required', 'two_factor_reset']);
  const [blog] = await pool.query("SELECT action, resource_id FROM audit_logs WHERE business_id = ? AND action LIKE 'two_factor_branch_%' ORDER BY created_at", [A]);
  assert.equal(blog.length, 4);
  const [bOther] = await pool.query("SELECT COUNT(*) AS n FROM audit_logs WHERE business_id = ? AND action LIKE 'two_factor_%'", [B]);
  assert.equal(Number(bOther[0].n), 0, 'nothing logged against the other organisation');
});
