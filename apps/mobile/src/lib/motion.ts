/**
 * motion.ts — the app's motion system.
 *
 * Animation was previously ad-hoc: every screen picked its own duration and
 * curve, so nothing felt like it belonged to the same product. These are the
 * only durations and curves anything should use.
 *
 * The rules behind the numbers:
 *
 *  • Things that respond to a touch must land inside ~180ms, or the interface
 *    feels like it is lagging behind the finger rather than obeying it.
 *  • Things that ENTER are slower than things that LEAVE. An element arriving
 *    should be readable; an element leaving is already irrelevant, and making
 *    the user watch it go is the commonest way an app feels slow.
 *  • Anything looping is decoration and must yield to Reduce Motion.
 *
 * Everything here is a plain value, so it works with both Reanimated and RN's
 * own Animated — the app currently uses both, and there is no reason to force
 * a rewrite of the parts that already work.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Easing } from 'react-native-reanimated';

export const duration = {
  /** State flips that must feel instantaneous — selection, toggles. */
  instant: 120,
  /** Direct response to a touch: press states, chips, small reveals. */
  quick: 180,
  /** The default. Cards appearing, sheets settling, content swapping. */
  base: 260,
  /** Deliberate, noticed movement: full-screen transitions, hero changes. */
  slow: 420,
  /** Brand moments. The splash only. */
  splash: 620,
} as const;

export const easing = {
  /** Decelerate — for anything arriving. The workhorse. */
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  /** Accelerate — for anything leaving. Gets out of the way. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** Symmetric — for things that move without arriving or leaving. */
  move: Easing.bezier(0.4, 0, 0.2, 1),
  /** Linear — only for continuous loops, where a curve would read as a stutter. */
  loop: Easing.linear,
} as const;

/**
 * Springs, for anything that should feel physical rather than timed —
 * a joined queue, a confirmed action, the splash mark landing.
 *
 * Apple stopped designing springs with mass/stiffness/damping because nobody
 * can picture what those three numbers will do together. They use two:
 *
 *   damping ratio  z = damping / (2 * sqrt(stiffness * mass))
 *       1.0 is critically damped — reaches the target and stops dead.
 *       Below 1.0 it overshoots, by e^(-pi*z / sqrt(1 - z^2)).
 *   response       T = 2*pi * sqrt(mass / stiffness)
 *       Roughly how long it takes to arrive. This is NOT a duration: a spring
 *       has no fixed duration, the settle time falls out of the numbers.
 *
 * Both are written out for each spring below, because the three raw numbers
 * hide whether a spring actually does what its name promises — and two of
 * these did not. `gentle` was damping: 18, which is z = 0.71 and a 4.2%
 * overshoot, sitting directly under a comment that said it "settles without
 * overshoot". `snappy` was z = 0.47, an 18.5% overshoot described as "a
 * little". The names were right; the constants were wrong.
 */
export const spring = {
  /**
   * z = 1.00, response 0.50s. Critically damped — arrives and stops, no
   * bounce at any velocity. The safe default for layout, and the same shape
   * Apple ships for repositioning something the user did not throw.
   */
  gentle: { damping: 25.3, stiffness: 160, mass: 1 },
  /**
   * z = 0.80, response 0.41s. ~1.5% overshoot: enough to read as alive,
   * not enough to read as bounce. This is Apple's shipped value for drawers
   * and rotation. Use it for confirmations and for anything a gesture threw.
   */
  snappy: { damping: 22, stiffness: 210, mass: 0.9 },
  /**
   * z = 0.42, response 0.53s. ~23% overshoot — well outside Apple's range,
   * deliberately. Brand moments only (the splash mark landing): it draws
   * attention, which is the whole point of it and also why it must not spread
   * to anything the user touches more than once.
   */
  bouncy: { damping: 10, stiffness: 140, mass: 1 },
} as const;

/** Gap between items in a staggered list entrance. */
export const STAGGER_MS = 45;

/**
 * Cap the stagger so a long list's last row doesn't wait a second and a half
 * to appear. Past ~8 items nobody reads the sequence as a sequence anyway.
 */
export function staggerDelay(index: number, max = 8) {
  return Math.min(index, max) * STAGGER_MS;
}

/**
 * Whether the OS has Reduce Motion on. Decorative and looping animation must
 * check this; functional movement (a sheet sliding up) may stay, because
 * removing it entirely can make an interface harder to follow, not easier.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (alive) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

/**
 * Whether the OS has Reduce Transparency on (iOS; Android resolves false).
 *
 * This is a different setting from Reduce Motion, turned on for a different
 * reason, and the app was honouring only the first one. Someone who cannot
 * read text over a blurred background turns THIS on — and every glass surface
 * in the app ignored them. Components using GlassView should fall back to an
 * opaque fill when it is set.
 */
export function useReducedTransparency() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    const api = AccessibilityInfo as unknown as {
      isReduceTransparencyEnabled?: () => Promise<boolean>;
    };
    api.isReduceTransparencyEnabled?.()
      .then(v => { if (alive) setReduced(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

/* ── Gesture physics ─────────────────────────────────────────
   The two functions a dragged surface needs to feel like an object rather
   than a slider. Both are Apple's, from the Designing Fluid Interfaces
   sample code, not approximations of them.
   ──────────────────────────────────────────────────────────── */

/**
 * Where a flick would come to rest if you let it decelerate.
 *
 * The point of this is that a released gesture should animate to where it was
 * GOING, not to whatever happened to be nearest when the finger left the
 * glass. Snapping from the release point is what makes a flick feel like it
 * was ignored: you threw the sheet and it went back.
 *
 * Note this is exponential decay, not the v^2/(2a) from a physics textbook.
 * The textbook version is the one everybody reaches for and it is not what
 * iOS does — it decelerates too fast and short flicks under-travel.
 *
 * @param velocity px/s at the moment of release
 * @param decelerationRate 0.998 matches normal scroll; 0.99 is snappier
 */
export function projectDecay(velocity: number, decelerationRate = 0.998) {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/**
 * Rubber-banding: how far a surface should actually move when dragged past a
 * boundary it cannot pass.
 *
 * A hard stop reads as frozen — the user's first thought is that the app has
 * hung. Continuous resistance reads as "still responding, but there is
 * nothing more this way", which is the truth. The further past the edge, the
 * less of each pixel of finger travel the surface follows.
 *
 * @param overshoot how far past the boundary the finger has gone
 * @param dimension the size of the surface, which sets how much give there is
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  if (!dimension) return overshoot;
  const sign = overshoot < 0 ? -1 : 1;
  const distance = Math.abs(overshoot);
  return sign * ((distance * dimension * constant) / (dimension + constant * distance));
}
