import { makeWindow, previousWindow, rowsIn, labelFor, shiftDays, windowDaysOf, canGoForward } from './dateWindow.ts';
let pass = 0, fail = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

is('7 days ending 31 Aug starts on the 25th', makeWindow('2026-08-31', 7), { from: '2026-08-25', to: '2026-08-31', days: 7 });
is('today is one day, not zero', windowDaysOf('today'), 1);
is('a single day window is that day', makeWindow('2026-08-31', 1), { from: '2026-08-31', to: '2026-08-31', days: 1 });
is('previous period is adjacent, never overlapping', previousWindow(makeWindow('2026-08-31', 7)), { from: '2026-08-18', to: '2026-08-24', days: 7 });
is('shifting crosses a month end', shiftDays('2026-09-01', -1), '2026-08-31');
is('shifting crosses a year end', shiftDays('2027-01-01', -1), '2026-12-31');

// The bug this file exists for: gaps in the data must not widen the window.
const rows = ['2026-08-08','2026-08-09','2026-08-20','2026-08-21','2026-08-22','2026-08-31']
  .map(d => ({ summary_date: d }));
is('a 7-day window ignores rows outside it, however sparse',
   rowsIn(rows, makeWindow('2026-08-31', 7)).map(r => r.summary_date), ['2026-08-31']);
is('a 30-day window takes only what falls inside',
   rowsIn(rows, makeWindow('2026-08-31', 30)).map(r => r.summary_date),
   ['2026-08-08','2026-08-09','2026-08-20','2026-08-21','2026-08-22','2026-08-31']);
is('the old slice(-7) would have reached back to 8 Aug — this does not',
   rowsIn(rows, makeWindow('2026-08-31', 7)).length < rows.slice(-7).length, true);

// Asserted on structure, not on one locale's word order — the label is built
// with toLocaleDateString and correctly differs between en-GB and en-US.
const span = labelFor(makeWindow('2026-08-31', 7));
is('a range label names both ends and joins them', [span.includes('25'), span.includes('31'), span.includes('–')], [true, true, true]);
is('a range label does not name a weekday', /Monday|Tuesday|Sunday/.test(span), false);
const one = labelFor(makeWindow('2026-08-31', 1));
is('a single day names its weekday', one.startsWith('Monday'), true);
is('a single day is not a range', one.includes('–'), false);
is('cannot page into the future', canGoForward(makeWindow('2999-01-01', 7)), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
