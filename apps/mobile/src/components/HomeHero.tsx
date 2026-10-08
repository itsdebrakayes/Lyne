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
import { colors, font, shadow } from '../lib/theme';

export interface HeroBeat {
  kicker: string;
  /** Set in Manrope 800 — the half that carries the idea. */
  lead: string;
  /** Set in Manrope 500 — the half that completes the sentence. */
  tail: string;
  points: [string, string];
}

/* Three beats, rotating. Each is a different reason to be here — the wait you
   cannot see, the standing, and the wasted trip — rather than three ways of
   saying "queues are bad". */
export const HERO_BEATS: HeroBeat[] = [
  {
    kicker: 'Still standing in line?',
    lead: "Let's get you out",
    tail: 'of it.',
    points: ['Live waits, measured at the counter', 'Hold your spot from your phone'],
  },
  {
    kicker: 'Not sure when to go?',
    lead: 'Go when it is',
    tail: 'quiet.',
    points: ['See the wait before you leave home', 'We tell you when to set off'],
  },
  {
    kicker: 'Wasted a morning before?',
    lead: 'Never queue',
    tail: 'blind again.',
    points: ['Know how many are ahead of you', 'Leave the line any time, no penalty'],
  },
];

const ROTATE_MS = 6500;

/** The drawn motif: a queue of people compressing into one held ticket. */
/**
 * The hero's illustration (App Screens Refresh 1a): a real ticket, the thing
 * Lyne hands you, tilted over a faint second one. It replaced an abstract
 * stack of dots and a placeholder card.
 */
const BARS = [1.5, 1.5, 2, 1.5, 1, 2, 1.5, 1, 1.5, 2, 1, 1.5, 2, 1.5, 1, 1.5, 2, 1, 1.5, 1.5, 2, 1, 1.5];

function TicketMotif() {
  return (
    <View pointerEvents="none" accessible={false} style={{ position: 'absolute', right: 0, top: 0, width: 120, height: 130 }}>
      <View style={{ position: 'absolute', right: 26, top: 14, width: 80, height: 98, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', transform: [{ rotate: '-8deg' }] }} />
      <View style={{ position: 'absolute', right: 14, top: 10, width: 84, borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden', transform: [{ rotate: '7deg' }], shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
        <View style={{ paddingTop: 10, paddingHorizontal: 10 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 8, letterSpacing: 1.2, color: colors.accent }}>LYNE</Text>
          <Text style={{ fontFamily: font.semibold, fontSize: 8, color: '#7a8699', marginTop: 5 }}>Your number</Text>
          <Text style={{ fontFamily: font.extra, fontSize: 21, letterSpacing: -0.8, lineHeight: 23, color: colors.dark }}>A-047</Text>
        </View>
        <View style={{ marginTop: 7, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: '#d3d9e2' }}>
          <View style={{ position: 'absolute', left: -6, top: -6, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.dark }} />
          <View style={{ position: 'absolute', right: -6, top: -6, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.dark }} />
        </View>
        <View style={{ paddingTop: 7, paddingHorizontal: 10, paddingBottom: 8 }}>
          <View style={{ height: 10, flexDirection: 'row', gap: 1.5, overflow: 'hidden' }}>
            {BARS.map((w, i) => <View key={i} style={{ width: w, height: 10, backgroundColor: colors.dark }} />)}
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 7.5, color: '#7a8699', marginTop: 5 }}>7 ahead · ~26 min</Text>
        </View>
      </View>
    </View>
  );
}

export function HomeHero({
  onJoinNow,
  onPlanLater,
  /**
   * When a Line Helper is holding a place, the second button stops offering to
   * plan and starts showing the plan you already made.
   *
   * Screen 05 otherwise had no door. Planning for later is exactly what you are
   * no longer doing once a helper is in the line for you — the only thing you
   * want from this screen then is when to leave, and that is one tap away
   * rather than buried behind the branch you happened to pick it from.
   *
   * That reasoning holds for a helper LATER TODAY and not for one scheduled
   * next Tuesday — and this button is the only route into "Plan your visit"
   * anywhere in the app, so taking the slot took Smart Timing with it: schedule
   * a helper a week out and the whole premium feature was unreachable until it
   * ran. The link below the row puts it back without giving the offer equal
   * weight to the live state.
   */
  helper,
}: {
  onJoinNow: () => void;
  onPlanLater: () => void;
  helper?: { leaveLabel: string; onOpen: () => void } | null;
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
          backgroundColor: colors.dark, borderRadius: 26, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20,
          overflow: 'hidden', ...shadow.hero,
        }}
      >
        <TicketMotif />

        <Animated.View style={{ opacity: fade }}>
          <View style={{ paddingRight: 120 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,.62)' }}>
            {b.kicker}
          </Text>
          {/* Two weights in one sentence — the treatment the Predictive
              Insights design is built on ("Beat the line before you leave
              home"). The words and the line break are unchanged; only the
              weight of the second half is. The lighter tail stops a 27pt
              headline reading as a slab and puts the emphasis on the half
              that carries the idea.

              One Text, not two: a nested Text inherits the parent's line
              height, so the two halves stay on one leading grid. Stacking two
              Texts re-measures the second and the gap drifts by a point or
              two at larger accessibility sizes. */}
          <Text
            style={{ fontFamily: font.extra, fontSize: 27, lineHeight: 32, color: '#fff', letterSpacing: -0.9, marginTop: 6 }}
            accessibilityLabel={`${b.lead} ${b.tail}`}
          >
            {b.lead}
            {'\n'}
            <Text style={{ fontFamily: font.medium, color: 'rgba(255,255,255,.80)' }}>{b.tail}</Text>
          </Text>

          </View>
          <View style={{ gap: 8, marginTop: 16 }}>
            {b.points.map(p => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentOnDark }} />
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.78)' }}>{p}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
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
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.dark }}>Join a line now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={helper ? helper.onOpen : onPlanLater}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={helper
              ? `Your helper is holding your place. Leave by ${helper.leaveLabel}.`
              : 'Plan a visit for later'}
            style={{
              flex: 1, minHeight: 46, borderRadius: 15,
              /* Filled green when a helper is live — it is a live state rather
                 than an offer, and it should not look like the thing beside it
                 that starts something new. */
              backgroundColor: helper ? 'rgba(47,191,113,.18)' : 'transparent',
              borderWidth: 1,
              borderColor: helper ? 'rgba(63,208,127,.5)' : 'rgba(255,255,255,.26)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {helper ? (
              <>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#3fd07f' }} />
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 13.5, color: '#fff' }}>
                  Leave by {helper.leaveLabel}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#fff' }}>Plan for later</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Only while the helper has the button. Quiet on purpose: it restores
            the route without competing with the live state above it. */}
        {!!helper && (
          <TouchableOpacity
            onPress={onPlanLater}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Plan another visit"
            style={{ alignSelf: 'center', paddingTop: 12, paddingHorizontal: 8 }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
              Plan another visit →
            </Text>
          </TouchableOpacity>
        )}
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
