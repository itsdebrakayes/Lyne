/**
 * PremiumLock — what a free customer sees where a paid feature would be.
 *
 * It renders the REAL thing underneath and frosts it over. That is the whole
 * idea, and it is taken straight from the Predictive Insights design: the
 * locked panel there is the actual heatmap with a blurred scrim on top, not a
 * drawing of one.
 *
 * What it replaces was a row of padlock icons with "••••••· ••:•• ••" where the
 * times should be, and three grey dots per line. It had two problems. It looked
 * like a broken screen rather than a withheld one — nothing on it was real, so
 * there was nothing to want. And because the upsell beneath it was feature-
 * flagged off, a free customer got a wall of padlocks with no explanation and
 * no way forward: a dead end that read as a bug.
 *
 * Blurring the real content fixes both at once. The shape of the answer is
 * visible — you can see there IS a quiet hour on Tuesday, you simply cannot
 * read which — and the overlay says plainly what this is and what to do.
 *
 * TWO LAYERS, DELIBERATELY. BlurView does the work on iOS and on Android 12+,
 * but Android's support has been through three implementations and can degrade
 * to nothing. A blur that silently fails would publish every premium value on
 * the screen, so a translucent scrim sits over the blur and is on its own
 * sufficient to make the digits unreadable. The blur makes it look considered;
 * the scrim makes it correct.
 */
import React from 'react';
import { Text, TouchableOpacity, View, ActivityIndicator, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '../lib/theme';

export interface PremiumLockProps {
  /** The real feature. Rendered, then covered. */
  children: React.ReactNode;
  /** False renders the children untouched — the entitled case. */
  locked: boolean;
  /** One line, in the design's voice: what you get, not what you lack. */
  headline: string;
  /** The trial CTA. Omitted when there is no way to buy yet. */
  onStartTrial?: () => void;
  trialBusy?: boolean;
  /** Shown above the button when a trial attempt failed. */
  error?: string;
  /** Corner radius of the thing being covered, so the scrim matches it. */
  radius?: number;
  /** Replaces the CTA when purchasing is not available on this build. */
  unavailableNote?: string;
}

export function PremiumLock({
  children, locked, headline, onStartTrial, trialBusy, error,
  radius = 24, unavailableNote,
}: PremiumLockProps) {
  if (!locked) return <>{children}</>;

  return (
    <View style={{ borderRadius: radius, overflow: 'hidden', position: 'relative' }}>
      {/* `pointerEvents` none, not `disabled` on each child: the content below
          is decoration now, and a tap anywhere on the panel should reach the
          overlay rather than navigating somewhere the customer cannot go.
          `accessibilityElementsHidden` and `importantForAccessibility` keep
          VoiceOver and TalkBack from reading out the values the blur is there
          to withhold — a screen reader must not be the way around a paywall. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </View>

      <BlurView
        intensity={Platform.OS === 'android' ? 28 : 18}
        tint={colors.bg === '#f1f3f7' ? 'light' : 'dark'}
        /* Android needs this to use the real blur rather than a no-op; without
           it the view renders transparent on most devices. */
        experimentalBlurMethod="dimezisBlurView"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        accessibilityRole="summary"
        accessibilityLabel={`Lyne Premium. ${headline}`}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          /* The scrim. 0.72 is the design's value and is what makes the digits
             unreadable on its own, with no blur at all. Tokenised rather than
             literal: hardcoded light, it became a bright rectangle in dark mode
             with white theme-aware ink sitting on top of it. */
          backgroundColor: colors.scrim,
          alignItems: 'center', justifyContent: 'center',
          paddingVertical: 24, paddingHorizontal: 24, gap: 10,
        }}
      >
        <Text
          style={{
            fontFamily: font.extra, fontSize: 10.5, letterSpacing: 1.6,
            color: colors.accentDeep, textAlign: 'center',
          }}
        >
          LYNE PREMIUM
        </Text>
        <Text
          style={{
            fontFamily: font.extra, fontSize: 18, lineHeight: 22.5,
            letterSpacing: -0.3, color: colors.ink, textAlign: 'center',
          }}
        >
          {headline}
        </Text>

        {!!error && (
          <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.danger, textAlign: 'center' }}>
            {error}
          </Text>
        )}

        {onStartTrial ? (
          <TouchableOpacity
            onPress={onStartTrial}
            disabled={trialBusy}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Start 14 day free trial"
            accessibilityState={{ disabled: !!trialBusy }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
              minHeight: 46, paddingVertical: 12, paddingHorizontal: 18,
              borderRadius: 14, backgroundColor: colors.accent,
              opacity: trialBusy ? 0.75 : 1,
              ...shadow.card,
            }}
          >
            {trialBusy
              ? <ActivityIndicator color={colors.accentInk} size="small" />
              : (
                <>
                  <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accentInk }}>
                    Start 14-day free trial
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.accentInk} />
                </>
              )}
          </TouchableOpacity>
        ) : unavailableNote ? (
          /* No button at all rather than a disabled one. A control that cannot
             do anything is a App Review Guideline 2.1 problem and, more to the
             point, it wastes the one tap a curious customer was going to give
             us. A sentence is honest; a dead button is not. */
          <Text
            style={{
              fontFamily: font.semibold, fontSize: 12.5, lineHeight: 18,
              color: colors.sub, textAlign: 'center', maxWidth: 260,
            }}
          >
            {unavailableNote}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default PremiumLock;
