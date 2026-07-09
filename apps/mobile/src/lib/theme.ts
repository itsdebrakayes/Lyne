import { Platform, StyleSheet } from 'react-native';

/**
 * QME Now — mobile design system (v4 · fintech style)
 *
 * Ported from the approved Claude Design "QMe Mobile App v4" handoff.
 * Light canvas, white cards with hairline borders, Plus Jakarta Sans,
 * a forest-dark hero tone and a cyan accent. Status/efficiency semantics
 * use green → amber → red.
 *
 * Accent note: v4 ships cyan (#1fc2de) as the default accent. The design's
 * own token set also offers #7a5cf0 (purple) to align with the marketing
 * site — swap `accent` below to change it everywhere.
 */

export const colors = {
  // surfaces
  bg: '#f2f3f5',
  bgSoft: '#e9eaee',
  surface: '#ffffff',
  surfaceAlt: '#f3f4f6',
  fieldBg: '#f6f7f9',

  // ink + text
  ink: '#101418',
  text: '#101418',
  muted: '#8a919b',
  faint: '#b0b6be',
  sub: '#5c636d',
  chevron: '#c2c8d0',

  // borders
  border: '#eceef1',
  borderSoft: '#f1f2f4',

  // glass materials (Apple liquid-glass): translucent fills + hairline
  // highlight borders that sit over the ambient wash / content behind.
  glass: 'rgba(255,255,255,0.55)',
  glassStrong: 'rgba(255,255,255,0.72)',
  glassBorder: 'rgba(255,255,255,0.75)',
  glassDark: 'rgba(16,29,24,0.55)',
  glassDarkBorder: 'rgba(255,255,255,0.12)',

  // brand
  dark: '#101d18', // forest hero tone (--dk)
  accent: '#1fc2de', // cyan (--acc)
  accentInk: '#08110f', // ink on accent
  accentDeep: '#0f97b3',

  // status (green → amber → red)
  light: '#2fbf71',
  moderate: '#f5a623',
  busy: '#e5484d',
  danger: '#e5484d',

  onDark: '#ffffff',
};

// Category tile palette (icon color + soft tile background).
export const categoryTints = {
  blue: { fg: '#2b6fe3', bg: '#e7f0fd' },
  green: { fg: '#1f9d5f', bg: '#e6f7ee' },
  purple: { fg: '#7a5cf0', bg: '#f1ecfd' },
  orange: { fg: '#e8862e', bg: '#fdefe2' },
  pink: { fg: '#e0518e', bg: '#fdeaf3' },
  cyan: { fg: '#0f97b3', bg: '#eef8fb' },
} as const;

// Gradient + shadow tint per favourite-company card, keyed by index.
export const companyGradients: Array<{ colors: [string, string]; shadow: string }> = [
  { colors: ['#2b6fe3', '#5f92f2'], shadow: 'rgba(43,111,227,.5)' },
  { colors: ['#7a5cf0', '#a184f6'], shadow: 'rgba(122,92,240,.5)' },
  { colors: ['#0e9e6e', '#2fc389'], shadow: 'rgba(14,158,110,.5)' },
  { colors: ['#e8862e', '#f4a85a'], shadow: 'rgba(232,134,46,.5)' },
  { colors: ['#0f97b3', '#3fbcd4'], shadow: 'rgba(15,151,179,.5)' },
  { colors: ['#d5386a', '#ec6a95'], shadow: 'rgba(213,56,106,.5)' },
];

export const font = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extra: 'Manrope_800ExtraBold',
};


// Browsers draw their own focus ring around TextInputs (an orange/blue
// rectangle) — kill it on web; native platforms ignore this.
export const inputReset = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null;

