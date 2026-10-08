/**
 * Calendar arithmetic against dates whose weekday is not in doubt.
 *
 * Run with `npm test`. The weekday checks pin the bug the birthday picker had:
 * April 7, 1977 was a Thursday and appeared under Friday.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiDateKey, monthWeeks, parseDateOnly, toISODate, weekdayOf, formatDob } from '../src/lib/dates';

const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

/** Column the grid draws a day in: its index within its week. */
function columnOf(year: number, month: number, day: number): number {
  for (const week of monthWeeks(year, month)) {
    const i = week.indexOf(day);
    if (i !== -1) return i;
  }
  throw new Error(`day ${day} missing from the grid`);
}

const KNOWN: Array<[string, number, number, number, number]> = [
  ['7 April 1977 was a Thursday', 1977, 3, 7, THU],
  ['1 April 1977 was a Friday', 1977, 3, 1, FRI],
  ['6 August 1962, Jamaican independence, was a Monday', 1962, 7, 6, MON],
  ['29 February 2000 was a Tuesday', 2000, 1, 29, TUE],
  ['1 January 2000 was a Saturday', 2000, 0, 1, SAT],
  ['31 December 1999 was a Friday', 1999, 11, 31, FRI],
  ['25 December 2026 is a Friday', 2026, 11, 25, FRI],
  ['1 March 2026 is a Sunday', 2026, 2, 1, SUN],
  ['30 September 2026 is a Wednesday', 2026, 8, 30, WED],
];

for (const [name, y, m, d, weekday] of KNOWN) {
  test(`${name}: weekday`, () => assert.equal(weekdayOf(y, m, d), weekday));
  test(`${name}: drawn in that column`, () => assert.equal(columnOf(y, m, d), weekday));
}

test('every week of every month in 1920-2030 has exactly seven slots', () => {
  for (let y = 1920; y <= 2030; y++) {
    for (let m = 0; m < 12; m++) {
      for (const week of monthWeeks(y, m)) assert.equal(week.length, 7, `${y}-${m + 1}`);
    }
  }
});

test('every day in 1920-2030 is drawn under its own weekday', () => {
  for (let y = 1920; y <= 2030; y++) {
    for (let m = 0; m < 12; m++) {
      const days = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= days; d++) assert.equal(columnOf(y, m, d), weekdayOf(y, m, d), `${y}-${m + 1}-${d}`);
    }
  }
});

test('a month lists each of its days once, in order', () => {
  const flat = monthWeeks(2024, 1).flat().filter((d): d is number => d !== null);
  assert.deepEqual(flat, Array.from({ length: 29 }, (_, i) => i + 1), 'February 2024 has 29 days');
});

test('a date-only string is that calendar day, whatever the timezone', () => {
  const d = parseDateOnly('1977-04-07');
  assert.equal(d.getFullYear(), 1977);
  assert.equal(d.getMonth(), 3);
  assert.equal(d.getDate(), 7);
  assert.equal(d.getDay(), THU);
});

test('a string with a time is still read as the instant it names', () => {
  assert.equal(parseDateOnly('2026-10-06T14:30:00.000Z').toISOString(), '2026-10-06T14:30:00.000Z');
});

test('toISODate round-trips a calendar date', () => {
  assert.equal(toISODate(new Date(1977, 3, 7)), '1977-04-07');
  assert.equal(toISODate(parseDateOnly('2000-02-29')), '2000-02-29');
});

test('formatDob reads day, short month, year', () => {
  assert.equal(formatDob(new Date(1977, 3, 7)), '07 Apr 1977');
});

test('an API date (server-local midnight) keys to the date the server meant', () => {
  // CURDATE() = 2026-10-06 on a Jamaica server, serialised by mysql2 as 05:00Z.
  assert.equal(apiDateKey('2026-10-06T05:00:00.000Z'), '2026-10-06');
  assert.equal(apiDateKey('2026-10-06'), '2026-10-06');
});
