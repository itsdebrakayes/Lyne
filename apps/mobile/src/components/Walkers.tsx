/**
 * Walkers.tsx — figures crossing the ticket, at the pace of the line.
 *
 * Two changes, 2026-08-21.
 *
 * THEY ARE PEOPLE NOW. This drew the `walk` icon — a circle on a stick with two
 * straight lines for legs — translated across at a constant rate. Limbs that do
 * not move do not read as walking, so it read as a stick man sliding. It now
 * uses WalkingFigure, which articulates.
 *
 * THEY MOVE AT THE SPEED OF THE QUEUE. The pace was a fixed 5400ms regardless of
 * whether two people were waiting or two hundred. That is a missed opportunity:
 * this strip is the only ambient thing on the ticket, so it may as well carry
 * information. A busy line now visibly moves faster — you catch how busy it is
 * without reading a number, which is the point of ambient display.
 *
 * It stays decoration, so it yields: on Reduce Motion the figures are laid out
 * statically along the line instead of animating.
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { WalkingFigure } from './WalkingFigure';
import { colors } from '../lib/theme';

const COUNT = 3;
const FIGURE = 30;

/**
 * How long one figure takes to cross, given how many people are in the line.
 *
 * Deliberately NOT linear. Doubling from 40 to 80 waiting does not feel twice as
 * busy, and a linear mapping would either crawl on a quiet line or blur on a
 * busy one. A log curve keeps the whole usable range inside 3.2s–7s, which is
 * slow enough to read as ambient and fast enough to notice the difference.
 */
export function paceFor(waiting: number): { travelMs: number; cycleMs: number } {
  const n = Math.max(0, waiting);
  const busy = Math.min(1, Math.log10(n + 1) / Math.log10(61)); // 0 at empty, 1 at ~60
  const travelMs = 7000 - busy * 3800;          // 7.0s quiet → 3.2s busy
  const cycleMs = 1000 - busy * 380;            // stride shortens to match, or
  return { travelMs, cycleMs };                 // the legs skate instead of walk
}

function Walker({
  travel, index, reduced, travelMs, cycleMs,
}: {
  travel: number; index: number; reduced: boolean; travelMs: number; cycleMs: number;
}) {
  const x = useSharedValue(-FIGURE);
  const stagger = (travelMs / COUNT) * index;

  useEffect(() => {
    if (reduced || travel <= 0) return;
    x.value = -FIGURE;
    x.value = withDelay(
      // withRepeat has no negative-delay equivalent, so each figure simply
      // starts a third of a lap later.
      stagger,
      withRepeat(withTiming(travel, { duration: travelMs, easing: Easing.linear }), -1, false),
    );
  }, [travel, reduced, stagger, travelMs, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const opacity = 1 - index * 0.26;

  if (reduced) {
    return (
      <View style={{ position: 'absolute', bottom: 6, left: Math.max(0, (travel / (COUNT + 1)) * (index + 1)), opacity }}>
        <WalkingFigure size={FIGURE} tint={colors.ink} still />
      </View>
    );
  }

  return (
    <Animated.View style={[{ position: 'absolute', bottom: 6, left: 0, opacity }, style]}>
      {/* Each figure is a third of a stride out of step, so three people walking
          together do not look like one person copied three times. */}
      <WalkingFigure size={FIGURE} tint={colors.ink} cycleMs={cycleMs} phase={index / COUNT} />
    </Animated.View>
  );
}

export default function Walkers({
  height = 46,
  /** People waiting in this line. Drives the pace. */
  waiting = 0,
}: {
  height?: number;
  waiting?: number;
}) {
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(false);
  const { travelMs, cycleMs } = paceFor(waiting);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduced(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduced(v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ height, overflow: 'hidden', justifyContent: 'flex-end' }}
    >
      {/* The rail sits under the figures' feet, not their midpoint. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 4, borderTopWidth: 1.8, borderStyle: 'dashed', borderColor: '#D3D9E3' }} />
      {width > 0 && Array.from({ length: COUNT }, (_, i) => (
        <Walker
          key={i}
          index={i}
          travel={width + FIGURE}
          reduced={reduced}
          travelMs={travelMs}
          cycleMs={cycleMs}
        />
      ))}
    </View>
  );
}
