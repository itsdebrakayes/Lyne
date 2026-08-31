/**
 * OnboardingScreen — the welcome moment (single screen, GoMart-style).
 *
 * A brand mosaic fills the top: rounded tiles in Lyne forest/cyan carrying the
 * product's icons, on a soft cyan-tinted canvas (the dark tiles are what
 * "gradient into black" becomes in a future dark mode). Below: the welcome,
 * the slogan, and one verb — Start queuing.
 */
import React from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { activeScheme, colors, font, hexToRgba, shadow } from '../../lib/theme';

type Tile = { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; h: number };

const COLUMN_A: Tile[] = [
  { icon: 'ticket', bg: colors.dark, fg: colors.accent, h: 150 },
  { icon: 'time-outline', bg: '#ffffff', fg: colors.accentDeep, h: 110 },
  { icon: 'barcode-outline', bg: colors.accent, fg: colors.accentInk, h: 130 },
  { icon: 'location', bg: '#ffffff', fg: colors.ink, h: 120 },
];
const COLUMN_B: Tile[] = [
  { icon: 'notifications', bg: '#ffffff', fg: colors.accentDeep, h: 110 },
  { icon: 'people-outline', bg: colors.accent, fg: colors.accentInk, h: 140 },
  { icon: 'checkmark-done', bg: colors.dark, fg: '#ffffff', h: 120 },
  { icon: 'navigate', bg: '#ffffff', fg: colors.ink, h: 130 },
];
const COLUMN_C: Tile[] = [
  { icon: 'storefront-outline', bg: colors.accent, fg: colors.accentInk, h: 120 },
  { icon: 'hourglass-outline', bg: colors.dark, fg: colors.accent, h: 130 },
  { icon: 'sparkles', bg: '#ffffff', fg: colors.accentDeep, h: 110 },
  { icon: 'qr-code-outline', bg: colors.dark, fg: '#ffffff', h: 140 },
];

function MosaicColumn({ tiles, offset = 0 }: { tiles: Tile[]; offset?: number }) {
  return (
    <View style={{ flex: 1, gap: 14, marginTop: offset }}>
      {tiles.map((tile, index) => (
        <View
          key={index}
          style={{
            height: tile.h, borderRadius: 30, backgroundColor: tile.bg,
            alignItems: 'center', justifyContent: 'center',
            /* The white tiles are the approved look and stay white in both
               schemes — they read as cards in the mosaic. Only the hairline is
               conditional: it separates a white tile from a white page in light
               mode, and would be invisible clutter on a dark one. */
            borderWidth: tile.bg === '#ffffff' && activeScheme === 'light' ? 1 : 0,
            borderColor: colors.border,
            ...shadow.card,
          }}
        >
          <Ionicons name={tile.icon} size={34} color={tile.fg} />
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { height } = useWindowDimensions();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        pointerEvents="none"
        /* The light-mode values are untouched — this screen is approved as it
           looks. Dark mode was the bug: a pale cyan wash sat over a near-black
           app, because both stops were fixed light hues while colors.bg moved
           with the scheme. The dark branch tints the same accent instead, so
           the shape of the fade is identical and only the hues follow. */
        colors={activeScheme === 'dark'
          ? [hexToRgba(colors.accent, 0.16), hexToRgba(colors.accent, 0.06), colors.bg]
          : ['#dff3f8', '#eef6f8', colors.bg]}
        locations={[0, 0.45, 0.8]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.72 }}
      />

      {/* brand mosaic — oversized and softly rotated, bleeding off the edges */}
      <View style={{ height: height * 0.56, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute', top: -70, left: -46, right: -46,
            flexDirection: 'row', gap: 14,
            transform: [{ rotate: '-7deg' }],
          }}
        >
          <MosaicColumn tiles={COLUMN_A} offset={34} />
          <MosaicColumn tiles={COLUMN_B} offset={-16} />
          <MosaicColumn tiles={COLUMN_C} offset={58} />
        </View>
        {/* fade the mosaic into the content area */}
        <LinearGradient
          pointerEvents="none"
          colors={[hexToRgba(colors.bg, 0), colors.bg]}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 110 }}
        />
      </View>

      {/* welcome */}
      <View style={{ flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 46 }}>
        <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', marginBottom: 22, ...shadow.card }}>
          <Text style={{ color: colors.accent, fontFamily: font.extra, fontSize: 26 }}>L</Text>
        </View>
        <Text style={{ fontFamily: font.extra, fontSize: 34, lineHeight: 40, color: colors.ink, letterSpacing: -1, textAlign: 'center' }}>
          Welcome to{'\n'}Lyne
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 14, maxWidth: 300 }}>
          Skip the line, not your day — live waits, remote queueing, and perfectly timed arrivals.
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={onComplete}
          activeOpacity={0.9}
          style={{ alignSelf: 'stretch', marginTop: 30, backgroundColor: colors.dark, borderRadius: 22, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, ...shadow.hero }}
        >
          <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 16 }}>Start queuing</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
