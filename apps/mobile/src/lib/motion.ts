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
 */
export const spring = {
  /** Settles without overshoot. Safe default for layout. */
  gentle: { damping: 18, stiffness: 160, mass: 1 },
  /** A little overshoot. Good for confirmations. */
  snappy: { damping: 13, stiffness: 210, mass: 0.9 },
  /** Visible bounce. Brand moments only — it draws attention. */
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
