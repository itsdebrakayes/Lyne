import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * WalkingFigure — a rigged walk cycle, not swinging sticks.
 *
 * Two things make a walk read as human, and both were wrong in the usual
 * naive version:
 *
 * 1. WHERE LIMBS PIVOT. A leg rotates about the HIP — the top of the thigh is
 *    pinned to the body and the foot swings through an arc below it. Rotate the
 *    same bar about its middle instead (which is what every transform does by
 *    default, in CSS and React Native alike) and the hip end swings backward
 *    while the foot swings forward, so the limb looks like it detaches from the
 *    body and re-attaches each step. Fixed structurally: every segment sets
 *    `transformOrigin: '50% 0%'` (its top edge), and segments NEST — the shin
 *    lives inside the thigh, the forearm inside the upper arm — so a child
 *    inherits its parent's rotation and adds its own. That is forward
 *    kinematics, and it is the reason a knee can never wander away from the
 *    thigh it hangs off.
 *
 * 2. WHERE THE FOOT GOES. Swinging both joints on sine waves still looks like a
 *    marionette, because the foot floats and skates instead of taking the
 *    body's weight. So the foot's path is authored directly — planted on the
 *    ground and sliding backward under the body through stance, then lifting in
 *    an arc through swing — and the thigh and knee angles are SOLVED from it by
 *    two-bone inverse kinematics. The foot goes exactly where a walking foot
 *    goes; the joints follow.
 *
 * The angles are solved once at module load and sampled into interpolations, so
 * the whole cycle still runs on the native driver.
 */

// ── Rig proportions ───────────────────────────────────────────
const THIGH = 22;
const SHIN = 22;
const UPPER_ARM = 17;
const FOREARM = 16;

const HIP_Y = 52;
const SHOULDER_Y = 22;
const CENTRE_X = 23;
const LIMB_BOX = 10;    // joint boxes are wider than the bone so nothing
const BONE_W = 4;       // overflows its parent and gets clipped on Android

// ── Gait ──────────────────────────────────────────────────────
const STRIDE = 30;      // how far the foot travels, front to back
const FOOT_LIFT = 9;    // ground clearance at the top of the swing
const FOOT_DROP = 40;   // hip-to-planted-foot distance; under THIGH + SHIN so
                        // the knee keeps a natural bend and never locks straight
const BODY_BOB = 2;     // the body rises at each mid-stance

const STRIDE_MS = 780;  // one full cycle = two steps
const SAMPLES = 48;

export const FIGURE_WIDTH = 46;
export const FIGURE_HEIGHT = HIP_Y + THIGH + SHIN + 6;

const TAU = Math.PI * 2;
const PHASES = Array.from({ length: SAMPLES + 1 }, (_, index) => index / SAMPLES);

/** How far the body has risen off its lowest point, at phase `t`. */
function bodyLift(t: number) {
  return BODY_BOB * Math.sin(TAU * t) ** 2;
}

/**
 * Where the foot should be at phase `t`, measured from the hip.
 * Forward is +x, down is +y. The first half of the cycle is stance (planted,
 * travelling backward under the body); the second half is swing.
 *
 * The body's rise is added to the drop so a planted foot stays planted while
 * the hips lift over it — otherwise the foot would slide up and down.
 */
