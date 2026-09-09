/**
 * OrbitField — a small system, quietly turning.
 *
 * Following Cosmos's offline illustration: a central sphere with smaller
 * satellites on elliptical orbits, looping slowly enough to read as gravity
 * rather than as a spinner. The point is the tone. Losing your connection is a
 * small failure the app cannot fix, and the honest response is to be calm about
 * it — not to throw up a red triangle, and not to imply the user did something
 * wrong.
 *
 * It is deliberately NOT a loading indicator, and it should not become one.
 * A continuous orbit says "this is a state you are in", where a spinner says
 * "wait, this will finish". Most loads in this app resolve in well under a
 * second, so a loop like this would flash and vanish — reading as a glitch and
 * training people to distrust it when it appears for something real.
 *
 * One shared clock drives every satellite. Three separate loops would drift
 * apart on a busy frame and the system would stop looking like a system.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import Animated, {
  type SharedValue,
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '../lib/theme';
import { useReducedMotion } from '../lib/motion';

/** One full revolution of the slowest body. Long — this is ambience. */
const PERIOD_MS = 14000;

type Satellite = {
  /** Orbit radii. Different x and y is what tilts the ring into perspective. */
  rx: number;
  ry: number;
  /** Revolutions per period. Inner bodies move faster, as they do. */
  speed: number;
  /** Where it starts, so they are not all in a line at t=0. */
  phase: number;
  size: number;
};

const BODIES: Satellite[] = [
  { rx: 0.46, ry: 0.17, speed: 1, phase: 0, size: 7 },
  { rx: 0.34, ry: 0.30, speed: -1.45, phase: 2.2, size: 5 },
  { rx: 0.50, ry: 0.40, speed: 0.72, phase: 4.1, size: 4 },
];

export function OrbitField({ size = 132, tone = 'dark' }: { size?: number; tone?: 'light' | 'dark' }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(
      withTiming(1, { duration: PERIOD_MS, easing: REasing.linear }),
      -1,
    );
  }, [reduced, t]);

  const dark = tone === 'dark';
  const body = dark ? '#ffffff' : colors.ink;
  const ring = dark ? 'rgba(255,255,255,.14)' : 'rgba(12,24,38,.12)';
  const core = size * 0.22;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* The orbits themselves, faint. Without them the dots read as scattered
          specks; with them the whole thing reads as one system. */}
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {BODIES.map((b, i) => (
          <Ellipse
            key={i}
            cx={size / 2}
            cy={size / 2}
            rx={b.rx * size}
            ry={b.ry * size}
            stroke={ring}
            strokeWidth={1}
            fill="none"
          />
        ))}
      </Svg>

      <View
        style={{
          width: core, height: core, borderRadius: core / 2,
          backgroundColor: body,
          // A touch of lift so the core sits in front of its own orbits.
          shadowColor: '#000', shadowOpacity: dark ? 0.5 : 0.18,
          shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
        }}
      />

      {BODIES.map((b, i) => (
        <Body key={i} spec={b} t={t} field={size} color={body} />
      ))}
    </View>
  );
}

function Body({
  spec, t, field, color,
}: { spec: Satellite; t: SharedValue<number>; field: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const angle = (t.value * spec.speed + spec.phase / (Math.PI * 2)) * Math.PI * 2;
    /* sin(angle) is also the depth cue: a body at the far side of its orbit is
       behind the core, so it dims and shrinks. That one line is the difference
       between three dots on a flat ring and something with a front and a back. */
    const depth = Math.sin(angle);
    return {
      opacity: 0.45 + 0.55 * ((depth + 1) / 2),
      transform: [
        { translateX: Math.cos(angle) * spec.rx * field },
        { translateY: depth * spec.ry * field },
        { scale: 0.78 + 0.22 * ((depth + 1) / 2) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default OrbitField;
