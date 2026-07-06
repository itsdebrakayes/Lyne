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
  regular: 'Jakarta_400Regular',
  medium: 'Jakarta_500Medium',
  semibold: 'Jakarta_600SemiBold',
  bold: 'Jakarta_700Bold',
  extra: 'Jakarta_800ExtraBold',
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

export const t = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 22, paddingTop: 72, paddingBottom: 148 },

  // typography
  h1: { fontFamily: font.extra, fontSize: 29, color: colors.ink, letterSpacing: -0.8, lineHeight: 34 },
  h2: { fontFamily: font.extra, fontSize: 26, color: colors.ink, letterSpacing: -0.6, lineHeight: 31 },
  section: { fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.3 },
  body: { fontFamily: font.medium, fontSize: 14.5, color: colors.ink, lineHeight: 21 },
  small: { fontFamily: font.semibold, fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  micro: { fontFamily: font.bold, fontSize: 10.5, color: colors.muted, letterSpacing: 0.5 },
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
  primaryBtnText: { fontFamily: font.extra, fontSize: 15.5, color: colors.onDark },
  ghostBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 19, minHeight: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },

  // rows / tiles
  listRow: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoTile: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoTileText: { fontFamily: font.extra, fontSize: 13, color: colors.ink },
});
