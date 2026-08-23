/**
 * The v1 queue lifecycle, driven through the real handlers.
 *
 * This is the feature the whole product rests on: a customer joins, staff call
 * them, the code at the counter proves it is them, service starts, service
 * ends. Every branch of that — and every way it can go wrong — is exercised
 * here against real route code.
 *
 * These tests assert behaviour, not wiring. Where one fails, a customer is
 * affected: a place lost, a stranger served on someone else's ticket, or a
 * line that silently stops moving.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { callAs, setStatus, reset, stop, ticketById, db } = require('./helpers/lifecycleHarness');

test.beforeEach(() => reset());
test.after(() => stop());

// ── The happy path ────────────────────────────────────────────

test('a ticket runs waiting -> called -> in_service -> served', async () => {
  const called = await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  assert.equal(called.status, 200, `call failed: ${JSON.stringify(called.body)}`);
  assert.equal(called.body.status, 'called');
  assert.ok(called.body.called_at, 'called_at must be stamped so the call timer can run');
  assert.ok(called.body.call_expires_at, 'call_expires_at must be stamped or no-show can never unlock');

  const started = await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  assert.equal(started.status, 200, `start failed: ${JSON.stringify(started.body)}`);
  assert.equal(started.body.status, 'in_service');
  assert.ok(started.body.started_serving_at, 'started_serving_at drives the service timer on the staff screen');

  const served = await setStatus('ticket-1', 'served');
  assert.equal(served.status, 200, `complete failed: ${JSON.stringify(served.body)}`);
  assert.equal(served.body.status, 'served');
  assert.ok(served.body.completed_at, 'completed_at is what history and analytics read');
});

test('every transition is written to the audit trail', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  await setStatus('ticket-1', 'served');

  const trail = db.queue_events.filter((row) => row.ticket_id === 'ticket-1');
  assert.deepEqual(
    trail.map((row) => `${row.previous_status}->${row.new_status}`),
    ['waiting->called', 'called->in_service', 'in_service->served'],
    'the queue_events trail is the only record of who moved a ticket and when'
  );
});

test('a completed visit is recorded for analytics and for the customer', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  await setStatus('ticket-1', 'served');

  assert.equal(db.wait_time_records.length, 1, 'without this row the branch reports nothing');
  assert.equal(db.wait_time_records[0].status, 'served');
  assert.ok(db.wait_time_records[0].wait_time_minutes > 0, 'a real wait must be measured, not left null');

  assert.equal(db.visit_history.length, 1, 'the customer must be able to see the visit happened');
  assert.equal(db.visit_history[0].user_id, 'user-1');
});

// ── The verification code ─────────────────────────────────────
// This is the only thing standing between a queue position and the person who
// actually holds it.

test('service cannot start without the verification code', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  const result = await setStatus('ticket-1', 'in_service');
  assert.equal(result.status, 400, 'a missing code must be refused');
  assert.equal(ticketById('ticket-1').status, 'called', 'the ticket must not move');
});

test('service cannot start with the wrong verification code', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  const result = await setStatus('ticket-1', 'in_service', { verification_code: 'WRONG123' });
  assert.equal(result.status, 403, 'a wrong code must be refused');
  assert.equal(ticketById('ticket-1').status, 'called', 'the ticket must not move');
});

test('another customer\'s code cannot be used to start service', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  // DEF67890 is ticket-2's code. If this were accepted, the wrong person is served.
  const result = await setStatus('ticket-1', 'in_service', { verification_code: 'DEF67890' });
  assert.equal(result.status, 403, "one customer's code must never unlock another's ticket");
  assert.equal(ticketById('ticket-1').status, 'called');
});

test('the verification code is accepted regardless of case or padding', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  const result = await setStatus('ticket-1', 'in_service', { verification_code: '  abc12345  ' });
  assert.equal(result.status, 200, 'a code typed in lower case at a counter must still work');
  assert.equal(ticketById('ticket-1').status, 'in_service');
});

// ── Illegal transitions ───────────────────────────────────────

test('a ticket cannot be served without being in service', async () => {
  const result = await setStatus('ticket-1', 'served');
  assert.equal(result.status, 400, 'skipping straight to served would fabricate a visit');
  assert.equal(ticketById('ticket-1').status, 'waiting');
});

test('a ticket cannot be called twice', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  const again = await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  assert.equal(again.status, 400, 're-calling would reset the call window and delay the no-show');
});

test('a served ticket cannot be reopened', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  await setStatus('ticket-1', 'served');

  for (const status of ['called', 'in_service', 'served', 'no_show']) {
    const result = await setStatus('ticket-1', status, { verification_code: 'ABC12345' });
    assert.equal(result.status, 400, `a served ticket must not move to ${status}`);
  }
  assert.equal(ticketById('ticket-1').status, 'served');
});

test('an unknown status is rejected outright', async () => {
  const result = await setStatus('ticket-1', 'teleported');
  assert.equal(result.status, 400);
  assert.equal(ticketById('ticket-1').status, 'waiting');
});

// ── No-show ───────────────────────────────────────────────────

test('a called ticket can be marked no-show and the customer is told', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  const result = await setStatus('ticket-1', 'no_show');
  assert.equal(result.status, 200, `no-show failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body.status, 'no_show');

  const notice = db.notifications.find((row) => row.notification_type === 'no_show');
  assert.ok(notice, 'a customer who loses their place must be told they lost it');
  assert.equal(notice.user_id, 'user-1');
});

test('a no-show is recorded as a real outcome, not a silent drop', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'no_show');
  assert.equal(db.wait_time_records.length, 1);
  assert.equal(db.wait_time_records[0].status, 'no_show', 'no-show rate is a headline metric — it must be measurable');
});

// ── Leaving the queue ─────────────────────────────────────────

test('a customer can leave their own queue', async () => {
  const result = await callAs('user-1', '/api/tickets/ticket-1/leave', { method: 'PUT' });
  assert.equal(result.status, 200, `leave failed: ${JSON.stringify(result.body)}`);
  assert.equal(result.body.status, 'left');
});

test('a customer cannot leave a ticket twice', async () => {
  await callAs('user-1', '/api/tickets/ticket-1/leave', { method: 'PUT' });
  const again = await callAs('user-1', '/api/tickets/ticket-1/leave', { method: 'PUT' });
  assert.equal(again.status, 400, 'a ticket already left cannot leave again');
});

test('a customer cannot leave a ticket that is already being served', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  const result = await callAs('user-1', '/api/tickets/ticket-1/leave', { method: 'PUT' });
  assert.equal(result.status, 400, 'a visit in progress must not be erasable from the phone');
});

// ── The line keeps moving ─────────────────────────────────────

test('the queue re-estimates the remaining waits after a ticket finishes', async () => {
  assert.equal(ticketById('ticket-2').estimated_wait_minutes, 12, 'precondition');

  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  await setStatus('ticket-1', 'served');

  // ticket-2 is now the only one waiting, so its estimate must fall to zero.
  // If this stops working the app quotes a wait that never counts down, which
  // is the single most visible way a queue app loses trust.
  assert.equal(
    ticketById('ticket-2').estimated_wait_minutes, 0,
    'the next customer in line must see their estimate drop when the person ahead is served'
  );
});

test('a no-show also re-estimates the line', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'no_show');
  assert.equal(ticketById('ticket-2').estimated_wait_minutes, 0, 'a released place must shorten everyone else\'s wait');
});

// ── Joining a queue ───────────────────────────────────────────

test('a customer with no ticket can join and gets a number, a place and a code', async () => {
  // user-1 and user-2 already hold the seeded tickets; leave one free first.
  await callAs('user-1', '/api/tickets/ticket-1/leave', { method: 'PUT' });

  const joined = await callAs('user-1', '/api/tickets', {
    method: 'POST',
    body: { queue_id: 'queue-a1' },
  });
  assert.equal(joined.status, 201, `join failed: ${JSON.stringify(joined.body)}`);
  assert.equal(joined.body.status, 'waiting');
  assert.match(joined.body.ticket_number, /^A-\d{3}$/, 'the number is what gets called out at the counter');
  assert.ok(joined.body.position > 0, 'a ticket with no place in line cannot be served in order');
  assert.ok(joined.body.verification_code, 'without a code, nobody can prove the ticket is theirs');
});

test('a customer cannot hold two places in line at once', async () => {
  // user-1 already holds ticket-1 in 'waiting'.
  const second = await callAs('user-1', '/api/tickets', {
    method: 'POST',
    body: { queue_id: 'queue-a1' },
  });
  assert.equal(second.status, 409, 'holding several places is how one person blocks a line');
  assert.match(second.body.error, /already in line/i, 'the refusal must say which ticket they already hold');
});

test('a finished visit frees the customer to join again', async () => {
  await setStatus('ticket-1', 'called', { call_timeout_seconds: 120 });
  await setStatus('ticket-1', 'in_service', { verification_code: 'ABC12345' });
  await setStatus('ticket-1', 'served');

  const again = await callAs('user-1', '/api/tickets', {
    method: 'POST',
    body: { queue_id: 'queue-a1' },
  });
  assert.equal(again.status, 201, 'a served customer must be able to come back the same day');
});

test('joining a queue that does not exist is refused', async () => {
  const result = await callAs('user-1', '/api/tickets', {
    method: 'POST',
    body: { queue_id: 'queue-does-not-exist' },
  });
  assert.equal(result.status, 404);
});

test('a full queue stops taking people', async () => {
  // The joiner must hold no ticket of their own, or the one-live-ticket rule
  // refuses first — with the same 409 — and capacity is never exercised.
  // Capacity is 3; two are seeded as waiting, so one filler fills the line.
  db.tickets.push({
    id: 'ticket-filler', queue_id: 'queue-a1', user_id: 'user-9', ticket_number: 'A-009',
    status: 'waiting', position: 9, verification_code: 'ZZZ99999', joined_at: new Date(),
  });

  const overflow = await callAs('user-3', '/api/tickets', { method: 'POST', body: { queue_id: 'queue-a1' } });
  assert.equal(overflow.status, 409, 'a queue past capacity must refuse rather than quote an impossible wait');
  assert.match(
    overflow.body.error, /full capacity/i,
    'it must be refused for being full — not for some other reason that also returns 409'
  );
});

test('joining is recorded in the audit trail', async () => {
  await callAs('user-1', '/api/tickets/ticket-1/leave', { method: 'PUT' });
  db.queue_events.length = 0;
  const joined = await callAs('user-1', '/api/tickets', { method: 'POST', body: { queue_id: 'queue-a1' } });

  const entry = db.queue_events.find((row) => row.ticket_id === joined.body.id);
  assert.ok(entry, 'a join with no event leaves no record of when the customer arrived');
  assert.equal(entry.new_status, 'waiting');
});

// ── Unauthenticated ───────────────────────────────────────────

test('nobody can join, move or leave a queue without signing in', async () => {
  assert.equal((await callAs(null, '/api/tickets', { method: 'POST', body: { queue_id: 'queue-a1' } })).status, 401);
  assert.equal((await callAs(null, '/api/tickets/ticket-1/leave', { method: 'PUT' })).status, 401);
  assert.equal((await callAs(null, '/api/tickets/ticket-1/status', { method: 'PUT', body: { new_status: 'called' } })).status, 401);
});
