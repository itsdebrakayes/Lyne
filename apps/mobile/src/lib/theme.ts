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

const lightColors = {
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

  // Soft semantic tints for info / success / warn / danger cards, plus the ink
  // that sits on them. Light keeps the exact hand-picked pastels; dark uses
  // translucent status colors so the cards read as native dark-theme surfaces
  // instead of bright light islands.
  infoSoft: '#eef8fb', infoInk: '#0d5c6e',
  successSoft: '#e6f7ee', successInk: '#166b41',
  warnSoft: '#fdf3e7',
  dangerSoft: '#fdeceb',

  onDark: '#ffffff',
};

export type Palette = typeof lightColors;

// Dark palette — same keys, forest-dark surfaces with light ink and a brighter
// cyan so the brand still pops. Status greens/ambers/reds lifted for contrast.
const darkColors: Palette = {
  bg: '#0b1210',
  bgSoft: '#131c18',
  surface: '#151f1a',
  surfaceAlt: '#1c2822',
  fieldBg: '#1c2822',

  ink: '#eef2f0',
  text: '#eef2f0',
  muted: '#8b978f',
  faint: '#5c665f',
  sub: '#b7c0b9',
  chevron: '#3a453f',

  border: '#243029',
  borderSoft: '#1c2822',

  glass: 'rgba(28,40,34,0.55)',
  glassStrong: 'rgba(28,40,34,0.75)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassDark: 'rgba(6,12,10,0.6)',
  glassDarkBorder: 'rgba(255,255,255,0.10)',

  dark: '#1e2e27', // raised dark surface (heroes / primary buttons)
  accent: '#22c9e4',
  accentInk: '#06100e',
  accentDeep: '#4fd3ea',

  light: '#3fd07f',
  moderate: '#f5b83e',
  busy: '#ef5a5f',
  danger: '#ef5a5f',

  infoSoft: 'rgba(34,201,228,0.13)', infoInk: '#7fdcef',
  successSoft: 'rgba(63,208,127,0.15)', successInk: '#5fd99a',
  warnSoft: 'rgba(245,184,62,0.15)',
  dangerSoft: 'rgba(239,90,95,0.16)',

  onDark: '#ffffff',
};

export type ThemeScheme = 'light' | 'dark';

/**
 * Active palette. This is a LIVE ES-module binding: `import { colors }` reads
 * the current object, and applyScheme() reassigns it. Combined with a root
 * remount (ThemeProvider) a theme switch reflows the whole token-based UI
 * without touching every screen. Inline literal colors (rare, mostly on
 * already-dark hero surfaces) don't flip — those are tokenized over time.
 */
export let colors: Palette = lightColors;

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

/**
 * Remote joining opens a few minutes AFTER the doors do. People who travelled to
 * the branch and are standing there at opening should not be leapfrogged by
 * someone tapping "join" from home the second the clock ticks over, so the first
 * few minutes of the day belong to walk-ins.
 */
export const REMOTE_JOIN_BUFFER = 5; // minutes

export type RemoteJoinState = OpenState | 'buffer';
export interface RemoteJoinInfo extends Omit<OpenInfo, 'state'> { allowed: boolean; state: RemoteJoinState; }

/** Whether this branch can be joined FROM THE APP right now, and why not if not. */
export function remoteJoinInfo(now: Date = new Date(), hours: BranchHours = DEFAULT_HOURS): RemoteJoinInfo {
  const info = branchOpenInfo(now, hours);
  if (info.state !== 'open') return { ...info, allowed: false };

  const mins = now.getHours() * 60 + now.getMinutes();
  const remoteOpensAt = hours.openMin + REMOTE_JOIN_BUFFER;
  if (mins < remoteOpensAt) {
    return {
      allowed: false,
      state: 'buffer',
      label: 'Seating walk-ins',
      detail: `Doors just opened — people already at the branch join first. You can take a spot from here at ${clockLabel(remoteOpensAt)}.`,
    };
  }
  return { ...info, allowed: true };
}

// Default agency open time as a plain label, for callers without a branch.
export const openingTimeLabel = clockLabel(OPEN_MIN);

/* Words that are never part of an organisation's acronym. Taking the first
   letter of every word regardless is how "Passport Office of Jamaica" came out
   on screen as POO — next to that agency's real name, in a product we sell to
   that agency. */
const CONNECTORS = new Set(['of', 'the', 'and', 'for', 'de', 'la', 'du', 'a', 'an']);

