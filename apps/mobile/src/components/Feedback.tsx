/**
 * Feedback.tsx — loading skeletons + error states (v4 design system).
 *
 * Professional apps never show a bare spinner over a blank page or a raw
 * red string: content areas keep their shape while loading (skeletons) and
 * failures explain themselves with a way to retry.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t } from '../lib/theme';

export function Skeleton({ width, height, radius = 12, style }: { width?: number | `${number}%`; height: number; radius?: number; style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: '#e4e7eb', opacity: pulse }, style]}
    />
  );
}

/** List-row shaped placeholders (logo tile + two text lines + trailing stat). */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 11 }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[t.listRow, { borderColor: colors.borderSoft }]}>
          <Skeleton width={48} height={48} radius={16} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width="72%" height={13} radius={7} />
            <Skeleton width="48%" height={10} radius={5} />
          </View>
          <Skeleton width={44} height={26} radius={10} />
        </View>
      ))}
    </View>
  );
}

/** Card-shaped placeholder for hero/detail blocks. */
export function SkeletonCard({ height = 180 }: { height?: number }) {
  return (
    <View style={[t.cardLg, { padding: 16, gap: 12 }]}>
      <Skeleton width="55%" height={14} radius={7} />
      <Skeleton height={height - 90} radius={16} />
      <Skeleton width="70%" height={12} radius={6} />
    </View>
  );
}

export function ErrorCard({
  title = 'Something went wrong',
  message,
  onRetry,
  compact = false,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[t.card, { padding: compact ? 14 : 20, alignItems: 'center', borderColor: '#f0dcdd' }]}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#fdeceb', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="cloud-offline-outline" size={19} color={colors.danger} />
      </View>
      <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink, marginTop: 10 }}>{title}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 5, lineHeight: 18 }}>{message}</Text>
      {/* accent/accentInk, not ink + hardcoded white. colors.ink is #eef2f8 in
          dark mode, so this button was white text on a near-white pill —
          invisible, on the one screen state where the user most needs something
          to press. The accent pair flips with the theme. */}
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={{ marginTop: 14, minHeight: 44, justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 22 }}
        >
          <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accentInk }}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Centered empty state with an icon, used when a list has no content. */
export function EmptyCard({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 34 }}>
      <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={colors.muted} />
      </View>
      <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginTop: 13 }}>{title}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 5, maxWidth: 260, lineHeight: 18 }}>{message}</Text>
    </View>
  );
}
