/**
 * OfflineBanner — one honest line when the connection is gone.
 *
 * It sits above the whole app rather than inside a screen, because the fact
 * that numbers have stopped updating is true everywhere at once. It says what
 * still works, since a customer who has already joined a queue keeps their
 * place whether or not their phone can reach us.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';
import { useIsOffline } from '../lib/network';

export default function OfflineBanner() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();

  if (!offline) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        paddingTop: insets.top + 6,
        paddingBottom: 10,
        paddingHorizontal: 18,
        backgroundColor: colors.dark,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.accent} />
      <Text
        style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: '#fff', lineHeight: 17 }}
        maxFontSizeMultiplier={1.6}
      >
        You’re offline. Your place in line is safe — we’ll update it when you reconnect.
      </Text>
    </View>
  );
}
