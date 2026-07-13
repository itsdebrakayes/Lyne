/**
 * Glass.tsx — Apple "liquid glass" materials for QMe Now.
 *
 * GlassCard / GlassView render an expo-blur BlurView (real background blur on
 * iOS, approximated on Android) with a translucent fill and a hairline
 * highlight border, so surfaces read as frosted glass floating over whatever
 * sits behind them. On web (and if blur is unavailable) they degrade to a
 * high-opacity translucent fill that still looks frosted.
 */
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, activeScheme } from '../lib/theme';

const canBlur = Platform.OS !== 'web';

/**
 * Sheen — an absolute-fill gradient that lights the top and shades the bottom
 * of a rounded surface, giving it a subtle spherical/raised depth (the way
 * Apple's avatars and buttons look "full" rather than flat). Drop it inside a
 * rounded container, behind the content. `strength` scales the effect.
 */
export function Sheen({ radius = 999, strength = 1 }: { radius?: number; strength?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(255,255,255,${0.30 * strength})`, 'rgba(255,255,255,0)', `rgba(0,0,0,${0.07 * strength})`]}
      locations={[0, 0.52, 1]}
      start={{ x: 0.32, y: 0 }}
      end={{ x: 0.68, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}

type GlassProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tint?: 'light' | 'dark';
  intensity?: number;
  radius?: number;
};

export function GlassView({ children, style, tint, intensity = 40, radius = 24 }: GlassProps) {
  // Untinted glass follows the active theme — light blur on the light canvas,
  // dark blur in dark mode. Explicit tints (e.g. the dark nav pill) still win.
  const dark = (tint ?? (activeScheme === 'dark' ? 'dark' : 'light')) === 'dark';
  const fill = dark ? colors.glassDark : colors.glass;
  const border = dark ? colors.glassDarkBorder : colors.glassBorder;
  const base: ViewStyle = {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: border,
    overflow: 'hidden',
  };

  if (canBlur) {
    return (
      <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={[base, style]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} pointerEvents="none" />
        {children}
      </BlurView>
    );
  }
  // Web fallback: a stronger translucent fill reads as frosted without blur.
  return (
    <View style={[base, { backgroundColor: dark ? 'rgba(16,29,24,0.82)' : colors.glassStrong }, style]}>
      {children}
    </View>
  );
}

/** GlassView with sensible card padding baked in. */
export function GlassCard({ children, style, tint, intensity = 38, radius = 26, padding = 18 }: GlassProps & { padding?: number }) {
  return (
    <GlassView tint={tint} intensity={intensity} radius={radius} style={style}>
      <View style={{ padding }}>{children}</View>
    </GlassView>
  );
}

