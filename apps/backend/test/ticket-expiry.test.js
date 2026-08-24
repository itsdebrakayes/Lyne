/**
 * ticket-expiry.test.js — closing off the lines when a branch shuts.
 *
 * The behaviour under test is not "rows change status". It is that a ticket
 * abandoned at closing STOPS ACCRUING WAIT TIME at closing. Before this job,
 * a ticket left `waiting` overnight measured its wait against wall-clock, which
 * is how the branch board came to report 900-minute waits and a 221-minute
 * average abandonment — numbers that made every wait metric unusable.
 *
 * The pool is swapped in require.cache before the job loads, the same technique
 * tenant-isolation.test.js uses. node:test gives each file its own process, so
 * the substitution cannot leak.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let queries = [];
let candidateRows = {};       // status -> rows the SELECT should return
const conn = {
  query: async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM queue_tickets t/.test(sql) && /SELECT/.test(sql)) {
      return [candidateRows[params[0]] || []];
    }
    return [{ affectedRows: 1 }];
  },
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};

const poolPath = require.resolve('../src/db/pool');
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: { getConnection: async () => conn },
};

const { runTicketExpiry, GRACE_MINUTES } = require('../src/jobs/expireStaleTickets');

const reset = () => { queries = []; candidateRows = {}; };

test('a grace period is applied after closing, not before', () => {
  // Staff need time to clear the people already in front of them. Expiring at
  // the stroke of closing would cancel somebody who is next in line.
  assert.ok(GRACE_MINUTES >= 30, `grace is ${GRACE_MINUTES} min — too short to finish a line`);
});

test('never-called tickets are cancelled, not marked no-show', async () => {
  reset();
  candidateRows.waiting = [
    { id: 't1', status: 'waiting', closed_at: '2026-08-17 16:00:00', branch_name: 'Kingston' },
  ];
  const out = await runTicketExpiry();
  assert.equal(out.cancelled, 1);

  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  // no_show is a metric the branch is judged on. Nobody called this person's
  // number, so filing them as a no-show would blame the customer for the
  // branch closing.
  assert.equal(update.params[0], 'cancelled');
});

test('the recorded wait stops at CLOSING TIME, not at the moment the job runs', async () => {
  reset();
  const closing = '2026-08-17 16:00:00';
  candidateRows.waiting = [{ id: 't1', status: 'waiting', closed_at: closing, branch_name: 'Kingston' }];
  await runTicketExpiry();

  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  // THE bug this job exists to fix. Stamping "now" would bake the whole
  // overnight gap into the wait and leave the metric exactly as wrong.
  assert.equal(update.params[1], closing,
    'completed_at must be the branch closing time, not the current time');
});

test('an existing completed_at is never overwritten', async () => {
  reset();
  candidateRows.waiting = [{ id: 't1', status: 'waiting', closed_at: '2026-08-17 16:00:00', branch_name: 'K' }];
  await runTicketExpiry();
  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  assert.match(update.sql, /COALESCE\(completed_at/,
    'a real recorded completion must win over the closing-time fallback');
});

test('the status is re-checked in the UPDATE, so a live change is not clobbered', async () => {
  reset();
  candidateRows.waiting = [{ id: 't1', status: 'waiting', closed_at: '2026-08-17 16:00:00', branch_name: 'K' }];
  await runTicketExpiry();
  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  // Between SELECT and UPDATE a clerk may have called this person. The guard
  // means the job loses that race instead of overwriting real staff work.
  assert.match(update.sql, /WHERE id = \? AND status = \?/);
});

test('called-but-absent tickets become no_show', async () => {
  reset();
  candidateRows.called = [{ id: 't2', status: 'called', closed_at: '2026-08-17 16:00:00', branch_name: 'K' }];
  const out = await runTicketExpiry();
  assert.equal(out.noShow, 1);
  assert.equal(out.cancelled, 0);
  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  assert.equal(update.params[0], 'no_show');
});

test('tickets left in service are reported but never given an invented outcome', async () => {
  reset();
  candidateRows.in_service = [
    { id: 't3', status: 'in_service', closed_at: '2026-08-17 16:00:00', branch_name: 'Kingston' },
  ];
  const out = await runTicketExpiry();

  assert.equal(out.stuckInService, 1);
  assert.deepEqual(out.stuckBranches, ['Kingston']);
  // Someone WAS at the counter. Marking them served invents a completion;
  // cancelling them discards a real one. Surface it for a human instead.
  assert.equal(out.cancelled, 0);
  assert.equal(out.noShow, 0);
  assert.ok(!queries.some((q) => /UPDATE queue_tickets/.test(q.sql)),
    'in_service tickets must not be modified');
});

test('every automatic change writes an audit event', async () => {
  reset();
  candidateRows.waiting = [{ id: 't1', status: 'waiting', closed_at: '2026-08-17 16:00:00', branch_name: 'K' }];
  await runTicketExpiry();
  const event = queries.find((q) => /INSERT INTO queue_events/.test(q.sql));
  assert.ok(event, 'the system changing a ticket unattended must leave a trail');
  // Stamped at closing too, so the event timeline matches the recorded outcome.
  assert.equal(event.params[3], '2026-08-17 16:00:00');
  assert.match(String(event.params[4]), /closed/i);
});

test('a branch with no closing time recorded is left alone', async () => {
  reset();
  await runTicketExpiry();
  const select = queries.find((q) => /SELECT/.test(q.sql));
  // Without a closing time there is no defensible moment to expire anything,
  // and guessing would cancel tickets at a branch that is genuinely still open.
  assert.match(select.sql, /b\.closing_time IS NOT NULL/);
});