/** A monogram for an ORGANISATION. For a person use personInitials. */
export function initials(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return 'Q';

  // An organisation that states its own acronym gets to keep it. Ours is a
  // guess; theirs is their name.
  const stated = raw.match(/\(([A-Za-z]{2,5})\)/);
  if (stated) return stated[1].toUpperCase();

  const words = raw.split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  const solid = words.filter(w => !CONNECTORS.has(w.toLowerCase()));
  const use = solid.length ? solid : words;
  if (!use.length) return 'Q';
  return use.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}

/** A person's monogram: first and last initial, the way every contacts app does
    it. Three letters starts reading as a word rather than as initials. */
export function personInitials(value?: string) {
  const words = (value || '').trim().split(/\s+/).map(w => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  if (!words.length) return 'Q';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* ============================================================
   THE SCALES.

   A previous version of these existed and was used exactly zero
   times — every screen hand-set its own numbers instead, which is
   how the app ended up with 28 font sizes (including half-point
   steps), 29 corner radii and 15 gap values. Nothing lined up
   because nothing shared a rhythm.

   These are deliberately SMALL. If a value you want is not here,
   the answer is almost always the nearest one that is, not a new
   entry. Scarcity is the feature.
   ============================================================ */

/** 4pt grid. Everything — padding, margin, gap — comes from here. */
export const sp = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 28,
  section: 36,   // air above a section header
  screen: 20,    // screen side gutter
} as const;

/** Five radii and a pill. Anything rounder than xl is a pill, not a radius. */
export const radius = {
  s: 10,
  m: 14,
  l: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
} as const;

/**
 * Type ramp — eight roles, one numeral pair. Every size is a whole number and
 * every step is perceptible; if two roles are hard to tell apart, one of them
 * should not exist.
 *
 *   display   screen hero ("Take your spot from anywhere.")
 *   title     screen title
 *   section   section header
 *   cardTitle the strongest line inside a card
 *   body      default reading text
 *   callout   supporting text under a title
 *   caption   metadata, timestamps, counts
 *   overline  tracked uppercase eyebrow
 *
 * The numerals are for the two places a number IS the content: the ticket
 * number and the headline wait.
 */
export const type = {
  display:   { fontFamily: font.extra,    fontSize: 30, letterSpacing: -0.8, lineHeight: 35 },
  title:     { fontFamily: font.extra,    fontSize: 24, letterSpacing: -0.6, lineHeight: 29 },
  section:   { fontFamily: font.extra,    fontSize: 19, letterSpacing: -0.4, lineHeight: 24 },
  cardTitle: { fontFamily: font.bold,     fontSize: 16, letterSpacing: -0.3, lineHeight: 21 },
  body:      { fontFamily: font.medium,   fontSize: 15, lineHeight: 21 },
  callout:   { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  caption:   { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  overline:  { fontFamily: font.extra,    fontSize: 11, letterSpacing: 1.2, lineHeight: 13, textTransform: 'uppercase' as const },
  numeral:   { fontFamily: font.extra,    fontSize: 56, letterSpacing: -2.0, lineHeight: 60 },
  numeralSm: { fontFamily: font.extra,    fontSize: 28, letterSpacing: -0.8, lineHeight: 32 },
} as const;

/**
 * Press physics. Opacity alone is the cheapest possible feedback and it is what
 * all 118 touchables in this app used — it reads flat next to anything from
 * Apple or Google, where a press has weight. These are the numbers the Press
 * component springs to.
 */
export const press = {
  scale: 0.97,
  opacity: 0.92,
  /** iOS-like: quick to depress, slightly slower to release. */
  inDuration: 90,
  outDuration: 160,
} as const;

const makeT = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  // Bottom room for BOTH floating layers: the tab bar (bottom 24 + 50 tall)
  // and, when a queue is live, the ticket banner above it (bottom 102 +
  // ~48 tall). At 148 the banner sat exactly on top of whatever the last
  // control was — on Profile that was Log out.
  content: { paddingHorizontal: 22, paddingTop: 72, paddingBottom: 196 },

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

// Live-binding shared styles — rebuilt by applyScheme() when the theme flips.
export let t = makeT();

// The scheme currently applied — for the few places that need to branch on
// dark vs light beyond what the color tokens express (blur tints, overlays).
export let activeScheme: ThemeScheme = 'light';

/**
 * Swap the active palette and rebuild shared styles. Screens read the live
 * `colors` / `t` bindings, so after this runs the ThemeProvider remounts the
 * tree and the whole token-based UI reflows into the new scheme.
 */
export function applyScheme(scheme: ThemeScheme) {
  activeScheme = scheme;
  colors = scheme === 'dark' ? darkColors : lightColors;
  t = makeT();
}

/** '#rrggbb' (or '#rgb') → 'rgba(r,g,b,a)' — for gradients built from tokens. */
export function hexToRgba(hex: string, alpha: number) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
