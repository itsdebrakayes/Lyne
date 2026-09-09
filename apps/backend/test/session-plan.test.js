const test = require('node:test');
const assert = require('node:assert');
const { planSession, erlangCWaitMinutes, sittingHours } = require('../src/utils/sessionPlan');

/* The worked example the whole feature exists to answer:
   400 people registered, a 09:00–16:00 sitting, 8 minutes per person measured
   from history. */
const COURT = { expected: 400, hours: 7, serviceMinutes: 8 };

test('one window gets through the hours divided by the service time', () => {
  const p = planSession(COURT);
  assert.strictEqual(p.per_window, 52);          // 7h = 420 min / 8 = 52.5, floored
});

test('windows needed to clear the room is people over throughput', () => {
  const p = planSession(COURT);
  assert.strictEqual(p.windows_to_clear, 8);     // ceil(400 / 52)
});

test('five windows and seven hours does NOT clear 400 — and says by how much', () => {
  const p = planSession({ ...COURT, windows: 5 });
  assert.strictEqual(p.proposal.capacity, 260);
  assert.strictEqual(p.proposal.clears, false);
  assert.strictEqual(p.proposal.shortfall, 140);
});

test('it says when you would actually finish, not just that you overran', () => {
  const p = planSession({ ...COURT, windows: 5 });
  // 400 × 8 min / 5 windows = 640 min = 10.7 h against a 7 h sitting
  assert.strictEqual(p.proposal.hours_to_clear, 10.7);
  assert.strictEqual(p.proposal.overruns_by_minutes, 220);
});

test('eight windows clears it inside the sitting', () => {
  const p = planSession({ ...COURT, windows: 8 });
  assert.strictEqual(p.proposal.clears, true);
  assert.strictEqual(p.proposal.overruns_by_minutes, 0);
});

/* The distinction the feature turns on: clearing the room and clearing it
   without a queue are different promises. The second never costs LESS, and for
   a tight promise it costs more.
   A first draft of this asserted "always strictly more" and failed, correctly:
   at 8 windows the expected wait is 17.9 min, so a 30-minute promise is already
   met by the number that merely clears the room. The real rule is >=. */
test('a wait promise never needs fewer windows than clearing the room', () => {
  const p = planSession({ ...COURT, targetWaitMinutes: 30 });
  assert.ok(p.windows_for_target >= p.windows_to_clear,
    `expected at least ${p.windows_to_clear}, got ${p.windows_for_target}`);
});

test('a promise tighter than the clearing number allows costs extra windows', () => {
  const p = planSession({ ...COURT, targetWaitMinutes: 5 });
  // 8 windows clears the room but leaves a 17.9 min wait — too slow for a
  // 5-minute promise, so this must ask for more.
  assert.ok(p.windows_for_target > p.windows_to_clear,
    `a 5-min promise should need more than ${p.windows_to_clear}, got ${p.windows_for_target}`);
});

test('a tighter promise costs more windows than a looser one', () => {
  const tight = planSession({ ...COURT, targetWaitMinutes: 10 }).windows_for_target;
  const loose = planSession({ ...COURT, targetWaitMinutes: 45 }).windows_for_target;
  assert.ok(tight >= loose, `10-min target (${tight}) should need at least as many as 45-min (${loose})`);
});

test('running at or over capacity reports an unbounded wait, not a number', () => {
  // 400 people over 7h = 57.1/hr; one window serves 7.5/hr. Nowhere near stable.
  assert.strictEqual(erlangCWaitMinutes(57.1, 7.5, 1), Infinity);
  // And exactly 100% utilisation is unbounded too, which is the correct answer
  // rather than a comfortable-looking finite number.
  assert.strictEqual(erlangCWaitMinutes(3000, 10, 300), Infinity);
});

test('utilisation explains the wait', () => {
  const tight = planSession({ ...COURT, windows: 8 }).proposal;
  const roomy = planSession({ ...COURT, windows: 14 }).proposal;
  assert.ok(tight.utilisation_pct > roomy.utilisation_pct);
  assert.ok(roomy.expected_wait_minutes < tight.expected_wait_minutes);
});

/* Erlang-C sums a**k/k!. At 400 people k passes 170, where factorial overflows
   to Infinity in floating point and the whole expression becomes NaN. The
   running-product form is why this returns a number. */
test('a large sitting does not overflow into NaN', () => {
  /* 24,000 over 8h at 6 min is 300 Erlangs of offered load. 300 windows is
     exactly 100% utilisation, which is correctly unbounded — an earlier draft
     of this test used it and read the honest Infinity as a bug. 320 is stable,
     and still walks k past 170, where a**k / k! overflows to Infinity and the
     whole expression would collapse to NaN without the running-product form. */
  /* maxWindows must be raised too: it defaults to 40, which is right for a
     branch and nowhere near an arena needing ~300. Left at the default the
     search correctly finds nothing and reports the target unreachable — which
     is the honest answer to "can 40 windows do this", and was the second thing
     an earlier draft of this test misread as a bug. */
  const p = planSession({
    expected: 24000, hours: 8, serviceMinutes: 6,
    windows: 320, targetWaitMinutes: 30, maxWindows: 400,
  });
  assert.ok(Number.isFinite(p.proposal.expected_wait_minutes),
    `expected a finite wait, got ${p.proposal.expected_wait_minutes}`);
  assert.ok(p.windows_for_target > 0, `expected a window count, got ${p.windows_for_target}`);
});

test('an impossible promise is reported as unreachable rather than guessed at', () => {
  const p = planSession({ expected: 5000, hours: 1, serviceMinutes: 30, targetWaitMinutes: 5, maxWindows: 10 });
  assert.strictEqual(p.windows_for_target, null);
  assert.strictEqual(p.target_unreachable, true);
});

test('it refuses to plan without a service time rather than inventing one', () => {
  assert.strictEqual(planSession({ expected: 400, hours: 7, serviceMinutes: 0 }).usable, false);
});

test('nobody registered yet is a real answer, not a crash', () => {
  const p = planSession({ expected: 0, hours: 7, serviceMinutes: 8, windows: 3 });
  assert.strictEqual(p.usable, true);
  assert.strictEqual(p.proposal.clears, true);
  assert.strictEqual(p.proposal.shortfall, 0);
});

test('sitting hours are read off the clock, including past midnight', () => {
  assert.strictEqual(sittingHours('09:00:00', '16:00:00'), 7);
  assert.strictEqual(sittingHours('21:00:00', '01:00:00'), 4);
});