function footTarget(t: number): [number, number] {
  const p = ((t % 1) + 1) % 1;
  const drop = FOOT_DROP + bodyLift(t);
  if (p < 0.5) {
    const u = p / 0.5;
    return [STRIDE / 2 - STRIDE * u, drop];
  }
  const u = (p - 0.5) / 0.5;
  // sin² lifts and lands with zero vertical speed, which keeps toe-off and
  // heel-strike from snapping.
  return [-STRIDE / 2 + STRIDE * u, drop - FOOT_LIFT * Math.sin(Math.PI * u) ** 2];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Two-bone inverse kinematics. Given a foot target relative to the hip, return
 * the thigh rotation and the knee bend, in the clockwise degrees that React
 * Native's `rotate` expects. The knee solution is always chosen so it leads
 * forward — a knee bends one way only.
 */
function solveLeg(targetX: number, targetY: number): [number, number] {
  const reach = clamp(Math.hypot(targetX, targetY), Math.abs(THIGH - SHIN) + 0.01, THIGH + SHIN - 0.01);
  const toTarget = Math.atan2(-targetX, targetY);
  const atHip = Math.acos(clamp((THIGH * THIGH + reach * reach - SHIN * SHIN) / (2 * THIGH * reach), -1, 1));
  const atKnee = Math.acos(clamp((THIGH * THIGH + SHIN * SHIN - reach * reach) / (2 * THIGH * SHIN), -1, 1));
  return [degrees(toTarget - atHip), degrees(Math.PI - atKnee)];
}

function degrees(radians: number) {
  return (radians * 180) / Math.PI;
}

// Arms swing freely, so they need no IK — only the same pivot discipline.
// The shoulder counter-swings against the leg on the same side, and the elbow
// bends forward (the opposite direction to a knee).
function shoulderAngle(t: number) {
  // Positive swings the hand backward, so at t=0 — near leg forward — the arm
  // on that side is back.
  return 20 * Math.cos(TAU * t);
}

function elbowAngle(t: number) {
  // The elbow closes most as the arm reaches forward, at t = 0.5.
  const forwardSwing = Math.max(0, -Math.cos(TAU * t));
  return -(14 + 24 * forwardSwing ** 2);
}

/** Sample an angle function across the cycle into a native-driver interpolation. */
function sampleDegrees(offset: number, degreesAt: (t: number) => number) {
  return PHASES.map((t) => `${degreesAt(t + offset).toFixed(2)}deg`);
}

function sampleLeg(offset: number) {
  const thigh: string[] = [];
  const knee: string[] = [];
  PHASES.forEach((t) => {
    const [angleThigh, angleKnee] = solveLeg(...footTarget(t + offset));
    thigh.push(`${angleThigh.toFixed(2)}deg`);
    knee.push(`${angleKnee.toFixed(2)}deg`);
  });
  return { thigh, knee };
}

// Solved once, reused by every mount.
const LEG_NEAR = sampleLeg(0);
const LEG_FAR = sampleLeg(0.5);
const ARM_NEAR = { shoulder: sampleDegrees(0, shoulderAngle), elbow: sampleDegrees(0, elbowAngle) };
const ARM_FAR = { shoulder: sampleDegrees(0.5, shoulderAngle), elbow: sampleDegrees(0.5, elbowAngle) };
const BODY_BOB_OUTPUT = PHASES.map((t) => -bodyLift(t));

type Tone = { limb: string; far: string };

function bone(length: number, color: string) {
  return {
    position: 'absolute' as const,
    top: 0,
    left: (LIMB_BOX - BONE_W) / 2,
    width: BONE_W,
    height: length,
    borderRadius: BONE_W / 2,
    backgroundColor: color,
  };
}

function joint(top: number, height: number) {
  return {
    position: 'absolute' as const,
    left: CENTRE_X - LIMB_BOX / 2,
    top,
    width: LIMB_BOX,
    height,
    // The joint is the fixed point: the top edge, not the centre.
    transformOrigin: '50% 0%' as const,
  };
}

function childJoint(top: number, height: number) {
  return {
    position: 'absolute' as const,
    left: 0,
    top,
    width: LIMB_BOX,
    height,
    transformOrigin: '50% 0%' as const,
  };
}

function Leg({ phase, angles, color }: { phase: Animated.Value; angles: { thigh: string[]; knee: string[] }; color: string }) {
  const thigh = useMemo(() => phase.interpolate({ inputRange: PHASES, outputRange: angles.thigh }), [phase, angles]);
  const knee = useMemo(() => phase.interpolate({ inputRange: PHASES, outputRange: angles.knee }), [phase, angles]);

  return (
    <Animated.View style={[joint(HIP_Y, THIGH + SHIN), { transform: [{ rotate: thigh }] }]}>
      <View style={bone(THIGH, color)} />
      <Animated.View style={[childJoint(THIGH, SHIN), { transform: [{ rotate: knee }] }]}>
        <View style={bone(SHIN, color)} />
        <View style={{ position: 'absolute', top: SHIN - 3, left: 1, width: 8, height: 3.5, borderRadius: 2, backgroundColor: color }} />
      </Animated.View>
    </Animated.View>
  );
}

function Arm({ phase, angles, color }: { phase: Animated.Value; angles: { shoulder: string[]; elbow: string[] }; color: string }) {
  const shoulder = useMemo(() => phase.interpolate({ inputRange: PHASES, outputRange: angles.shoulder }), [phase, angles]);
  const elbow = useMemo(() => phase.interpolate({ inputRange: PHASES, outputRange: angles.elbow }), [phase, angles]);

  return (
    <Animated.View style={[joint(SHOULDER_Y, UPPER_ARM + FOREARM), { transform: [{ rotate: shoulder }] }]}>
      <View style={bone(UPPER_ARM, color)} />
      <Animated.View style={[childJoint(UPPER_ARM, FOREARM), { transform: [{ rotate: elbow }] }]}>
        <View style={bone(FOREARM, color)} />
      </Animated.View>
    </Animated.View>
  );
}

export default function WalkingFigure({ tone, running = true }: { tone: Tone; running?: boolean }) {
  const phase = useRef(new Animated.Value(0)).current;
  const bob = useMemo(
    () => phase.interpolate({ inputRange: PHASES, outputRange: BODY_BOB_OUTPUT }),
    [phase]
  );

  useEffect(() => {
    if (!running) return undefined;
    const loop = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: STRIDE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      phase.setValue(0);
    };
  }, [phase, running]);

  return (
    <Animated.View style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT, transform: [{ translateY: bob }] }}>
      {/* Far side first and dimmed, so the body reads with depth. */}
      <Leg phase={phase} angles={LEG_FAR} color={tone.far} />
      <Arm phase={phase} angles={ARM_FAR} color={tone.far} />

      <View style={{ position: 'absolute', top: 0, left: CENTRE_X - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: tone.limb }} />
      <View style={{ position: 'absolute', top: 15, left: CENTRE_X - BONE_W / 2, width: BONE_W, height: HIP_Y - 15, borderRadius: BONE_W / 2, backgroundColor: tone.limb }} />

      {/* Near side, full strength, in front of the torso. */}
      <Leg phase={phase} angles={LEG_NEAR} color={tone.limb} />
      <Arm phase={phase} angles={ARM_NEAR} color={tone.limb} />
    </Animated.View>
  );
}
