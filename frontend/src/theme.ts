// Lyne — design tokens from /app/design_guidelines.json
import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#F3F5F9", // pale blue-grey canvas
  onSurface: "#0B192C", // deep navy text
  surfaceSecondary: "#FFFFFF", // white cards
  onSurfaceSecondary: "#0B192C",
  surfaceTertiary: "#E1EFFE", // soft blue secondary
  onSurfaceTertiary: "#1D4ED8",
  surfaceInverse: "#0B192C",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B", // cool grey supporting text

  // Brand
  brand: "#0B192C", // deep navy
  onBrand: "#FFFFFF",
  brandPrimary: "#1D4ED8", // royal blue
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E1EFFE",
  onBrandSecondary: "#1D4ED8",
  brandTertiary: "#DBEAFE",
  onBrandTertiary: "#1D4ED8",

  // Status
  success: "#0F9D58",
  onSuccess: "#FFFFFF",
  warning: "#E4572E", // coral
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#1D4ED8",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// Dark "focus" palette — used by immersive flows (join, line, ticket).
// Intentionally not tied to the system colour scheme.
export const dark = {
  bg: "#0B1424",
  card: "#111C2E",
  cardRaised: "#172540",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#F8FAFC",
  textSecondary: "#CBD5E1",
  muted: "#8A9BB4",
  accent: "#1D4ED8",
  accentSoft: "rgba(29,78,216,0.22)",
  success: "#22C55E",
  danger: "#F87171",
};

// Elevation presets (iOS soft shadows / Android elevation)
export const shadow = {
  card: Platform.select({
    ios: { shadowColor: "#0B192C", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 2 },
    default: { boxShadow: "0px 6px 16px rgba(11,25,44,0.06)" },
  }) as object,
  float: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } },
    android: { elevation: 14 },
    default: { boxShadow: "0px 14px 24px rgba(0,0,0,0.28)" },
  }) as object,
};

// Type scale (SF-like: tight tracking on display sizes)
export const type = {
  display: { fontSize: 34, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.8 },
  title1: { fontSize: 28, lineHeight: 32, fontWeight: "800" as const, letterSpacing: -0.6 },
  title2: { fontSize: 22, lineHeight: 26, fontWeight: "700" as const, letterSpacing: -0.4 },
  title3: { fontSize: 18, lineHeight: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  headline: { fontSize: 16, lineHeight: 20, fontWeight: "600" as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: "400" as const },
  footnote: { fontSize: 13, lineHeight: 17, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: "700" as const, letterSpacing: 0.9, textTransform: "uppercase" as const },
};

// Spacing tokens (8pt grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
};

// Radius tokens
export const radius = {
  sm: 8,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

/** Vertical space the floating tab pill occupies — add to scroll bottom padding on tab screens. */
export const TAB_BAR_CLEARANCE = 110;

// Font family constants — use platform system fonts (friendly rounded on iOS,
// Roboto on Android). Custom fonts loading is deferred; weights are enforced
// via fontWeight in components.
export const fonts = {
  regular: Platform.select({ ios: "System", android: "sans-serif", default: "System" })!,
  medium: Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" })!,
  semibold: Platform.select({ ios: "System", android: "sans-serif-medium", default: "System" })!,
  bold: Platform.select({ ios: "System", android: "sans-serif", default: "System" })!,
};
