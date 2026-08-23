/**
 * Account deletion, and the gate that stands between a branch manager and a
 * working staff account.
 *
 * Deletion is an App Store requirement, not a nicety: Guideline 5.1.1(v) makes
 * in-app deletion mandatory for any app that supports account creation, and an
 * app that offers it but does not really do it is worse than one that never
 * offered. Each test below is a way that could go wrong quietly — reporting
 * success while the data survives, or destroying data while reporting failure.
 *
 * The approval gate is the only thing stopping a manager creating working
 * accounts inside a business with nobody at DKS Technologies seeing it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { callAs, reset, startWith, stop, db } = require('./helpers/accountHarness');

test.beforeEach(async () => { reset(); await startWith(); });
test.after(() => stop());

// ── Account deletion ──────────────────────────────────────────

test('a customer can delete their own account, and the record really goes', async () => {
  const result = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 200, `deletion failed: ${JSON.stringify(result.body)}`);
  assert.equal(db.users.length, 0, 'reporting success while the row survives is the worst possible outcome');
});

test('deletion signs the account out everywhere before releasing the identity', async () => {
  await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  const revocation = db.revocations.find((row) => row.supabase_uid === 'user-1');
  assert.ok(revocation, 'a live token after deletion is a session belonging to nobody');
  assert.equal(revocation.reason, 'account_deleted');
});

test('the deletion response tells the customer what went and what stayed', async () => {
  const result = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.ok(Array.isArray(result.body.deleted) && result.body.deleted.length, 'the app shows this list back to the customer');
  assert.ok(Array.isArray(result.body.retained) && result.body.retained.length,
    'retained records must be disclosed — claiming everything is gone when visit records remain is a false privacy claim');
});

test('a deleted account can no longer authenticate', async () => {
  await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  const after = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.notEqual(after.status, 200, 'a deleted user must not keep working through the same token');
});

test('deletion is refused while the customer is still standing in a line', async () => {
  db.tickets.push({ id: 'ticket-live', user_id: 'user-1', status: 'waiting' });
  const result = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 409, 'deleting mid-queue strands a ticket staff are about to call');
  assert.equal(db.users.length, 1, 'nothing may be deleted when the request is refused');
});

test('a finished visit does not block deletion', async () => {
  db.tickets.push({ id: 'ticket-old', user_id: 'user-1', status: 'served' });
  const result = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 200, 'past visits must never trap someone in an account they want gone');
});

test('staff accounts cannot be deleted from the app', async () => {
  const result = await callAs('mgr-a', '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 403, 'a manager deleting themselves would orphan their branch');
});

test('with no service key configured, deletion refuses instead of half-deleting', async () => {
  await startWith({ serviceKey: null });
  const result = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 503, 'the request must fail up front');
  assert.equal(db.users.length, 1,
    'personal data must not be destroyed when the identity cannot also be removed');
});

test('a failed identity deletion is reported, not swallowed', async () => {
  await startWith({ deleteUser: async () => ({ error: new Error('supabase is down') }) });
  const result = await callAs('user-1', '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 500, 'a partial deletion must not be reported as success');
  assert.match(result.body.error, /contact support/i, 'the customer needs to know it has to be finished by hand');
  assert.equal(db.users.length, 0, 'the personal data really was deleted — the response must reflect that honestly');
});

test('an unauthenticated caller cannot delete anyone', async () => {
  const result = await callAs(null, '/api/auth/account', { method: 'DELETE' });
  assert.equal(result.status, 401);
  assert.equal(db.users.length, 1);
});

// ── The DKS approval gate ─────────────────────────────────────

test('DKS can approve a request, and only then does a usable code exist', async () => {
  assert.equal(db.staff_invites[0].status, 'requested', 'precondition');

  const approved = await callAs('platform', '/api/staff-invite/invite-1/approve', { method: 'POST' });
  assert.equal(approved.status, 200, `approve failed: ${JSON.stringify(approved.body)}`);
  assert.equal(approved.body.invite_code, 'CODE12345678', 'the code is what the manager passes to their staff member');
  assert.equal(db.staff_invites[0].status, 'pending', 'the request must actually change state, not just return a code');
});

test('an approval records who approved it', async () => {
  await callAs('platform', '/api/staff-invite/invite-1/approve', { method: 'POST' });
  assert.ok(db.staff_invites[0].approved_by, 'an approval nobody signed is not an audit trail');
  assert.ok(db.staff_invites[0].approved_at);
});

test('a request cannot be approved twice', async () => {
  await callAs('platform', '/api/staff-invite/invite-1/approve', { method: 'POST' });
  const again = await callAs('platform', '/api/staff-invite/invite-1/approve', { method: 'POST' });
  assert.equal(again.status, 404, 'a second approval would re-issue a code for an account already live');
});

test('DKS can decline a request, and it stops being approvable', async () => {
  const declined = await callAs('platform', '/api/staff-invite/invite-1/decline', {
    method: 'POST',
    body: { reason: 'Not a real employee' },
  });
  assert.equal(declined.status, 200, `decline failed: ${JSON.stringify(declined.body)}`);
  assert.equal(db.staff_invites[0].status, 'declined');
  assert.equal(db.staff_invites[0].decline_reason, 'Not a real employee');

  const approve = await callAs('platform', '/api/staff-invite/invite-1/approve', { method: 'POST' });
  assert.equal(approve.status, 404, 'a declined request must not be approvable afterwards');
});

test('a manager cannot approve their own request', async () => {
  const result = await callAs('mgr-a', '/api/staff-invite/invite-1/approve', { method: 'POST' });
  assert.equal(result.status, 403, 'this gate is the whole point — a manager approving themselves defeats it');
  assert.equal(db.staff_invites[0].status, 'requested', 'the request must not move');
});

test('an unauthenticated caller cannot approve a request', async () => {
  const result = await callAs(null, '/api/staff-invite/invite-1/approve', { method: 'POST' });
  assert.equal(result.status, 401);
  assert.equal(db.staff_invites[0].status, 'requested');
});
