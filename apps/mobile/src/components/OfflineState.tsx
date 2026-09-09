/**
 * OfflineState — the whole screen, when there is nothing to show and the reason
 * is the connection.
 *
 * The banner already says "you are offline" everywhere at once. This is for the
 * narrower case where a screen has NOTHING to put on itself because of it — a
 * list that never loaded, on a first visit with no cache. A generic "Something
 * went wrong. Retry." there is a small lie: nothing went wrong with the app, and
 * retrying will fail identically until the connection returns.
 *
 * So it says the true thing, and it leads with the reassurance rather than the
 * failure, because the reassurance is the part that matters to somebody standing
 * in a queue: their place is held on our side, not on their phone.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors, font } from '../lib/theme';
import OrbitField from './OrbitField';

export function OfflineState({
  onRetry,
  tone = 'dark',
  /** Said above the fold on screens where the user holds a place. */
  reassure = true,
  /** Sized to sit inside a section of a page rather than to be the page. */
  compact,
}: {
  onRetry?: () => void;
  tone?: 'light' | 'dark';
  reassure?: boolean;
  compact?: boolean;
}) {
  const dark = tone === 'dark';

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="You are offline"
      style={{ alignItems: 'center', paddingVertical: compact ? 22 : 40, paddingHorizontal: 20 }}
    >
      <OrbitField tone={tone} size={compact ? 92 : 132} />

      <Text style={{ fontFamily: font.extra, fontSize: compact ? 18 : 24, letterSpacing: -0.8, color: dark ? '#fff' : colors.ink, textAlign: 'center', marginTop: compact ? 18 : 26 }}>
        No connection
      </Text>
      <Text style={{ fontFamily: font.medium, fontSize: compact ? 13 : 14.5, lineHeight: compact ? 18.5 : 21, color: dark ? 'rgba(255,255,255,.55)' : colors.muted, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
        {reassure
          ? 'Live waits need a connection, so they are paused. Anything you have already joined is held for you and will catch up on its own.'
          : 'This needs a connection. It will load as soon as you have one.'}
      </Text>

      {!!onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={{ backgroundColor: colors.accent, borderRadius: 17, paddingVertical: 16, paddingHorizontal: 26, marginTop: 24 }}
        >
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default OfflineState;
