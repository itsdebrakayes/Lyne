/**
 * dateWindow.ts — reporting periods measured in days, not in rows.
 *
 * The period pills used to slice the rolled-up summary by array position:
 * `summary.slice(-7)` for "7 Days". That is only the last seven days if every
 * day has data. The demo has sixteen dated rows spread across twenty-four
 * calendar days with a nine-day hole in the middle, so "7 Days" actually
 * spanned 15–31 August, "30 Days" returned all sixteen rows, and "90 Days"
 * returned the same sixteen — which is why the pills looked like they did
 * nothing and the chip read a range nobody had asked for.
 *
 * A window is now a pair of calendar dates. Rows are selected by falling inside
 * it, the label is generated from the window rather than from whatever data
 * turned up, and the comparison period is the equal-length window immediately
 * before it. A day with no records is simply a day with no records; it no
 * longer drags the window backwards.
 *
 * Dates are handled as YYYY-MM-DD strings throughout. Parsing them into Date
 * objects invites the timezone bug where `new Date('2026-08-31')` is UTC
 * midnight and renders as the 30th anywhere west of Greenwich — which is
 * everywhere this product operates.
 */

export type DateWindow = { from: string; to: string; days: number };

/** Days covered by each period pill. `today` is a single day, not zero. */
export function windowDaysOf(period: string): number {
  if (period === 'today') return 1;
  const n = Number(period);
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/** YYYY-MM-DD for a Date, in local time rather than UTC. */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

/** Shift a YYYY-MM-DD by whole days. Handles month and year ends. */
export function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toISODate(dt);
}

/** The window of `days` ending on (and including) `anchor`. */
export function makeWindow(anchor: string, days: number): DateWindow {
  return { from: shiftDays(anchor, -(days - 1)), to: anchor, days };
}

/**
 * The equal-length window immediately before this one — 25–31 Aug compares
 * against 18–24 Aug. Adjacent, never overlapping: sharing a day would count it
 * on both sides of the comparison.
 */
export function previousWindow(w: DateWindow): DateWindow {
  return makeWindow(shiftDays(w.from, -1), w.days);
}

/** Rows whose summary_date falls inside the window. Tolerates a datetime. */
export function rowsIn<T extends { summary_date?: unknown }>(rows: T[], w: DateWindow): T[] {
  return (rows || []).filter((r) => {
    const d = String(r.summary_date ?? '').slice(0, 10);
    return d >= w.from && d <= w.to;
  });
}

/**
 * How the window reads on the chip. A single day gets its weekday, because
 * "Monday" is how somebody refers to one day; a range does not, because
 * "Mon 25 – Mon 31" reads as a weekly repeat rather than a span.
 */
export function labelFor(w: DateWindow): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], opts);
  };
  if (w.days === 1) {
    return fmt(w.to, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  const sameYear = w.from.slice(0, 4) === w.to.slice(0, 4);
  const from = fmt(w.from, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return `${from} – ${fmt(w.to, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/**
 * Whether the window can move forward — you cannot report on tomorrow.
 * Used to disable the Next control rather than let it silently do nothing.
 */
export function canGoForward(w: DateWindow): boolean {
  return w.to < today();
}
