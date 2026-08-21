/**
 * WalkingFigure — a person with an actual walk cycle.
 *
 * What this replaces, twice over:
 *
 *   · Walkers.tsx drew the `walk` icon — a circle on a stick with two straight
 *     lines for legs, sliding across at a fixed speed. A stick man.
 *   · QueueScene drew a circle on a rounded rectangle. A blob.
 *
 * Neither had limbs that moved, so neither read as a person walking; they read
 * as a shape being translated, which is exactly what they were.
 *
 * This is built from parts that articulate: head, torso, two arms rotating
 * about a shoulder, two legs rotating about a hip, and a vertical bob. Four
 * moving joints is the minimum that reads as gait — the eye recognises walking
 * from the COUNTER-SWING (right arm forward with left leg) long before it
 * registers any anatomical detail.
 *
 * THE HONEST CEILING. This is a well-drawn pictogram in motion, not the Parcel
 * character. Getting to that means commissioned artwork — a rigged character in
 * Rive with real proportions, clothing and weight — because no arrangement of
 * SVG primitives becomes a person you would call illustrated. What this DOES
 * buy is a figure that is unmistakably a human being walking, on the free tier,
 * today, and it establishes the motion language the commissioned version would
 * inherit. See docs/SPLASH_AND_LOADING_DESIGN.md §4.
 */
import React, { useEffect } from 'react';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, G } from 'react-native-svg';

const AG = Animated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);

/** The figure is drawn in a 24x40 box and scaled by the caller. */
const W = 24;
const H = 40;

export function WalkingFigure({
  size = 40,
  tint = '#12203A',
  /** Seconds per full stride. Lower is faster. */
  cycleMs = 900,
  /** 0..1 — where in the stride this figure starts, so a crowd is not in lockstep. */
  phase = 0,
  /** Static pose for figures that are standing rather than walking. */
  still = false,
  /** Standing figures can look down at a watch instead of straight ahead. */
  checkingWatch = false,
}: {
  size?: number;
  tint?: string;
  cycleMs?: number;
  phase?: number;
  still?: boolean;
  checkingWatch?: boolean;
}) {
  const t = useSharedValue(phase);

  useEffect(() => {
    if (still) return;
    t.value = phase;
    t.value = withRepeat(
      withTiming(phase + 1, { duration: cycleMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [cycleMs, phase, still, t]);

  // One stride = two steps, so limbs complete a full sine over the cycle.
  const swing = useDerivedValue(() => Math.sin((t.value % 1) * Math.PI * 2));

  const legFront = useAnimatedProps(() => ({
    // Legs counter-swing; 26 degrees is a walk rather than a march.
    transform: [{ rotate: `${swing.value * 26}deg` }],
  }));
  const legBack = useAnimatedProps(() => ({
    transform: [{ rotate: `${-swing.value * 26}deg` }],
  }));
  // Arms oppose the leg on the same side. This is the cue the eye actually uses.
  const armFront = useAnimatedProps(() => ({
    transform: [{ rotate: `${-swing.value * 20}deg` }],
  }));
  const armBack = useAnimatedProps(() => ({
    transform: [{ rotate: `${swing.value * 20}deg` }],
  }));
  // The body rises on each mid-step — twice per stride, hence the doubled angle.
  const bob = useAnimatedProps(() => ({
    cy: 6.4 - Math.abs(Math.sin((t.value % 1) * Math.PI * 2)) * 0.8,
  }));

  const staticSwing = checkingWatch ? 4 : 0;

  return (
    <Svg width={size * (W / H)} height={size} viewBox={`0 0 ${W} ${H}`}>
      {/* Legs hang from the hips at x=10 and x=14, not both from the centre —
          drawn at the same x they overlapped into one thick stroke. */}
      <AG animatedProps={still ? undefined : legBack} origin="12, 23.5" opacity={0.8}>
        <Path
          d="M10.4 23 L10.4 37.5"
          stroke={tint}
          strokeWidth={3.2}
          strokeLinecap="round"
          transform={still ? 'rotate(-5 12 23.5)' : undefined}
        />
      </AG>
      <AG animatedProps={still ? undefined : legFront} origin="12, 23.5">
        <Path
          d="M13.6 23 L13.6 37.5"
          stroke={tint}
          strokeWidth={3.2}
          strokeLinecap="round"
          transform={still ? 'rotate(5 12 23.5)' : undefined}
        />
      </AG>

      {/* Arms hang OUTSIDE the torso silhouette. At the centreline they were
          drawn behind the body and were invisible, which is why the first
          attempt still read as a pin figure. */}
      <AG animatedProps={still ? undefined : armBack} origin="7.6, 13.5" opacity={0.72}>
        <Path
          d="M7.6 13.5 L6.6 23"
          stroke={tint}
          strokeWidth={2.5}
          strokeLinecap="round"
          transform={still ? `rotate(${-staticSwing} 7.6 13.5)` : undefined}
        />
      </AG>
      <AG animatedProps={still ? undefined : armFront} origin="16.4, 13.5">
        <Path
          d="M16.4 13.5 L17.4 23"
          stroke={tint}
          strokeWidth={2.5}
          strokeLinecap="round"
          transform={still ? `rotate(${staticSwing} 16.4 13.5)` : undefined}
        />
      </AG>

      {/* Torso — shoulders wider than waist. Drawn after the arms so the joint
          is tucked under the body rather than floating on top of it. */}
      <Path
        d="M12 10.6c2.9 0 4.3 1.7 4.6 4.2l.75 6.4c.16 1.35-.7 2.1-2 2.1h-6.7c-1.3 0-2.16-.75-2-2.1l.75-6.4c.3-2.5 1.7-4.2 4.6-4.2Z"
        fill={tint}
      />

      {/* Head — bobs with the gait, tucked close to the shoulders. */}
      {still ? (
        <Circle cx={12 + (checkingWatch ? 0.7 : 0)} cy={6.4} r={4.1} fill={tint} />
      ) : (
        <ACircle animatedProps={bob} cx={12.2} r={4.1} fill={tint} />
      )}
    </Svg>
  );
}

export default WalkingFigure;
