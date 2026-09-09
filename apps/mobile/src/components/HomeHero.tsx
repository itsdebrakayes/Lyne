/**
 * HomeHero — the opening card on Home.
 *
 * Modelled on the promo card in Debra's reference: a dark panel, a two-beat
 * headline (a question, then the answer in display size), two short proof
 * lines, and a pair of actions — one solid, one outlined.
 *
 * Two deliberate departures from the reference, both because copying it
 * literally would have been worse:
 *
 *  • No photograph. The reference fills its right half with a stock photo of a
 *    technician. We have no photography, and a generic stock image of a queue
 *    is exactly the "an AI ran over it" texture we are trying to get away from.
 *    The space carries a drawn motif instead — a line of people collapsing into
 *    a single held ticket — which is the product's actual idea and cannot look
 *    borrowed.
 *
 *  • The dots are real. In the reference they imply a carousel. Rotating the
 *    headline is a genuine improvement here, because the second and third
 *    beats can say something the first cannot without becoming a paragraph.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '../lib/theme';

export interface HeroBeat {
  kicker: string;
  headline: string;
  points: [string, string];
}

/* Three beats, rotating. Each is a different reason to be here — the wait you
   cannot see, the standing, and the wasted trip — rather than three ways of
   saying "queues are bad". */
export const HERO_BEATS: HeroBeat[] = [
  {
    kicker: 'Still standing in line?',
    headline: "Let's get you out\nof it.",
    points: ['Live waits, measured at the counter', 'Hold your spot from your phone'],
  },
  {
    kicker: 'Not sure when to go?',
    headline: 'Go when it is\nquiet.',
    points: ['See the wait before you leave home', 'We tell you when to set off'],
  },
  {
    kicker: 'Wasted a morning before?',
    headline: 'Never queue\nblind again.',
    points: ['Know how many are ahead of you', 'Leave the line any time, no penalty'],
  },
];

const ROTATE_MS = 6500;

/** The drawn motif: a queue of people compressing into one held ticket. */
function QueueMotif() {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{ position: 'absolute', right: -6, top: 0, bottom: 0, width: 128, justifyContent: 'center' }}
    >
      {/* The line, thinning as it approaches the ticket.

          Parked clear of the ticket's left edge. At right:74 the stack ran
          from 74 to 94 and the ticket from 14 to 96, so the last three people
          in the queue sat on top of the thing they were queuing for. */}
      <View style={{ position: 'absolute', right: 92, top: 36, gap: 7 }}>
        {[0.30, 0.22, 0.15, 0.09].map((o, i) => (
          <View
            key={i}
            style={{
              width: 18 - i * 2, height: 18 - i * 2, borderRadius: 9,
              backgroundColor: `rgba(255,255,255,${o})`, alignSelf: 'flex-end',
            }}
          />
        ))}
      </View>

      {/* The ticket the line becomes. Tilted so it reads as an object rather
          than another rectangle in a stack of rectangles. */}
      <View
        style={{
          position: 'absolute', right: 8, top: 46, width: 78, borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,.10)', borderWidth: 1,
          borderColor: 'rgba(255,255,255,.16)', paddingVertical: 14, paddingHorizontal: 12,
          transform: [{ rotate: '7deg' }],
        }}
      >
        <View style={{ height: 5, width: 26, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.34)' }} />
        <Text style={{ fontFamily: font.extra, fontSize: 21, color: '#fff', letterSpacing: -0.8, marginTop: 7 }}>
          A-14
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 9 }}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: i < 2 ? colors.accentOnDark : 'rgba(255,255,255,.24)',
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export function HomeHero({
  onJoinNow,
  onPlanLater,
}: {
  onJoinNow: () => void;
  onPlanLater: () => void;
}) {
  const [beat, setBeat] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  /* Rotation stops entirely under Reduce Motion — a headline that swaps itself
     out mid-read is exactly what that setting exists to prevent. */
  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true })
        .start(() => {
          setBeat(b => (b + 1) % HERO_BEATS.length);
          Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        });
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [fade, reduceMotion]);

  const b = HERO_BEATS[beat];

  return (
    <View style={{ marginTop: 18 }}>
      <View
        style={{
          backgroundColor: colors.dark, borderRadius: 26, padding: 20,
          overflow: 'hidden', ...shadow.hero,
        }}
      >
        <QueueMotif />

        <Animated.View style={{ opacity: fade, paddingRight: 96 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,.62)' }}>
            {b.kicker}
          </Text>
          <Text style={{ fontFamily: font.extra, fontSize: 27, lineHeight: 32, color: '#fff', letterSpacing: -0.9, marginTop: 6 }}>
            {b.headline}
          </Text>

          <View style={{ gap: 8, marginTop: 15 }}>
            {b.points.map((p, i) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons
                  name={i === 0 ? 'flash' : 'shield-checkmark'}
                  size={13}
                  color={colors.accentOnDark}
                />
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.78)' }}>
                  {p}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <TouchableOpacity
            onPress={onJoinNow}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Join a line now"
            style={{
              flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: '#fff',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <Ionicons name="flash" size={15} color={colors.dark} />
            <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: colors.dark }}>Join a line now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPlanLater}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Plan a visit for later"
            style={{
              flex: 1, minHeight: 46, borderRadius: 15,
              borderWidth: 1, borderColor: 'rgba(255,255,255,.26)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <Ionicons name="calendar-outline" size={15} color="#fff" />
            <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: '#fff' }}>Plan for later</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dots sit OUTSIDE the card, as in the reference — inside, they compete
          with the buttons for the same corner of attention. */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {HERO_BEATS.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === beat ? 18 : 6, height: 6, borderRadius: 3,
              backgroundColor: i === beat ? colors.accent : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default HomeHero;
