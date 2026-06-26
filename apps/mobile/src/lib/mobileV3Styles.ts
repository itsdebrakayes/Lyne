import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#ececef',
  surface: '#ffffff',
  featured: '#15151a',
  text: '#15151a',
  muted: '#8b8b93',
  pill: '#f1f1f3',
  border: '#dfe0e5',
  danger: '#e5484d',
  success: '#2fbf71',
};

export const v3 = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 120 },
  h1: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -1, lineHeight: 36 },
  h2: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  small: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  label: { fontSize: 11, color: colors.muted, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20 },
  darkCard: { backgroundColor: colors.featured, borderRadius: 26 },
  iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  search: { height: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  searchText: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '600' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.featured, borderColor: colors.featured },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chipTextActive: { color: '#ffffff' },
  primaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.featured, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 56, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  bottomTabs: { position: 'absolute', left: 14, right: 14, bottom: 20, height: 62, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10 },
  tabOn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.featured, borderRadius: 14, paddingHorizontal: 16, height: 44 },
  tabOff: { width: 46, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabOnText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
