/**
 * Walkers.tsx — figures walking the dotted line on the ticket.
 *
 * A ticket is a static object; a queue is not. Three figures crossing the gap
 * between "your number" and the front of the line is the cheapest honest signal
 * that the thing is still moving, and it costs nothing to read — you catch it
 * without looking at it.
 *
 * It is decoration, so it yields: when the OS reports Reduce Motion the figures
 * are laid out statically along the line instead of animating.
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Icon from './Icon';
import { colors } from '../lib/theme';

const DURATION = 5400;
const COUNT = 3;

function Walker({ travel, index, reduced }: { travel: number; index: number; reduced: boolean }) {
  const x = useSharedValue(-26);
  const stagger = (DURATION / COUNT) * index;

  useEffect(() => {
    if (reduced || travel <= 0) return;
    x.value = -26;
    x.value = withDelay(
      // Negative offsets would be cleaner, but withRepeat has no negative-delay
      // equivalent, so each figure simply starts a third of a lap later.
      stagger,
      withRepeat(withTiming(travel, { duration: DURATION, easing: Easing.linear }), -1, false),
    );
  }, [travel, reduced, stagger, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (reduced) {
    return (
      <View style={{ position: 'absolute', top: 2, left: Math.max(0, (travel / (COUNT + 1)) * (index + 1)), opacity: 1 - index * 0.28 }}>
        <Icon name="walk" size={26} color={colors.ink} />
      </View>
    );
  }

  return (
    <Animated.View style={[{ position: 'absolute', top: 2, left: 0, opacity: 1 - index * 0.28 }, style]}>
      <Icon name="walk" size={26} color={colors.ink} />
    </Animated.View>
  );
}

export default function Walkers({ height = 46 }: { height?: number }) {
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduced(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduced(v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ height, overflow: 'hidden', justifyContent: 'center' }}
    >
      {/* The rail sits BELOW the figures' feet, not under their midpoint —
          at top: height-15 it was drawn behind them and read as missing. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: height - 8, borderTopWidth: 1.8, borderStyle: 'dashed', borderColor: '#D3D9E3' }} />
      {width > 0 && Array.from({ length: COUNT }, (_, i) => (
        <Walker key={i} index={i} travel={width + 26} reduced={reduced} />
      ))}
    </View>
  );
}
