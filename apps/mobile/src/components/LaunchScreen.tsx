/**
 * LaunchScreen — the animated splash.
 *
 * It takes over from the native splash, which is the same navy, so the handoff
 * is dark→dark with no white flash. The sequence is choreographed rather than
 * "everything fades in at once":
 *
 *   1. the mark lands on a spring — the only thing on screen for a beat
 *   2. the wordmark wipes out from behind it
 *   3. the tagline and the loading rhythm follow
 *
 * That order is the point. A brand moment that reveals everything simultaneously
 * reads as a static image someone faded up; revealing in sequence reads as
 * something assembling itself, which is what makes it feel designed.
 *
 * Under Reduce Motion the whole thing is a single short fade — the brand still
 * appears, nothing moves.
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing as RNEasing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, font } from '../lib/theme';
import { duration, easing, spring, useReducedMotion } from '../lib/motion';

/** A single loading dot that breathes on a staggered loop. */
function Dot({ delay, reduced }: { delay: number; reduced: boolean }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    if (reduced) { v.value = 0.65; return; }
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 520, easing: RNEasing.inOut(RNEasing.ease) }),
          withTiming(0.3, { duration: 520, easing: RNEasing.inOut(RNEasing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, reduced, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }, style]} />;
}

export default function LaunchScreen() {
  const reduced = useReducedMotion();

  const markScale = useSharedValue(reduced ? 1 : 0.7);
  const markOpacity = useSharedValue(reduced ? 1 : 0);
  const wordWidth = useSharedValue(reduced ? 1 : 0);
  const tail = useSharedValue(reduced ? 1 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      markScale.value = 1; markOpacity.value = 1; wordWidth.value = 1; tail.value = 1;
      return;
    }
    // 1 — the mark lands.
    markOpacity.value = withTiming(1, { duration: duration.quick, easing: easing.enter });
    markScale.value = withSpring(1, spring.bouncy);

    // 2 — the wordmark wipes out from behind it, once the mark has settled.
    wordWidth.value = withDelay(260, withTiming(1, { duration: duration.splash, easing: easing.enter }));

    // 3 — tagline and rhythm.
    tail.value = withDelay(760, withTiming(1, { duration: duration.base, easing: easing.enter }));

    // Ambient: a slow glow so the screen is alive during the load rather than
    // frozen after the entrance. Decorative, so it does not run when reduced.
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: RNEasing.inOut(RNEasing.ease) }),
        withTiming(0, { duration: 1200, easing: RNEasing.inOut(RNEasing.ease) }),
      ),
      -1,
      false,
    );
  }, [reduced, markOpacity, markScale, wordWidth, tail, glow]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  // Animating maxWidth rather than opacity gives a wipe: the letters are
  // uncovered left to right instead of ghosting in.
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordWidth.value > 0 ? 1 : 0,
    maxWidth: `${wordWidth.value * 100}%`,
  }));
  const tailStyle = useAnimatedStyle(() => ({
    opacity: tail.value,
    transform: [{ translateY: (1 - tail.value) * 8 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + glow.value * 0.14,
    transform: [{ scale: 0.9 + glow.value * 0.28 }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: colors.accent }, glowStyle]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Animated.View style={markStyle}>
            <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 30 }}>Q</Text>
            </View>
          </Animated.View>
          <Animated.View style={[{ overflow: 'hidden' }, wordStyle]}>
            <Text numberOfLines={1} style={{ color: '#fff', fontFamily: font.extra, fontSize: 40, letterSpacing: -1.4 }}>Lyne</Text>
          </Animated.View>
        </View>
      </View>

      <Animated.Text style={[{ color: 'rgba(255,255,255,.55)', fontFamily: font.semibold, fontSize: 13.5 }, tailStyle]}>
        Skip the line, not your day.
      </Animated.Text>

      <Animated.View style={[{ flexDirection: 'row', gap: 7, marginTop: 6 }, tailStyle]}>
        <Dot delay={0} reduced={reduced} />
        <Dot delay={160} reduced={reduced} />
        <Dot delay={320} reduced={reduced} />
      </Animated.View>
    </View>
  );
}
