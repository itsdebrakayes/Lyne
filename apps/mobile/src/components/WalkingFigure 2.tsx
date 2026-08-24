/**
 * WalkingFigure — a person with an actual walk cycle.
 *
 * What this replaces: Walkers drew the `walk` icon (a circle on a stick) and slid
 * it across; QueueScene drew a circle on a rounded rectangle. Neither had limbs
 * that moved, so neither read as walking — they read as shapes being translated,
 * which is what they were.
 *
 * WHY THIS IS VIEWS AND NOT SVG. The first two attempts drew the figure as one
 * <Svg> and animated the limb <G> elements with Reanimated's useAnimatedProps —
 * first with a React Native `transform: [{ rotate }]` array, then with the
 * `rotation` prop react-native-svg documents. NEITHER APPLIED. Inspecting the
 * rendered output showed the groups carrying `transform-origin` and no rotation
 * whatsoever: animated props do not reach react-native-svg reliably, so the legs
 * never split and the figure stayed a stick man however carefully the maths was
 * written. Two rounds of "it should work" beat by one round of looking at it.
 *
 * Plain Views with plain transforms animate on native and on web, which is the
 * whole requirement. Limbs pivot from their TOP using translate-rotate-translate
 * rather than `transformOrigin`, so this does not depend on a recent RN either.
 *
 * Four moving joints is the minimum that reads as gait, and the cue the eye uses
 * is the COUNTER-SWING — right arm forward with the left leg — not anatomy.
 *
 * THE CEILING IS STILL REAL: a pictogram in motion, not the Parcel character.
 * That needs commissioned Rive artwork. See docs/SPLASH_AND_LOADING_DESIGN.md §4a.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Everything is expressed against a 40-unit-tall figure and scaled by `size`. */
const BASE = 40;

function Limb({
  swing,
  amplitude,
  length,
  thickness,
  tint,
  left,
  top,
  opacity = 1,
  staticAngle,
}: {
  swing: SharedValue<number>;
  amplitude: number;
  length: number;
  thickness: number;
  tint: string;
  left: number;
  top: number;
  opacity?: number;
  staticAngle?: number;
}) {
  const style = useAnimatedStyle(() => {
    // swing runs 0..1 and reverses, so remap to -1..1 for a symmetric stride.
    const angle = staticAngle !== undefined ? staticAngle : (swing.value * 2 - 1) * amplitude;
    return {
      transform: [
        // Pivot about the TOP of the limb: shift down half its length, rotate,
        // shift back. Equivalent to transformOrigin:'top center', but portable.
        { translateY: length / 2 },
        { rotate: `${angle}deg` },
        { translateY: -length / 2 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: thickness,
          height: length,
          borderRadius: thickness / 2,
          backgroundColor: tint,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function WalkingFigure({
  size = 40,
  tint = '#12203A',
  /** Milliseconds per full stride. Lower is faster. */
  cycleMs = 900,
  /** 0..1 — where in the stride this figure starts, so a crowd is not in lockstep. */
  phase = 0,
  /** Standing rather than walking. */
  still = false,
  /** A standing figure can look down at a watch instead of straight ahead. */
  checkingWatch = false,
}: {
  size?: number;
  tint?: string;
  cycleMs?: number;
  phase?: number;
  still?: boolean;
  checkingWatch?: boolean;
}) {
  const swing = useSharedValue(phase);
  const k = size / BASE;

  useEffect(() => {
    if (still) {
      swing.value = 0.5; // mid-stride = legs together, a natural standing pose
      return;
    }
    swing.value = phase;
    swing.value = withRepeat(
      withTiming(1, { duration: cycleMs / 2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true, // reverse — this IS the back-and-forth of a stride
    );
  }, [cycleMs, phase, still, swing]);

  const legLen = 15 * k;
  const armLen = 10 * k;

  // Standing figures get a slight fixed stance so they are not perfectly rigid.
  const stand = still ? (checkingWatch ? 5 : 3) : undefined;

  return (
    <View style={{ width: 24 * k, height: size }}>
      {/* legs — behind the torso */}
      <Limb
        swing={swing} amplitude={-26} length={legLen} thickness={3.2 * k} tint={tint}
        left={8.8 * k} top={23 * k} opacity={0.8}
        staticAngle={stand !== undefined ? -stand : undefined}
      />
      <Limb
        swing={swing} amplitude={26} length={legLen} thickness={3.2 * k} tint={tint}
        left={12 * k} top={23 * k}
        staticAngle={stand !== undefined ? stand : undefined}
      />

      {/* arms — outside the torso silhouette, or they are invisible behind it */}
      <Limb
        swing={swing} amplitude={20} length={armLen} thickness={2.5 * k} tint={tint}
        left={6.2 * k} top={13.5 * k} opacity={0.72}
        staticAngle={stand !== undefined ? -stand / 2 : undefined}
      />
      <Limb
        swing={swing} amplitude={-20} length={armLen} thickness={2.5 * k} tint={tint}
        left={15.4 * k} top={13.5 * k}
        // Checking a watch raises the forearm across the body.
        staticAngle={stand !== undefined ? (checkingWatch ? -36 : stand / 2) : undefined}
      />

      {/* torso — shoulders wider than the waist is most of what separates
          "a person" from "a capsule" at this size */}
      <View
        style={{
          position: 'absolute',
          left: 7 * k,
          top: 10.4 * k,
          width: 10 * k,
          height: 13 * k,
          backgroundColor: tint,
          borderTopLeftRadius: 5 * k,
          borderTopRightRadius: 5 * k,
          borderBottomLeftRadius: 2.2 * k,
          borderBottomRightRadius: 2.2 * k,
        }}
      />

      {/* head — does NOT bob. Animating it alone detached it from the shoulders
          and read as a head bouncing on the body. */}
      <View
        style={{
          position: 'absolute',
          left: 12 * k - 4.1 * k + (still && checkingWatch ? 0.7 * k : 0),
          top: 2.3 * k,
          width: 8.2 * k,
          height: 8.2 * k,
          borderRadius: 4.1 * k,
          backgroundColor: tint,
        }}
      />
    </View>
  );
}

export default WalkingFigure;
