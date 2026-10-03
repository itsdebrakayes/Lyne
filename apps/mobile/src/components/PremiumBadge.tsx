/**
 * PremiumBadge — the marker that says this account is on Lyne Premium.
 *
 * A flat ink pill with letter-spaced white caps, which is what the Predictive
 * Insights design specifies and what the rest of the v5 system looks like.
 *
 * It was a cyan-to-blue gradient (#1fc2de → #2b6fe3) carried over from the v4
 * palette, and it was the only cyan left on the screen — a leftover that read
 * as a sticker from a different app sitting on a navy page. The v5 system is
 * one deep blue and neutrals; a badge is a label, not a feature, and it does
 * not get the loudest treatment on the screen.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { colors, font } from '../lib/theme';

export function PremiumBadge({
  label = 'PREMIUM',
  size = 'md',
}: {
  label?: string;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Lyne Premium account"
      style={{
        borderRadius: 12,
        paddingVertical: sm ? 5 : 6,
        paddingHorizontal: sm ? 9 : 10,
        /* colors.dark, not a literal: it is the same navy the hero cards use,
           and it stays navy in the dark theme, where the ink token would flip
           to near-white and take the label with it. */
        backgroundColor: colors.dark,
      }}
    >
      <Text
        style={{
          fontFamily: font.extra,
          fontSize: sm ? 9 : 9.5,
          letterSpacing: 1,
          color: '#fff',
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export default PremiumBadge;
