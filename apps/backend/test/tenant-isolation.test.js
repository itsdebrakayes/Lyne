/**
 * Cross-tenant isolation, tested at the API.
 *
 * "Test tenant isolation directly at API level — not only by hiding screens."
 * Every case below is an attacker model: a legitimately authenticated caller
 * who swaps an identifier in the URL or query string for one belonging to
 * another company, another branch, or another customer.
 *
 * A test passes only when the server refuses. Anything that is not a refusal —
 * including a 200 with an empty body — is treated as a leak, because the caller
 * reached a handler they had no right to reach.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { callAs, stop } = require('./helpers/tenantHarness');

test.after(() => stop());

/** The server refused. 404 counts: it neither confirms nor returns the record. */
function assertDenied(result, what) {
  assert.ok(
    result.status === 403 || result.status === 404,
    `${what} — expected a refusal, got ${result.status} ${JSON.stringify(result.body)}`
  );
}

function assertNotDenied(result, what) {
  assert.ok(
    result.status !== 403,
    `${what} — expected access, got 403 ${JSON.stringify(result.body)}`
  );
}

// ── Company A staff reaching for Company B ────────────────────

test('a manager cannot read another company\'s queue by changing the id', async () => {
  assertDenied(await callAs('mgr-a', '/api/tickets/queue/queue-b1'), 'mgr-a -> queue-b1 tickets');
});

test('a manager cannot close another company\'s queue', async () => {
  assertDenied(await callAs('mgr-a', '/api/queues/queue-b1/close', { method: 'PUT' }), 'mgr-a -> close queue-b1');
});

test('a manager cannot read another company\'s ticket', async () => {
  assertDenied(await callAs('mgr-a', '/api/tickets/ticket-b1'), 'mgr-a -> ticket-b1');
  assertDenied(await callAs('mgr-a', '/api/tickets/ticket-b1/position'), 'mgr-a -> ticket-b1 position');
});

test('a manager cannot act on another company\'s ticket', async () => {
  for (const path of ['/api/tickets/ticket-b1/status', '/api/tickets/ticket-b1/move-up', '/api/tickets/ticket-b1/skip']) {
    assertDenied(await callAs('mgr-a', path, { method: 'PUT', body: { new_status: 'served' } }), `mgr-a -> PUT ${path}`);
  }
});

test('an executive cannot read another company\'s analytics', async () => {
  for (const path of [
    '/api/analytics/summary?business_id=biz-b',
    '/api/analytics/heatmap?business_id=biz-b',
    '/api/analytics/services?business_id=biz-b',
    '/api/analytics/executive-kpis?business_id=biz-b',
    '/api/analytics/managers?business_id=biz-b',
  ]) {
    assertDenied(await callAs('exec-a', path), `exec-a -> ${path}`);
  }
});

test('an executive cannot read another company\'s targets', async () => {
  assertDenied(await callAs('exec-a', '/api/targets?business_id=biz-b'), 'exec-a -> biz-b targets');
});

test('an executive cannot write targets onto another company', async () => {
  const result = await callAs('exec-a', '/api/targets', {
    method: 'PUT',
    body: { business_id: 'biz-b', target_wait_minutes: 5 },
  });
  assertDenied(result, 'exec-a -> write biz-b targets');
});

test('a manager cannot edit another company\'s branch', async () => {
  assertDenied(await callAs('mgr-a', '/api/branches/branch-b1', { method: 'PUT', body: { name: 'seized' } }), 'mgr-a -> edit branch-b1');
});

test('a manager cannot create a branch under another company', async () => {
  const result = await callAs('mgr-a', '/api/branches', {
    method: 'POST',
    body: { business_id: 'biz-b', name: 'implanted branch' },
  });
  assertDenied(result, 'mgr-a -> create branch in biz-b');
});

test('a manager cannot open a queue in another company\'s branch', async () => {
  const result = await callAs('mgr-a', '/api/queues', {
    method: 'POST',
    body: { branch_id: 'branch-b1', service_id: 'svc-b' },
  });
  assertDenied(result, 'mgr-a -> create queue in branch-b1');
});

