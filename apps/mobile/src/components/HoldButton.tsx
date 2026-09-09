/**
 * HoldButton — a button you have to mean.
 *
 * Joining a line and leaving one are the two actions in this app that cost the
 * user something real: a place in a queue they may have travelled for. A tap
 * cannot tell the difference between intent and a thumb brushing the screen,
 * so both were guarded by asking again in a modal — which works, and which
 * everybody dismisses without reading.
 *
 * Holding is a better guard than asking. It cannot happen by accident, it needs
 * no second screen, and the progress fill tells you mid-gesture that something
 * irreversible is underway and that letting go stops it. You can change your
 * mind during the action rather than before it.
 *
 * The motion follows Opal's hold-to-commit, with two departures Debra asked for
 * after seeing it run:
 *
 *  • The fill behaves like liquid rather than a bar. Its leading edge is a sine
 *    wave whose phase runs on a loop, so the surface moves while the level
 *    rises — the difference between filling a glass and a progress bar. It is a
 *    single SVG path, not a stack of views, because the edge has to be a curve.
 *  • Completion throws sparks. The tick alone marks the end of a gesture; the
 *    burst marks that something GOOD happened, which is the whole difference
 *    between confirming a form and being told you have a place in the line.
 *
 * Two things are deliberately not decorative:
 *
 *  • The fill still runs under Reduce Motion. It is the only thing telling you
 *    how long to hold, so removing it would leave a button that does nothing
 *    for a second for no visible reason. Reduce Motion flattens the wave, stops
 *    the sparks and drops the overshoot — the parts that are flourish.
 *  • With a screen reader on, the hold is dropped entirely and the control
 *    becomes an ordinary button. Press-and-hold fights VoiceOver's own gesture
 *    set, and an accessibility affordance that makes a destructive action
 *    HARDER to perform correctly is not an accessibility affordance.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  type SharedValue,
  cancelAnimation,
  Easing as REasing,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, font } from '../lib/theme';
import { duration, easing, spring, useReducedMotion } from '../lib/motion';
import { haptics } from '../lib/haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How long the finger stays down. Long enough to be deliberate, short enough
 *  not to feel like a punishment — Opal's own is around a second. */
const HOLD_MS = 1100;
/** Letting go snaps back faster than it filled. Undo should never feel slow. */
const RELEASE_MS = 220;
/** Under this, a press was a tap and not an abandoned hold. */
const TAP_MS = 240;
/** Height of the liquid's surface, in points. Past about 6 it stops reading as
 *  water and starts reading as a zigzag. */
const WAVE_AMP = 4.5;
/** Points sampled down the wave. Ten is smooth at button heights; more is
 *  string-building on the UI thread every frame for nothing. */
const WAVE_STEPS = 10;
const SPARKS = 11;

export type HoldButtonProps = {
  /** Resting label, e.g. "Hold to join the line". Say that it is a hold. */
  label: string;
  /** Shown while the finger is down. */
  holdingLabel?: string;
  /** Shown once the hold completes, beside the tick. */
  doneLabel: string;
  onComplete: () => void;
  /**
   * Fired on a short press, when one is meaningful.
   *
   * Lets a control teach its own gesture: on the ticket screen, tapping Leave
   * opens the sheet that explains what you give up, and holding the same button
   * skips straight to leaving. You learn the hold from the sheet you opened,
   * then stop needing the sheet.
   */
  onPress?: () => void;
  /** 'accent' for joining, 'danger' for leaving. */
  tone?: 'accent' | 'danger';
  /** 'solid' fills the pill; 'ghost' is an outline that fills as you hold. */
  variant?: 'solid' | 'ghost';
  disabled?: boolean;
  /** Parent's async work is in flight — shows a spinner in the done state. */
  busy?: boolean;
  /** Change this to send a completed button back to rest, e.g. after a failed
   *  request. Without it a network error would leave a tick on screen next to
   *  an error message saying the opposite. */
  resetSignal?: number;
  style?: StyleProp<ViewStyle>;
  hint?: string;
  children?: React.ReactNode;
};

