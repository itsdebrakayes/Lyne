/**
 * tenant-isolation.test.js
 *
 * route-security.test.js proves the guards are WIRED to each route. This file
 * proves they ENFORCE — that a manager at one agency genuinely cannot read
 * another agency's data, and that a branch manager cannot read a sister branch
 * of their own company. That combination (role gate + company attribute +
 * branch attribute + per-service assignment) is the platform's core promise to
 * a paying tenant, so it needs behavioural coverage, not just wiring coverage.
 *
 * The middleware reaches for the shared MySQL pool at module scope, so the pool
 * is swapped in require.cache before tenantAccess is loaded. node:test runs each
 * file in its own process, so this substitution cannot leak into another suite.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let queryImpl = async () => [[]];
const poolPath = require.resolve('../src/db/pool');
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: { query: (...args) => queryImpl(...args) },
};

const {
  requireStaffRole,
  requireBranchAccess,
  requireQueueAccess,
  requireTicketAccess,
  assertBusinessAccess,
  assertBranchAccess,
  scopedBusinessId,
  scopedBranchId,
} = require('../src/middleware/tenantAccess');

// Mirrors the demo topology: two agencies, and two branches inside one of them.
const TAJ = 'biz-taj-001';
const PICA = 'biz-pica-001';
const TAJ_KGN = 'br-taj-kgn';
const TAJ_MAN = 'br-taj-man';
const PICA_KGN = 'br-pica-kgn';

const staff = (over = {}) => ({
  dbStaff: { id: 'staff-1', business_id: TAJ, branch_id: TAJ_KGN, role_name: 'manager', ...over },
});
const customer = (id = 'user-1') => ({ dbUser: { id } });

function runMiddleware(middleware, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body, passed: false }); },
    };
    middleware({ query: {}, body: {}, params: {}, ...req }, res, () => resolve({ passed: true }));
  });
}

// ── Company isolation (the attribute every tenant is paying for) ────────────

test('a manager cannot reach another agency, however the id arrives', () => {
  assert.equal(assertBusinessAccess(staff(), TAJ), true);
  assert.equal(assertBusinessAccess(staff(), PICA), false);
});

test('platform_admin is the only role that crosses tenant boundaries', () => {
  const admin = staff({ role_name: 'platform_admin', business_id: TAJ });
  assert.equal(assertBusinessAccess(admin, PICA), true);
  assert.equal(assertBusinessAccess(staff({ role_name: 'executive' }), PICA), false);
});

test('a mobile customer holds no company access at all', () => {
  assert.equal(assertBusinessAccess(customer(), TAJ), false);
});

// ── Branch isolation (the second attribute, inside a single tenant) ─────────

test('an executive sees every branch of their own company', () => {
  const exec = staff({ role_name: 'executive', branch_id: null });
  assert.equal(assertBranchAccess(exec, TAJ_KGN), true);
  assert.equal(assertBranchAccess(exec, TAJ_MAN), true);
});

test('a branch manager cannot read a sister branch of the same company', () => {
  assert.equal(assertBranchAccess(staff(), TAJ_KGN), true);
  assert.equal(assertBranchAccess(staff(), TAJ_MAN), false);
});

test('a null branch_id must not silently grant company-wide branch access', () => {
  // Defense in depth: only executives are company-wide. An unscoped manager row
  // is a provisioning mistake, and it must fail closed rather than open.
  const unscoped = staff({ branch_id: null, role_name: 'manager' });
  assert.equal(assertBranchAccess(unscoped, TAJ_KGN), false);
  assert.equal(assertBranchAccess(staff({ branch_id: null, role_name: 'line_staff' }), TAJ_KGN), false);
});

// ── Role gate ───────────────────────────────────────────────────────────────

test('requireStaffRole rejects customers, rejects the wrong role, admits platform_admin', async () => {
  const gate = requireStaffRole('manager', 'executive');

  const asCustomer = await runMiddleware(gate, customer());
  assert.equal(asCustomer.status, 403);
  assert.match(asCustomer.body.error, /Staff account required/);

  const asLineStaff = await runMiddleware(gate, staff({ role_name: 'line_staff' }));
  assert.equal(asLineStaff.status, 403);

  assert.equal((await runMiddleware(gate, staff())).passed, true);
  assert.equal((await runMiddleware(gate, staff({ role_name: 'platform_admin' }))).passed, true);
});

// ── Server-side scoping: a forged id in the request must not widen access ───

test('a non-admin is pinned to their own company no matter what they request', () => {
  assert.equal(scopedBusinessId(staff(), PICA), TAJ);
  assert.equal(scopedBusinessId(staff({ role_name: 'platform_admin' }), PICA), PICA);
});

test('managers and supervisors are pinned to their own branch; executives are not', () => {
  assert.equal(scopedBranchId(staff(), TAJ_MAN), TAJ_KGN);
  assert.equal(scopedBranchId(staff({ role_name: 'supervisor' }), TAJ_MAN), TAJ_KGN);
  assert.equal(scopedBranchId(staff({ role_name: 'executive', branch_id: null }), TAJ_MAN), TAJ_MAN);
});

// ── DB-backed guards ────────────────────────────────────────────────────────

test('requireBranchAccess refuses a branch belonging to another agency', async () => {
  queryImpl = async () => [[{ business_id: PICA }]];
  const result = await runMiddleware(requireBranchAccess, {
    ...staff(),
    query: { branch_id: PICA_KGN },
  });
  assert.equal(result.status, 403);
  assert.match(result.body.error, /do not have access to this branch/);
});

test('requireBranchAccess 404s an unknown branch instead of leaking a 403', async () => {
  queryImpl = async () => [[]];
  const result = await runMiddleware(requireBranchAccess, {
    ...staff(),
    query: { branch_id: 'br-does-not-exist' },
  });
  assert.equal(result.status, 404);
});

test('a customer can open their own ticket and nobody else’s', async () => {
  queryImpl = async () => [[{
    user_id: 'user-1', business_id: TAJ, branch_id: TAJ_KGN, service_id: 'svc-1',
  }]];

  const owner = await runMiddleware(requireTicketAccess, {
    ...customer('user-1'),
    params: { id: 'ticket-1' },
  });
  assert.equal(owner.passed, true);

  const stranger = await runMiddleware(requireTicketAccess, {
    ...customer('user-2'),
    params: { id: 'ticket-1' },
  });
  assert.equal(stranger.status, 403);
});

test('line staff cannot open a queue for a service they are not assigned to', async () => {
  // Queue belongs to their own branch, but a different service — and they hold
  // no counter assignment for it today, so the assignment lookup comes back dry.
  queryImpl = async (sql) => (
    sql.includes('staff_assignments')
      ? [[]]
      : [[{ business_id: TAJ, branch_id: TAJ_KGN, service_id: 'svc-passports' }]]
  );

  const result = await runMiddleware(requireQueueAccess, {
    ...staff({ role_name: 'line_staff', assigned_service_id: 'svc-tax' }),
    params: { id: 'queue-1' },
  });
  assert.equal(result.status, 403);
});

test('line staff may open a queue their daily counter assignment covers', async () => {
  queryImpl = async (sql) => (
    sql.includes('staff_assignments')
      ? [[{ 1: 1 }]]
      : [[{ business_id: TAJ, branch_id: TAJ_KGN, service_id: 'svc-passports' }]]
  );

  const result = await runMiddleware(requireQueueAccess, {
    ...staff({ role_name: 'line_staff', assigned_service_id: 'svc-tax' }),
    params: { id: 'queue-1' },
  });
  assert.equal(result.passed, true);
});

// ── "Allow Overflow Onto Any Window" (branch_settings.allow_overflow) ───────
// The manager's Settings toggle genuinely widens queue access, so its limits
// need behavioural cover, not just the happy path.

/** Queue at `branch`, service the clerk is not assigned to, no counter roster
 *  row, and the branch's overflow setting as given. */
