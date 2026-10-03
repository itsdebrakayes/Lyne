/**
 * predictiveDesign.ts — the literal values from the Predictive Insights design.
 *
 * These are transcribed from the design file, not derived from the app's theme,
 * and that is deliberate. Screens 01–03 are a signed-off visual, and the point
 * of keeping their constants together and unmixed is that the next person can
 * diff them against the source instead of guessing which greys were intended
 * and which drifted in from elsewhere.
 *
 * Where a value also exists in theme.ts it is the SAME value — the design was
 * built on the v5 palette. The duplication is the price of being able to check.
 */

/** The heat ramp. Five steps, quiet → peak. */
export const RAMP = ['#e6edf8', '#b9cdee', '#7da3e0', '#2e6bff', '#1b4b8f'] as const;

/** What each ramp step is called, in the detail card. */
export const LEVEL_NAMES = ['Quiet', 'Light', 'Moderate', 'Busy', 'Peak'] as const;

/**
 * Wait minutes → ramp index.
 *
 * ABSOLUTE thresholds, not a rescale of whatever is on screen. A relative ramp
 * makes every branch look equally bad: the quietest hour is always palest even
 * when it is a 40-minute wait, and the busiest is always darkest even when it is
 * nine minutes. Fixed bands mean the colour says the same thing everywhere,
 * which is the only way a heatmap is comparable between branches.
 */
export function waitLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes < 14) return 0;
  if (minutes < 24) return 1;
  if (minutes < 36) return 2;
  if (minutes < 50) return 3;
  return 4;
}

/** Ink and surfaces, as the design writes them. */
export const D = {
  ink: '#0c1826',
  sub: '#5c6779',
  muted: '#7a8699',
  faint: '#a8b1bf',
  line: '#e7eaf0',
  lineSoft: '#eef1f6',
  bg: '#f1f3f7',
  surface: '#ffffff',
  /** The eyebrow blue — deeper than the accent. */
  eyebrow: '#143a6e',
  accent: '#1b4b8f',
  accentBright: '#2e6bff',
  onDarkAccent: '#7da3e0',
  good: '#2fbf71',
  /** The warm pair used for "avoid" — peak blocks and the skip recommendation. */
  warmBg: '#fbeee9',
  warmInk: '#b4553f',
  /** The cool pair used for "aim for" — quiet blocks and the good recommendation. */
  coolBg: '#e6edf8',
  coolInk: '#1b4b8f',
} as const;

/** "2 PM", "11 AM" — the design's hour format in headings and ranges. */
export function hourText(hour: number): string {
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/** "8a", "12p" — the compact axis labels on the heatmap and the bars. */
export function hourShort(hour: number): string {
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;
