/**
 * OnboardingScreen — the welcome moment.
 *
 * Rewritten 2026-08-21. What was here before was a mosaic of twelve rounded
 * tiles, rotated seven degrees, bleeding off both edges, carrying a ticket, a
 * clock, a barcode, a pin, a bell, some people, a tick, a storefront, an
 * hourglass, SPARKLES, a QR code and a navigation arrow. Nine of those had
 * nothing to do with each other. It is the most recognisable AI-generated app
 * device there is, and it is now a queue instead — the thing the product is
 * actually about.
 *
 * The copy changed for the same reason. It read:
 *
 *   "Skip the line, not your day — live waits, remote queueing, and perfectly
 *    timed arrivals."
 *
 * That is three generated-copy signatures in one sentence: an em-dash, the
 * "X, not Y" construction, and a rule of three. It now says what the app does,
 * in two plain sentences.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '../../lib/theme';
import { QueueScene } from '../../components/QueueScene';

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* The subject, up top, given room to breathe. */}
      {/* justifyContent:'flex-end' rather than 'center' — centring left a large
          dead region above the scene, which is the same complaint as the auth
          form floating in space. */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 8 }}>
        <QueueScene height={250} />
      </View>

      {/* The content sits on a raised surface that runs to the bottom edge —
          the Parcel structure. It gives the words a floor instead of leaving
          them hovering in the middle of the screen. */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          paddingHorizontal: 28,
          paddingTop: 32,
          paddingBottom: 44,
          ...shadow.hero,
        }}
      >
        <View
          style={{
            width: 52, height: 52, borderRadius: 18, backgroundColor: colors.dark,
            alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...shadow.card,
          }}
        >
          <Text style={{ color: colors.accent, fontFamily: font.extra, fontSize: 24 }}>L</Text>
        </View>

        <Text
          style={{
            fontFamily: font.extra, fontSize: 31, lineHeight: 37,
            color: colors.ink, letterSpacing: -0.9,
          }}
        >
          Take your place{'\n'}before you arrive.
        </Text>

        <Text
          style={{
            fontFamily: font.medium, fontSize: 14.5, lineHeight: 22,
            color: colors.muted, marginTop: 13, maxWidth: 320,
          }}
        >
          See how long the wait is before you leave home. Hold your spot from
          wherever you are, and turn up when you are nearly at the front.
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Get started"
          onPress={onComplete}
          activeOpacity={0.9}
          style={{
            marginTop: 28, backgroundColor: colors.dark, borderRadius: 20, height: 58,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
            ...shadow.hero,
          }}
        >
          <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 16 }}>Get started</Text>
          <Ionicons name="arrow-forward" size={17} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
