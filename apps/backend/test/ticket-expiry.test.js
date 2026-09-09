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
  // Params are [status, closed_reason, completed_at, id, status].
  assert.equal(update.params[2], closing,
    'completed_at must be the branch closing time, not the current time');
  // Order-independent backstop, so a future column added to the SET clause
  // shifts the index without quietly turning this assertion into a no-op.
  assert.ok(update.params.includes(closing),
    'the closing time must be bound somewhere in the UPDATE');
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

test('tickets left in service are closed out AND still reported', async () => {
  reset();
  candidateRows.in_service = [
    { id: 't3', status: 'in_service', closed_at: '2026-08-17 16:00:00', branch_name: 'Kingston' },
  ];
  const out = await runTicketExpiry();

  // Reported by branch, because a clerk repeatedly leaving people open at a
  // counter is a floor problem and closing the tickets does not stop it.
  assert.equal(out.stuckInService, 1);
  assert.deepEqual(out.stuckBranches, ['Kingston']);

  // But closed, not left. These used to be reported and untouched, which meant
  // they stayed LIVE — holding positions, feeding waiting_position, and keeping
  // a queue row alive across dates. Six sat that way for five days.
  assert.equal(out.unfinished, 1, 'an unfinished service must not stay live overnight');
  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  assert.ok(update, 'in_service tickets must be closed out');
  assert.equal(update.params[4], 'in_service', 'the UPDATE must target in_service rows');
  assert.equal(update.params[1], 'service_not_finalised',
    'the history must say the clerk never finalised it, not that the customer left');
});

test('an unfinished service is never booked as SERVED', async () => {
  reset();
  candidateRows.in_service = [
    { id: 't3', status: 'in_service', closed_at: '2026-08-17 16:00:00', branch_name: 'Kingston' },
  ];
  await runTicketExpiry();

  const update = queries.find((q) => /UPDATE queue_tickets/.test(q.sql));
  // Every ETA in the product is AVG(started_serving_at -> completed_at) over
  // SERVED tickets. Booking this as served with completed_at at closing time
  // records a service that ran from 10am to 4pm; a handful of those drag the
  // branch's average service time, and therefore every wait estimate shown to
  // every customer, into nonsense. Losing credit for the visit is the cheaper
  // mistake, and closed_reason keeps it recoverable.
  assert.notEqual(update.params[0], 'served',
    'marking an abandoned in_service ticket as served corrupts every wait estimate');
  assert.equal(update.params[0], 'cancelled');
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

test('no branch can be skipped: a missing closing time falls back to the business', async () => {
  reset();
  await runTicketExpiry();
  const select = queries.find((q) => /SELECT/.test(q.sql));

  // This used to require b.closing_time IS NOT NULL, which meant a branch
  // without one was skipped forever and its tickets accrued indefinitely.
  // Every demo branch happens to have one and nothing enforced it, so the
  // first tenant onboarded without one would have had a queue that never
  // emptied and numbering that restarted on top of live people each morning.
  assert.doesNotMatch(select.sql, /closing_time IS NOT NULL/,
    'a branch must never be excluded from the sweep for lacking a closing time');

  // Migration 032 makes businesses.default_closing_time NOT NULL, so this
  // COALESCE always resolves to a real time.
  assert.match(select.sql, /COALESCE\(b\.closing_time,\s*bz\.default_closing_time\)/,
    'the sweep must fall back to the business default');
  assert.match(select.sql, /JOIN businesses/, 'the fallback needs the business joined');
});

test('every live status is swept — nothing may survive the day', async () => {
  reset();
  await runTicketExpiry();
  // The invariant the whole daily model rests on: a line belongs to the day it
  // was formed. If a status is live and no pass closes it, tickets in that
  // status accumulate forever — which is exactly how in_service leaked.
  const swept = queries
    .filter((q) => /SELECT/.test(q.sql) && /FROM queue_tickets t/.test(q.sql))
    .map((q) => q.params[0]);
  for (const status of ['waiting', 'called', 'in_service']) {
    assert.ok(swept.includes(status), `${status} tickets are never closed out`);
  }
});
