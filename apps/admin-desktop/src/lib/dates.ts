/**
 * A "YYYY-MM-DD" string as that calendar day in local time.
 *
 * new Date('2026-10-06') is midnight UTC, which in Jamaica is still the
 * evening of the 5th, so every date-only value the model sends (the 7-day
 * demand forecast, for one) printed a day early beside the right weekday.
 * Strings with a time in them are real instants and are parsed as such.
 */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}