export const shadow = {
  card: {
    shadowColor: '#141923',
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  hero: {
    shadowColor: '#0a1411',
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 22 },
    elevation: 10,
  },
  floating: {
    shadowColor: '#141923',
    shadowOpacity: 0.16,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  // Raised, Apple-native depth for cards, tiles and avatars — a touch stronger
  // and tighter than `card`, so elements read as lifted off the canvas.
  depth: {
    shadowColor: '#0a1411',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

// Subtle emboss for letters sitting on colored/dark avatars — gives the
// initials a little dimensionality (Apple Contacts style).
export const depthText = {
  textShadowColor: 'rgba(6,17,15,0.22)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

export type QueueStatus = 'light' | 'moderate' | 'busy';

export function statusFromWait(waitMinutes: number): QueueStatus {
  if (waitMinutes >= 40) return 'busy';
  if (waitMinutes >= 15) return 'moderate';
  return 'light';
}

export function statusMeta(status: QueueStatus) {
  if (status === 'busy') return { label: 'High traffic', dot: colors.busy };
  if (status === 'moderate') return { label: 'Busy', dot: colors.moderate };
  return { label: 'Light', dot: colors.light };
}

// Human wait labels — a computed 0 reads as broken UI, so say "No wait".
export function waitLabel(minutes?: number | string | null) {
  const wait = Math.round(Number(minutes || 0));
  return wait ? `~${wait} min` : 'No wait';
}

export function waitShort(minutes?: number | string | null) {
  const wait = Math.round(Number(minutes || 0));
  return wait ? `${wait}m` : 'Now';
}

/**
 * Branch open/closed by the wall clock. The demo seeds queues for the whole
 * day, so "open_queues > 0" is NOT a truthful "open now" signal — a branch
 * can carry a stale low wait at midnight. Every QMe business here is a
 * Jamaican government agency (TAJ · PICA · NHT) on standard Mon–Fri
 * 8:30am–4:30pm hours, so we gate live waits on the clock and surface a
 * clear Closed / About-to-open state instead of a fake "Now / Light".
 *
 * Structured to accept per-branch hours later (opening_time/closing_time on
 * the branch) — for now it uses the shared agency schedule.
 */
export type OpenState = 'open' | 'about_to_open' | 'closed';
export interface OpenInfo { state: OpenState; label: string; detail: string; }
export interface BranchHours { openMin: number; closeMin: number; days: number[] }

const OPEN_MIN = 8 * 60 + 30;   // 8:30 AM
const CLOSE_MIN = 16 * 60 + 30; // 4:30 PM
const OPEN_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri
const SOON_WINDOW = 90;         // "about to open" if opening within 90 min
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Fallback for branches with no hours on file yet (standard agency schedule).
export const DEFAULT_HOURS: BranchHours = { openMin: OPEN_MIN, closeMin: CLOSE_MIN, days: OPEN_DAYS };

function clockLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`;
}

// Turn a branch's raw DB hour fields into a BranchHours; falls back to default
// when a branch hasn't had hours set yet (opening_time/closing_time/open_days).
export function hoursFromBranch(b?: { opening_time?: string | null; closing_time?: string | null; open_days?: string | null } | null): BranchHours {
  if (!b || !b.opening_time || !b.closing_time || !b.open_days) return DEFAULT_HOURS;
  const toMin = (t: string) => { const [h, m] = t.split(':'); return Number(h) * 60 + Number(m || 0); };
  const days = b.open_days.split(',').map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
  if (!days.length) return DEFAULT_HOURS;
  return { openMin: toMin(b.opening_time), closeMin: toMin(b.closing_time), days };
}

// Short "opens at" label for a branch's schedule (e.g. "8:30 AM").
export function openTimeLabel(hours: BranchHours = DEFAULT_HOURS) { return clockLabel(hours.openMin); }

function nextOpenLabel(day: number, hours: BranchHours) {
  for (let i = 1; i <= 7; i++) {
    const nd = (day + i) % 7;
    if (hours.days.includes(nd)) {
      const rel = i === 1 ? 'tomorrow' : DAY_NAMES[nd];
      return `Opens ${rel} ${clockLabel(hours.openMin)}`;
    }
  }
  return `Opens ${clockLabel(hours.openMin)}`;
}

export function branchOpenInfo(now: Date = new Date(), hours: BranchHours = DEFAULT_HOURS): OpenInfo {
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (hours.days.includes(day)) {
    if (mins < hours.openMin) {
      if (hours.openMin - mins <= SOON_WINDOW) return { state: 'about_to_open', label: 'About to open', detail: `Opens ${clockLabel(hours.openMin)} · be first in line` };
      return { state: 'closed', label: 'Closed', detail: `Opens ${clockLabel(hours.openMin)}` };
    }
    if (mins <= hours.closeMin) return { state: 'open', label: 'Open', detail: `Open until ${clockLabel(hours.closeMin)}` };
    return { state: 'closed', label: 'Closed', detail: nextOpenLabel(day, hours) };
  }
  return { state: 'closed', label: 'Closed', detail: nextOpenLabel(day, hours) };
}

// Default agency open time as a plain label, for callers without a branch.
export const openingTimeLabel = clockLabel(OPEN_MIN);

export function initials(value?: string) {
  return (value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'Q';
}

// Spacing scale — the whole app sits on this rhythm. Sections get xl above
// and m below their header; cards pad with l; grouped items gap with s/m.
export const space = { xs: 6, s: 10, m: 14, l: 20, xl: 32, xxl: 44 } as const;

/**
 * Type scale — one consistent ramp with a readable floor (per the typography
 * spec: Headline 24 · Subheadline 16 · Body 14 · Button 16, no big jumps,
 * nothing below ~13). Card content uses `cardTitle` / `subhead` / `bodySm`;
 * screen titles use `display` / `title`. Never hand-set a fontSize below 13
 * for readable text — use `tag`/`overline` (uppercase, tracked) if smaller.
 */
export const type = {
  display:   { fontFamily: font.extra,    fontSize: 28,   letterSpacing: -0.6, lineHeight: 33 },
  title:     { fontFamily: font.extra,    fontSize: 22,   letterSpacing: -0.5, lineHeight: 27 },
  section:   { fontFamily: font.extra,    fontSize: 18,   letterSpacing: -0.3, lineHeight: 23 },
  cardTitle: { fontFamily: font.bold,     fontSize: 16.5, letterSpacing: -0.3, lineHeight: 21 },
  subhead:   { fontFamily: font.semibold, fontSize: 14,   lineHeight: 19 },
  body:      { fontFamily: font.medium,   fontSize: 14.5, lineHeight: 21 },
  bodySm:    { fontFamily: font.medium,   fontSize: 13.5, lineHeight: 19 },
  callout:   { fontFamily: font.semibold, fontSize: 13,   lineHeight: 17 },
  button:    { fontFamily: font.bold,     fontSize: 16 },
  buttonSm:  { fontFamily: font.bold,     fontSize: 14 },
  tag:       { fontFamily: font.bold,     fontSize: 12,   letterSpacing: 0.2 },
} as const;

export const t = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 22, paddingTop: 72, paddingBottom: 148 },

  // typography (mirrors the `type` scale — readable floors, consistent ramp)
  h1: { fontFamily: font.extra, fontSize: 28, color: colors.ink, letterSpacing: -0.6, lineHeight: 33 },
  h2: { fontFamily: font.extra, fontSize: 24, color: colors.ink, letterSpacing: -0.5, lineHeight: 29 },
  section: { fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.3 },
  body: { fontFamily: font.medium, fontSize: 14.5, color: colors.ink, lineHeight: 21 },
  small: { fontFamily: font.semibold, fontSize: 13, color: colors.muted, lineHeight: 18 },
  micro: { fontFamily: font.bold, fontSize: 12, color: colors.muted, letterSpacing: 0.3 },
  overline: { fontFamily: font.extra, fontSize: 11, color: colors.muted, letterSpacing: 1.4, textTransform: 'uppercase' },

  // section header row: generous air above, a clear beat before content
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 32, marginBottom: 16 },

  // surfaces
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22 },
  cardLg: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 28, ...shadow.card },

  // controls
  iconBtn: { width: 46, height: 46, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 26, height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  searchText: { fontFamily: font.medium, fontSize: 14.5, color: colors.muted },

  primaryBtn: { backgroundColor: colors.dark, borderRadius: 19, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  primaryBtnText: { fontFamily: font.bold, fontSize: 16, color: colors.onDark },
  ghostBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 19, minHeight: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },

  // rows / tiles
  listRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoTile: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoTileText: { fontFamily: font.extra, fontSize: 13, color: colors.ink },
});