test('a manager cannot list another company\'s staff', async () => {
  assertDenied(await callAs('mgr-a', '/api/staff?business_id=biz-b&branch_id=branch-b1'), 'mgr-a -> biz-b staff');
});

// ── Branch scoping inside one company ─────────────────────────
// Sharing a tenant is not the same as sharing a branch.

test('a branch manager cannot reach a sibling branch in their own company', async () => {
  assertDenied(await callAs('mgr-a', '/api/analytics/summary?business_id=biz-a&branch_id=branch-a2'), 'mgr-a -> branch-a2 analytics');
  assertDenied(await callAs('mgr-a', '/api/branches/branch-a2', { method: 'PUT', body: { name: 'x' } }), 'mgr-a -> edit branch-a2');
});

test('an executive may reach any branch within their own company', async () => {
  assertNotDenied(await callAs('exec-a', '/api/analytics/summary?business_id=biz-a&branch_id=branch-a2'), 'exec-a -> branch-a2');
});

test('line staff cannot open a queue for a service they are not assigned to', async () => {
  // Same branch, same company — the only thing separating them is the service.
  assertDenied(await callAs('staff-a', '/api/tickets/queue/queue-a2'), 'staff-a -> queue-a2 (unassigned service)');
  assertNotDenied(await callAs('staff-a', '/api/tickets/queue/queue-a1'), 'staff-a -> own queue');
});

// ── Customers ─────────────────────────────────────────────────

test('a customer cannot read another customer\'s ticket', async () => {
  assertDenied(await callAs('user-2', '/api/tickets/ticket-a1'), 'user-2 -> user-1 ticket');
  assertDenied(await callAs('user-2', '/api/tickets/ticket-a1/position'), 'user-2 -> user-1 ticket position');
});

test('a customer cannot leave a queue on another customer\'s behalf', async () => {
  assertDenied(await callAs('user-2', '/api/tickets/ticket-a1/leave', { method: 'PUT' }), 'user-2 -> leave user-1 ticket');
});

test('a customer may read their own ticket', async () => {
  assertNotDenied(await callAs('user-1', '/api/tickets/ticket-a1'), 'user-1 -> own ticket');
});

test('a customer cannot reach staff-only surfaces', async () => {
  for (const path of [
    '/api/tickets/queue/queue-a1',
    '/api/analytics/summary?business_id=biz-a',
    '/api/staff?business_id=biz-a',
    '/api/queues/mine',
  ]) {
    assertDenied(await callAs('user-1', path), `user-1 -> ${path}`);
  }
});

// ── Unauthenticated and forged ────────────────────────────────

test('an unauthenticated caller reaches nothing protected', async () => {
  for (const path of ['/api/tickets/ticket-a1', '/api/analytics/summary?business_id=biz-a', '/api/queues/mine']) {
    const result = await callAs(null, path);
    assert.equal(result.status, 401, `anonymous -> ${path} should be 401, got ${result.status}`);
  }
});

test('an unrecognised token is rejected outright', async () => {
  const result = await callAs('not-a-real-actor', '/api/tickets/ticket-a1');
  assert.equal(result.status, 401, `forged token should be 401, got ${result.status}`);
});

// ── Role escalation ───────────────────────────────────────────

test('a manager cannot reach executive-only analytics', async () => {
  for (const path of ['/api/analytics/executive-kpis?business_id=biz-a', '/api/analytics/managers?business_id=biz-a']) {
    assertDenied(await callAs('mgr-a', path), `mgr-a -> ${path}`);
  }
});

test('line staff cannot reach manager analytics', async () => {
  assertDenied(await callAs('staff-a', '/api/analytics/summary?business_id=biz-a'), 'staff-a -> summary');
  assertDenied(await callAs('staff-a', '/api/targets?business_id=biz-a'), 'staff-a -> targets');
});