const overflowWorld = (branch, allowOverflow) => async (sql) => {
  if (sql.includes('staff_assignments')) return [[]];
  if (sql.includes('branch_settings')) return [[{ allow_overflow: allowOverflow ? 1 : 0 }]];
  return [[{ business_id: TAJ, branch_id: branch, service_id: 'svc-passports' }]];
};

test('overflow ON lets a clerk call from another line AT THEIR OWN BRANCH', async () => {
  queryImpl = overflowWorld(TAJ_KGN, true);
  const result = await runMiddleware(requireQueueAccess, {
    ...staff({ role_name: 'line_staff', assigned_service_id: 'svc-tax' }),
    params: { id: 'queue-1' },
  });
  assert.equal(result.passed, true);
});

test('overflow OFF still refuses a line the clerk is not assigned to', async () => {
  queryImpl = overflowWorld(TAJ_KGN, false);
  const result = await runMiddleware(requireQueueAccess, {
    ...staff({ role_name: 'line_staff', assigned_service_id: 'svc-tax' }),
    params: { id: 'queue-1' },
  });
  assert.equal(result.status, 403);
});

test('overflow never reaches across branches, however permissive the setting', async () => {
  // The sister branch has overflow ON. It must not matter: the clerk belongs to
  // TAJ_KGN, so TAJ_MAN's queue stays closed to them. Overflow relaxes WHICH
  // LINE, never WHICH BRANCH.
  queryImpl = overflowWorld(TAJ_MAN, true);
  const result = await runMiddleware(requireQueueAccess, {
    ...staff({ role_name: 'line_staff', assigned_service_id: 'svc-tax' }),
    params: { id: 'queue-1' },
  });
  assert.equal(result.status, 403);
});

test('a branch-less clerk is never granted overflow, even when it is on', async () => {
  // An unscoped line_staff row is a provisioning mistake and must fail closed.
  queryImpl = overflowWorld(TAJ_KGN, true);
  const result = await runMiddleware(requireQueueAccess, {
    ...staff({ role_name: 'line_staff', assigned_service_id: 'svc-tax', branch_id: null }),
    params: { id: 'queue-1' },
  });
  assert.equal(result.status, 403);
});
