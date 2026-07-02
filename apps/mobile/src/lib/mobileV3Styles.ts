import { StyleSheet } from 'react-native';

/**
 * QME Now — mobile design system
 *
 * Unified with the marketing site: QME violet (#7b5fff) is the brand thread
 * across primary actions, the active tab, the live-ticket hero and accents.
 * Base is a soft near-white canvas with crisp white cards and gentle elevation
 * for a polished, consumer-app feel.
 */

export const colors = {
  bg: '#f4f3f8',
  surface: '#ffffff',
  featured: '#15131f',
  text: '#16141f',
  muted: '#7b7890',
  faint: '#a7a3b8',
  pill: '#f0eefaff',
  border: '#e7e5f0',
  danger: '#e5484d',
  warning: '#f5a623',
  success: '#22c55e',

  // QME brand (matches website: qme-purple / qme-violet)
  brand: '#7b5fff',
  brandDark: '#6b4eff',
  brandDeep: '#533483',
  brandSoft: '#efeaff',
  brandText: '#5a3ff0',
  onBrand: '#ffffff',
};

// Signature violet gradient for the ticket hero & primary moments.
export const brandGradient = ['#7b5fff', '#6b4eff', '#533483'] as const;
export const darkGradient = ['#211a38', '#15131f'] as const;

export const shadow = {
  card: {
    shadowColor: '#3a2f66',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  brand: {
    shadowColor: '#6b4eff',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  floating: {
    shadowColor: '#2a2350',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

export const v3 = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 120 },
  h1: { fontSize: 33, fontWeight: '800', color: colors.text, letterSpacing: -1, lineHeight: 37 },
  h2: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  small: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  label: { fontSize: 11, color: colors.muted, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, ...shadow.card },
  darkCard: { backgroundColor: colors.featured, borderRadius: 28 },
  brandCard: { backgroundColor: colors.brand, borderRadius: 28, ...shadow.brand },
  iconBox: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.brandText, fontSize: 14, fontWeight: '800' },
  search: { height: 54, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11, ...shadow.card },
  searchText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: colors.onBrand },
  primaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, ...shadow.brand },
  primaryButtonText: { color: colors.onBrand, fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillBadgeText: { color: colors.brandText, fontSize: 12, fontWeight: '800' },
  bottomTabs: { position: 'absolute', left: 14, right: 14, bottom: 20, height: 64, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, ...shadow.floating },
  tabOn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand, borderRadius: 15, paddingHorizontal: 16, height: 46, ...shadow.brand },
  tabOff: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabOnText: { color: colors.onBrand, fontSize: 13, fontWeight: '800' },
});
