/**
 * Appear — the app's one entrance animation.
 *
 * Content used to pop into place the instant a query resolved, which reads as a
 * flicker rather than an arrival and makes a fast app feel unfinished. This
 * fades and lifts, and staggers when given an index, so a list assembles itself
 * in the order you'd read it.
 *
 * It animates ONCE on mount. Re-running an entrance on every re-render (a
 * refetch, a filter change) would make the list twitch every 20 seconds, which
 * is worse than no animation at all.
 *
 * Reduce Motion renders children immediately with no wrapper animation — the
 * content is the point, the movement is not.
 */
import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { duration, easing, staggerDelay, useReducedMotion } from '../lib/motion';

interface Props {
  children: React.ReactNode;
  /** Position in a list — drives the stagger. Omit for a single element. */
  index?: number;
  /** How far it travels up, in points. Keep it small; this is a lift, not a slide. */
  distance?: number;
  style?: ViewStyle;
}

export default function Appear({ children, index = 0, distance = 12, style }: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      staggerDelay(index),
      withTiming(1, { duration: duration.base, easing: easing.enter }),
    );
    // Deliberately mount-only: `index` and `distance` are layout inputs, not
    // triggers. Including them would replay the entrance whenever a list
    // reorders, which happens on every 20-second refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