export function HoldButton({
  label,
  holdingLabel = 'Keep holding…',
  doneLabel,
  onComplete,
  onPress,
  tone = 'accent',
  variant = 'solid',
  disabled,
  busy,
  resetSignal = 0,
  style,
  hint,
  children,
}: HoldButtonProps) {
  const reduced = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  const progress = useSharedValue(0);
  const phase = useSharedValue(0);
  const doneIn = useSharedValue(0);
  const burst = useSharedValue(0);
  /* Completion is a one-way door. Without this guard a timing callback that
     resolves while the finger is lifting can fire onComplete a second time —
     and onComplete here leaves a queue. */
  const fired = useRef(false);
  const pressedAt = useRef(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then(on => { if (alive) setScreenReader(on); });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { alive = false; sub.remove(); };
  }, []);

  // Back to rest when the parent says the action did not stick.
  useEffect(() => {
    if (!resetSignal) return;
    fired.current = false;
    cancelAnimation(progress);
    cancelAnimation(phase);
    progress.value = 0;
    doneIn.value = 0;
    burst.value = 0;
    setDone(false);
    setHolding(false);
  }, [resetSignal, progress, phase, doneIn, burst]);

  const finish = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    cancelAnimation(phase);
    setHolding(false);
    setDone(true);
    haptics.success();
    doneIn.value = reduced
      ? withTiming(1, { duration: duration.quick, easing: easing.enter })
      : withSpring(1, spring.bouncy);
    if (!reduced) burst.value = withTiming(1, { duration: 620, easing: easing.exit });
    onComplete();
  }, [onComplete, doneIn, burst, phase, reduced]);

  const start = () => {
    if (disabled || done) return;
    pressedAt.current = Date.now();
    haptics.press();
    setHolding(true);
    /* The surface only moves while the level is rising. A wave still rolling
       on a button nobody is touching is an idle animation, and this component
       has no business being the busiest thing on the screen. */
    if (!reduced) {
      phase.value = 0;
      phase.value = withRepeat(
        withTiming(Math.PI * 2, { duration: 1300, easing: REasing.linear }),
        -1,
      );
    }
    progress.value = withTiming(
      1,
      { duration: HOLD_MS, easing: easing.move },
      (completed) => { if (completed) runOnJS(finish)(); },
    );
  };

  const stop = () => {
    if (fired.current) return;
    const held = Date.now() - pressedAt.current;
    setHolding(false);
    cancelAnimation(progress);
    cancelAnimation(phase);
    progress.value = withTiming(0, { duration: RELEASE_MS, easing: easing.exit });
    // A quick press was a tap, not a hold somebody gave up on.
    if (onPress && held < TAP_MS) onPress();
  };

  /* The liquid.
   *
   * One path: down the wavy leading edge, back along the left. Built in a
   * worklet so the string is assembled on the UI thread — handing a new `d`
   * across the bridge sixty times a second is the one way to make this stutter.
   */
  const waveProps = useAnimatedProps(() => {
    const { w, h } = { w: size.w, h: size.h };
    const x = progress.value * w;
    // Flat at both ends: liquid at rest, and a full button should read as full
    // rather than as a wave clipped by the edge.
    const settle = interpolate(progress.value, [0, 0.06, 0.92, 1], [0, 1, 1, 0]);
    const amp = reduced ? 0 : WAVE_AMP * settle;
    let d = 'M0,0';
    for (let i = 0; i <= WAVE_STEPS; i += 1) {
      const y = (i / WAVE_STEPS) * h;
      const dx = amp * Math.sin((i / WAVE_STEPS) * Math.PI * 2 + phase.value);
      d += ` L${x + dx},${y}`;
    }
    d += ` L0,${h} Z`;
    return { d };
  }, [size.w, size.h, reduced]);

  const doneStyle = useAnimatedStyle(() => ({
    opacity: doneIn.value,
    transform: [{ scale: 0.96 + doneIn.value * 0.04 }],
  }));

  const ground = tone === 'danger' ? colors.danger : colors.accent;
  const ghost = variant === 'ghost';

  /* Angles fixed once. Recomputing them per render would make each frame a
     different starburst, which reads as static rather than as sparks. */
  const sparks = useMemo(
    () => Array.from({ length: SPARKS }, (_, i) => {
      const angle = (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.34;
      return { angle, distance: 24 + (i % 4) * 7, size: i % 3 === 0 ? 5 : 3.5 };
    }),
    [],
  );

  const pill = (
    <View
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[
        {
          minHeight: 54,
          borderRadius: 18,
          backgroundColor: ghost ? 'transparent' : ground,
          borderWidth: ghost ? 1.5 : 0,
          borderColor: ghost ? 'rgba(255,255,255,.22)' : undefined,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {size.w > 0 && !done && (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="holdWave" x1="0" y1="0" x2="1" y2="0">
              {/* Brighter at the crest: the leading edge should catch the light
                  the way the surface of a liquid does, not sit flat. */}
              <Stop offset="0" stopColor={ghost ? ground : '#ffffff'} stopOpacity={ghost ? 0.28 : 0.1} />
              <Stop offset="1" stopColor={ghost ? ground : '#ffffff'} stopOpacity={ghost ? 0.85 : 0.42} />
            </LinearGradient>
          </Defs>
          <AnimatedPath animatedProps={waveProps} fill="url(#holdWave)" />
        </Svg>
      )}

      {children || (
        <Text
          numberOfLines={1}
          style={{
            fontFamily: font.extra,
            fontSize: 15,
            color: ghost ? ground : colors.accentInk,
            letterSpacing: -0.2,
          }}
        >
          {holding ? holdingLabel : label}
        </Text>
      )}

      {/* The morph: a high-contrast pill laid over the top once the hold lands,
          so the colour change and the tick arrive together rather than the
          label swapping underneath a ground that is still moving. */}
      {done && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0, right: 0, top: 0, bottom: 0,
              backgroundColor: ghost ? ground : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            },
            doneStyle,
          ]}
        >
          {busy
            ? <ActivityIndicator color={ghost ? '#fff' : ground} />
            : <Ionicons name="checkmark-circle" size={19} color={ghost ? '#fff' : ground} />}
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: ghost ? '#fff' : colors.ink, letterSpacing: -0.2 }}>
            {doneLabel}
          </Text>
        </Animated.View>
      )}
    </View>
  );

  /* Sparks sit OUTSIDE the pill. The pill clips its contents so the liquid
     cannot spill past the rounded corners, and a burst that respects the same
     clip is a burst nobody sees. */
  const framed = (
    <View>
      {pill}
      {done && !reduced && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {sparks.map((s, i) => <Spark key={i} {...s} burst={burst} />)}
        </View>
      )}
    </View>
  );

  // Screen reader on: an ordinary button. See the header comment.
  if (screenReader) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label.replace(/^Hold to /i, '')}
        accessibilityHint={hint}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || done}
        onPress={finish}
      >
        {framed}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint || 'Press and hold to confirm'}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || done}
      onPressIn={start}
      onPressOut={stop}
      delayLongPress={HOLD_MS}
    >
      {framed}
    </Pressable>
  );
}

/** One spark: out, up in scale, then gone. */
function Spark({
  angle, distance, size, burst,
}: { angle: number; distance: number; size: number; burst: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const travel = interpolate(burst.value, [0, 1], [0, distance]);
    return {
      opacity: interpolate(burst.value, [0, 0.15, 0.7, 1], [0, 1, 0.9, 0]),
      transform: [
        { translateX: Math.cos(angle) * travel },
        { translateY: Math.sin(angle) * travel },
        // Born small, snap to full, then shrink out — a spark, not a balloon.
        { scale: interpolate(burst.value, [0, 0.28, 1], [0.2, 1, 0.3]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#ffffff',
        },
        style,
      ]}
    />
  );
}

export default HoldButton;
