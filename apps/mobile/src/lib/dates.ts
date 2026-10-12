/**
 * dates.ts — calendar arithmetic with no timezone in it.
 *
 * Two bugs lived here before this file existed.
 *
 * The birthday grid laid its days out as a wrapping row of cells each 1/7 of
 * the width. Seven of those, rounded to whole pixels, can come out a hair wider
 * than the row, so only six fit and every day after the first row slid one
 * column left: April 7, 1977 (a Thursday) appeared under Friday. monthWeeks()
 * returns explicit weeks of seven, and the grid renders each as its own row.
 *
 * And a date with no time, "1977-04-07", handed to new Date() is read as
 * midnight UTC, which in Jamaica (UTC-5) is still the evening of April 6.
 * parseDateOnly() reads it as a calendar date in local time instead.
 */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Weeks of a month, Sunday first. Each week has exactly seven slots; null is outside the month. */
export function monthWeeks(year: number, month: number): Array<Array<number | null>> {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const slots: Array<number | null> = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (slots.length % 7) slots.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));
  return weeks;
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(year, month, day).getDay();
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A "YYYY-MM-DD" string as that calendar day in local time. Anything with a
 * time or a zone in it is a real instant and is parsed as one.
 */
export function parseDateOnly(value: string): Date {
  const m = DATE_ONLY.exec(value.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

/** A local calendar date as "YYYY-MM-DD". */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "07 Apr 1977" */
export function formatDob(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The API's calendar dates are written in Jamaica time (MySQL CURDATE() on a
 * Jamaica-time server). Jamaica keeps UTC-5 all year with no daylight saving,
 * so a fixed offset is exact and needs nothing from Intl.
 */
const SERVER_UTC_OFFSET_MINUTES = -5 * 60;

/**
 * "YYYY-MM-DD" for a calendar date the API sent. A MySQL DATE arrives as the
 * instant of server-local midnight ("2026-10-06T05:00:00.000Z"); reading that
 * in the phone's own zone gives the previous day anywhere west of Jamaica and
 * risks the next day far east. Reading it in the server's offset gives the
 * date the server meant, wherever the phone is.
 */
export function apiDateKey(value: string | Date): string {
  if (typeof value === 'string' && DATE_ONLY.test(value.trim())) return value.trim();
  const d = typeof value === 'string' ? new Date(value) : value;
  const server = new Date(d.getTime() + SERVER_UTC_OFFSET_MINUTES * 60_000);
  return `${server.getUTCFullYear()}-${String(server.getUTCMonth() + 1).padStart(2, '0')}-${String(server.getUTCDate()).padStart(2, '0')}`;
}
