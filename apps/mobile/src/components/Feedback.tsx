/**
 * Feedback.tsx — loading skeletons, error states, and the Section that binds
 * them to one region of a screen.
 *
 * Professional apps never show a bare spinner over a blank page or a raw
 * red string: content areas keep their shape while loading (skeletons) and
 * failures explain themselves with a way to retry.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useIsOffline } from '../lib/network';
import OfflineState from './OfflineState';
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

/**
 * Section — one region of a screen that loads, fails and recovers on its own.
 *
 * The Home screen had three queries and one `isLoading`, taken from whichever
 * happened to be first. So a slow branch list held the whole page blank, and a
 * failure in either of the other two showed nothing at all — no message, no
 * retry, just a heading with a gap under it. One panel could take the screen
 * down with it, and one panel could fail in silence.
 *
 * This is the YouTube arrangement: the frame is never in doubt. The heading and
 * its action render immediately and stay put, and only the BODY under them
 * swaps between four states. A section that is still loading sits beside one
 * that has already arrived; a section that failed offers a retry that refetches
 * only itself and leaves its neighbours alone.
 *
 * Order matters. Error is checked before loading, because react-query keeps
 * `isFetching` true while it retries — reporting that as "loading" would hide a
 * failure behind a shimmer that never resolves, which is the most confusing
 * state of the four.
 */
export function Section({
  title,
  action,
  loading,
  error,
  onRetry,
  isEmpty,
  skeleton,
  empty,
  errorMessage,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  skeleton?: React.ReactNode;
  empty?: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string };
  errorMessage?: string;
  children?: React.ReactNode;
}) {
  const offline = useIsOffline();

  const body = () => {
    if (error) {
      /* "Shortest waits didn't load. Retry." is a small lie when the phone has
         no signal: nothing went wrong with the section, and retrying will fail
         identically until the connection comes back. Name the real cause — one
         change here covers every section in the app. */
      if (offline) return <OfflineState compact tone="light" reassure={false} onRetry={onRetry} />;
      return (
        <ErrorCard
          compact
          title={`${title} didn't load`}
          message={errorMessage || describeLoadFailure(error)}
          onRetry={onRetry}
        />
      );
    }
    if (loading) return skeleton ?? <SkeletonRows count={2} />;
    if (isEmpty && empty) return <EmptyCard {...empty} />;
    return children;
  };

  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>{title}</Text>
        {action ? (
          <TouchableOpacity
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${action.label} — ${title}`}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.accent }}>{action.label} ›</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {body()}
    </View>
  );
}

/**
 * Say what went wrong, why, and what to do — the same rule the counter screen
 * follows. "Something went wrong" names no cause and offers no move, so the
 * only thing left is to press retry and hope, which is how a person decides an
 * app is broken.
 */
export function describeLoadFailure(err: unknown): string {
  const text = (err instanceof Error ? err.message : String(err ?? '')).trim();

  if (/failed to fetch|network|load failed|ERR_(CONNECTION|NETWORK|INTERNET)|abort/i.test(text)) {
    return 'We could not reach Lyne. Check your connection — nothing else on this screen is affected.';
  }
  if (/\b401\b|unauthori[sz]ed|invalid or expired token/i.test(text)) {
    return 'Your session has expired. Sign in again to see this.';
  }
  if (/\b403\b|forbidden/i.test(text)) {
    return 'This is not available on your account.';
  }
  if (/\b5\d\d\b|server error/i.test(text)) {
    return 'Lyne is having trouble at our end. This usually clears in a moment.';
  }
  return text || 'This part did not load. Everything else on the screen still works.';
}
