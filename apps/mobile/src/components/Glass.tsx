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
import { colors } from '../lib/theme';

const canBlur = Platform.OS !== 'web';

type GlassProps = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  tint?: 'light' | 'dark';
  intensity?: number;
  radius?: number;
};

export function GlassView({ children, style, tint = 'light', intensity = 40, radius = 24 }: GlassProps) {
  const dark = tint === 'dark';
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
export function GlassCard({ children, style, tint = 'light', intensity = 38, radius = 26, padding = 18 }: GlassProps & { padding?: number }) {
  return (
    <GlassView tint={tint} intensity={intensity} radius={radius} style={style}>
      <View style={{ padding }}>{children}</View>
    </GlassView>
  );
}

