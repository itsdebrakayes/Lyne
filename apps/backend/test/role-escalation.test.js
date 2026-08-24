/**
 * role-escalation.test.js
 *
 * POST /api/staff and PUT /api/staff/:id took `role_id` and `supabase_uid`
 * straight from the request body. A manager — a role every tenant hands out —
 * could therefore create a staff row with role_id 'role-platform-admin-001',
 * bind it to a Supabase account they controlled, sign in as it, and read and
 * write EVERY tenant on the platform, because platform_admin is the one role
 * scopedBusinessId() and assertBusinessAccess() treat as unscoped.
 *
 * tenant-isolation.test.js could not catch this. It proves a tenant cannot
 * reach another tenant BY CHANGING AN IDENTIFIER. This attack changes no
 * identifier — it changes what the caller *is*.
 *
 * Same pool-swap harness as tenant-isolation.test.js: the route reaches for the
 * shared MySQL pool at module scope, so it is replaced in require.cache before
 * the router loads. node:test gives each file its own process, so this cannot
 * leak into another suite.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let statements = [];
let queryImpl = async () => [[]];
const poolPath = require.resolve('../src/db/pool');
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: {
    query: (...args) => { statements.push(args); return queryImpl(...args); },
  },
};

const staffRouter = require('../src/routes/staff');

const ROLES = {
  'role-staff-001': 'line_staff',
  'role-supervisor-001': 'supervisor',
  'role-mgr-001': 'manager',
  'role-exec-001': 'executive',
  'role-platform-admin-001': 'platform_admin',
};

/* The real handler is the last function on the route's stack; the guards ahead
   of it are covered by route-security.test.js. */
function handlerFor(method, path) {
  const layer = staffRouter.stack.find(l => l.route?.path === path && l.route.methods?.[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} must exist`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return res;
}

/* Answers the four statements the create path issues, in order, so an allowed
   grant runs all the way through to the INSERT and we can inspect its params. */
function standardDb() {
  return async (sql, params) => {
    if (/FROM roles/i.test(sql)) {
      const name = ROLES[params[0]];
      return [name ? [{ name }] : []];
    }
    if (/COUNT\(\*\)/i.test(sql)) return [[{ cnt: 7 }]];
    if (/SELECT slug FROM businesses/i.test(sql)) return [[{ slug: 'taj' }]];
    if (/^\s*INSERT INTO staff/i.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT business_id, branch_id FROM staff/i.test(sql)) {
      return [[{ business_id: 'biz-taj-001', branch_id: 'br-taj-kgn' }]];
    }
    if (/^\s*UPDATE staff/i.test(sql)) return [{ affectedRows: 1 }];
    if (/SELECT \* FROM staff/i.test(sql)) return [[{ id: 'new-staff' }]];
    return [[]];
  };
}

const manager = {
  id: 'staff-mgr', business_id: 'biz-taj-001', branch_id: 'br-taj-kgn', role_name: 'manager',
};

function createReq(body, dbStaff = manager) {
  return { body: { ...body }, params: {}, dbStaff };
}

test.beforeEach(() => { statements = []; queryImpl = standardDb(); });

const insertOf = () => statements.find(([sql]) => /^\s*INSERT INTO staff/i.test(sql));
const updateOf = () => statements.find(([sql]) => /^\s*UPDATE staff/i.test(sql));

test('a manager cannot mint a platform_admin — the cross-tenant escalation', async () => {
  const res = fakeRes();
  await handlerFor('post', '/')(createReq({
    business_id: 'biz-taj-001',
    role_id: 'role-platform-admin-001',
    full_name: 'Mallory',
    email: 'mallory@taj.gov.jm',
  }), res);

  assert.equal(res.statusCode, 403, 'platform_admin must be refused');
  assert.equal(insertOf(), undefined, 'no staff row may be written');
});

test('a manager cannot grant a role above their own', async () => {
  const res = fakeRes();
  await handlerFor('post', '/')(createReq({
    business_id: 'biz-taj-001',
    role_id: 'role-exec-001',
    full_name: 'Mallory',
    email: 'mallory@taj.gov.jm',
  }), res);

  assert.equal(res.statusCode, 403, 'executive is above manager');
  assert.equal(insertOf(), undefined);
});

test('a manager CAN still create line staff — the guard is not a wall', async () => {
  const res = fakeRes();
  await handlerFor('post', '/')(createReq({
    business_id: 'biz-taj-001',
    role_id: 'role-staff-001',
    full_name: 'Andre',
    email: 'andre@taj.gov.jm',
  }), res);

  assert.equal(res.statusCode, 201, 'the ordinary case must keep working');
  assert.ok(insertOf(), 'the staff row is written');
});

test('supabase_uid from the request body is ignored, never bound', async () => {
  const res = fakeRes();
  await handlerFor('post', '/')(createReq({
    business_id: 'biz-taj-001',
    role_id: 'role-staff-001',
    full_name: 'Andre',
    email: 'andre@taj.gov.jm',
    supabase_uid: 'attacker-controlled-uid',
  }), res);

  assert.equal(res.statusCode, 201);
  const [, params] = insertOf();
  assert.ok(
    !params.includes('attacker-controlled-uid'),
    'a uid supplied in the body must never reach the INSERT'
  );
  assert.equal(params[4], null, 'supabase_uid is written as NULL — the invite flow owns that binding');
});

test('an unknown role_id is refused rather than written through', async () => {
  const res = fakeRes();
  await handlerFor('post', '/')(createReq({
    business_id: 'biz-taj-001',
    role_id: 'role-does-not-exist',
    full_name: 'Mallory',
    email: 'mallory@taj.gov.jm',
  }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(insertOf(), undefined);
});

test('the update path cannot escalate an existing staff row either', async () => {
  const req = createReq({ role_id: 'role-platform-admin-001' });
  req.params = { id: 'staff-victim' };
  const res = fakeRes();
  await handlerFor('put', '/:id')(req, res);

  assert.equal(res.statusCode, 403, 'escalation by update must be refused too');
  assert.equal(updateOf(), undefined, 'no row may be updated');
});

test('an update that leaves role_id absent still works', async () => {
  const req = createReq({ full_name: 'Andre Renamed' });
  req.params = { id: 'staff-1' };
  const res = fakeRes();
  await handlerFor('put', '/:id')(req, res);

  assert.equal(res.statusCode, 200, 'omitting role_id must not trip the guard');
  assert.ok(updateOf(), 'the update runs');
});
