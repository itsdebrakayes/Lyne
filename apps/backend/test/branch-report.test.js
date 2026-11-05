/**
 * branch-report.test.js — the arithmetic a manager will defend in front of an
 * executive. Pure logic: visits in, figures out.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBranchReport, summarise, percentile, outcomeOf, applicableTarget } = require('../src/utils/branchReport');

const visit = (day, over = {}) => ({
  day, status: 'served', closed_reason: null, wait_min: 10, service_min: 5, elapsed_min: 15,
  join_hour: 10, start_hour: 10, service_id: 'teller', channel: 'app', ...over,
});
const base = {
  period: { from: '2026-11-02', to: '2026-11-06' }, previous: { from: '2026-10-28', to: '2026-11-01' },
  branch: { name: 'HWT', open_days: '1,2,3,4,5' }, services: [{ id: 'teller', name: 'Teller' }],
};

test('nearest-rank percentile: 90% of values are at or below it', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([5], 90), 5);
  assert.equal(percentile([], 90), null);
});

test('every visit has exactly one outcome, so outcomes add up to arrivals', () => {
  const s = summarise([
    visit('d'), visit('d', { closed_reason: 'wrong_documents' }), visit('d', { status: 'left' }),
    visit('d', { status: 'no_show' }), visit('d', { status: 'cancelled' }), visit('d', { status: 'waiting' }),
  ]);
  assert.equal(s.arrivals, 6);
  assert.equal(s.completed + s.incomplete + s.left + s.noShow + s.cancelled + s.open, 6);
});

test('a served visit marked incomplete does not count as completed', () => {
  assert.equal(outcomeOf({ status: 'served', closed_reason: 'wrong_documents' }), 'incomplete');
});

test('nothing measured is unavailable, not zero', () => {
  const s = summarise([]);
  assert.equal(s.waitAvg, null);
  assert.equal(s.completionPct, null);
});

test('a visit that left before being called has no measured wait', () => {
  const s = summarise([visit('d', { status: 'left', wait_min: 40 })]);
  assert.equal(s.waitN, 0);
});

test('the period average comes from visits, not from daily averages', () => {
  const rows = [...Array(9).fill(visit('2026-11-02', { wait_min: 10 })), visit('2026-11-03', { wait_min: 100 })];
  const r = buildBranchReport({ ...base, rows });
  assert.equal(r.summary.waitAvg, 19); // the mean of daily averages would say 55
});

test('a closed day, a zero-activity day and an operating day are told apart', () => {
  const r = buildBranchReport({ ...base, period: { from: '2026-11-01', to: '2026-11-03' }, rows: [visit('2026-11-02')] });
  assert.deepEqual(r.days.map((d) => d.kind), ['closed', 'operating', 'zero']);
});

test('a target is judged at the value in force on the day of the visit', () => {
  const t = applicableTarget('wait_minutes', {
    companyTarget: { target_wait_minutes: 15 },
    targetChanges: [{ metric: 'target_wait_minutes', branch_id: null, old_value: 20, new_value: 15, day: '2026-11-04' }],
  });
  assert.equal(t.at('2026-11-02'), 20);
  assert.equal(t.at('2026-11-05'), 15);
});

test('a branch override applies from its recorded start, the company target before it', () => {
  const t = applicableTarget('wait_minutes', {
    companyTarget: { target_wait_minutes: 15 }, branchTarget: { target_wait_minutes: 12 },
    targetChanges: [{ metric: 'target_wait_minutes', branch_id: 'b', old_value: 15, new_value: 12, day: '2026-11-04' }],
  });
  assert.equal(t.at('2026-11-02'), 15);
  assert.equal(t.at('2026-11-05'), 12);
});

test('breaches use the target of the day, and add up with those within it', () => {
  const r = buildBranchReport({
    ...base, companyTarget: { target_wait_minutes: 15 },
    targetChanges: [{ metric: 'target_wait_minutes', branch_id: null, old_value: 5, new_value: 15, day: '2026-11-03' }],
    rows: [visit('2026-11-02', { wait_min: 10 }), visit('2026-11-03', { wait_min: 10 })],
  });
  assert.equal(r.summary.withinTarget, 1);
  assert.equal(r.summary.breaches, 1);
});

test('weekday figures are per operating day observed', () => {
  const rows = [visit('2026-11-02'), visit('2026-11-02'), visit('2026-11-09'), visit('2026-11-09')];
  const r = buildBranchReport({ ...base, period: { from: '2026-11-02', to: '2026-11-13' }, rows });
  assert.equal(r.weekdays.find((w) => w.dow === 1).perDay, 2);
});

test('no forecast from too little history', () => {
  const r = buildBranchReport({ ...base, rows: [visit('2026-11-02')] });
  assert.equal(r.forecast.sufficient, false);
  assert.equal(r.forecast.days.length, 0);
});

test('a payday pattern reports how many cycles it rests on', () => {
  const rows = [visit('2026-10-26'), visit('2026-10-27')];
  const r = buildBranchReport({ ...base, period: { from: '2026-10-20', to: '2026-10-30' }, rows });
  assert.equal(r.payday.cycles, 1);
});

test('repeat visits after unfinished work need the same service within the window', () => {
  const r = buildBranchReport({
    ...base, period: { from: '2026-11-02', to: '2026-11-20' },
    rows: [visit('2026-11-02', { user_id: 'a', closed_reason: 'wrong_documents' }), visit('2026-11-05', { user_id: 'a' })],
  });
  assert.equal(r.repeats.afterIncomplete, 1);
});

test('the case backlog reconciles from opening to closing', () => {
  const r = buildBranchReport({
    ...base, rows: [],
    flags: [
      { flag: 'x', created_day: '2026-10-01', cleared_day: null },
      { flag: 'x', created_day: '2026-10-02', cleared_day: '2026-11-03' },
      { flag: 'x', created_day: '2026-11-03', cleared_day: null },
    ],
  });
  const c = r.cases;
  assert.equal(c.opening + c.opened - c.cleared, c.closing);
});

test('a recorded closure names the day and goes in the register as confirmed', () => {
  const r = buildBranchReport({
    ...base, rows: [],
    closures: [{ kind: 'outage', reason: 'Power outage', starts_on: '2026-11-03', ends_on: '2026-11-03', branch_id: 'b' }],
  });
  assert.equal(r.days.find((d) => d.day === '2026-11-03').kind, 'closure');
  assert.equal(r.exceptions[0].confirmed, true);
});

test('a counter handed from one person to another stays open once', () => {
  const r = buildBranchReport({
    ...base, rows: [visit('2026-11-02')], counters: [{ id: 'c', label: 'Teller 1', service_id: 'teller' }],
    sittings: [
      { counter_id: 'c', staff_id: 'a', day: '2026-11-02', from_min: 480, to_min: 720 },
      { counter_id: 'c', staff_id: 'b', day: '2026-11-02', from_min: 690, to_min: 780 },
    ],
  });
  assert.equal(r.counters[0].openHours, 5);
});

test('a moved appointment counts as a move, not a cancellation', () => {
  const r = buildBranchReport({
    ...base, rows: [],
    appointments: [{ status: 'rescheduled', moved: 1 }, { status: 'cancelled', moved: 0 }, { status: 'checked_in', moved: 0, checked_in_at: 'x', late_min: 0 }],
  });
  assert.equal(r.appointments.rescheduled, 1);
  assert.equal(r.appointments.cancelled, 1);
  assert.equal(r.appointments.attendancePct, 100);
});

test('two people swapping counters at 11 keeps both open all day', () => {
  const day = '2026-11-02';
  const r = buildBranchReport({
    ...base, rows: [visit(day)],
    counters: [{ id: 'A', label: 'A', service_id: 'teller' }, { id: 'B', label: 'B', service_id: 'teller' }],
    sittings: [
      { counter_id: 'A', staff_id: '1', day, from_min: 480, to_min: 660 }, { counter_id: 'B', staff_id: '2', day, from_min: 480, to_min: 661 },
      // Each is moved in turn, a minute apart.
      { counter_id: 'B', staff_id: '1', day, from_min: 660, to_min: 960 }, { counter_id: 'A', staff_id: '2', day, from_min: 661, to_min: 960 },
    ],
  });
  assert.equal(r.counters[0].openHours, 8);
  assert.equal(r.counters[1].openHours, 8);
});

test('a real gap is still a closure', () => {
  const day = '2026-11-02';
  const r = buildBranchReport({
    ...base, rows: [visit(day)], counters: [{ id: 'A', label: 'A', service_id: 'teller' }],
    sittings: [{ counter_id: 'A', staff_id: '1', day, from_min: 480, to_min: 720 }, { counter_id: 'A', staff_id: '1', day, from_min: 765, to_min: 960 }],
  });
  assert.equal(r.counters[0].openHours, 7.3); // 7h 15m, to one decimal
});
