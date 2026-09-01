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
 * The motion follows Opal's hold-to-commit: a luminous gradient sweeps the pill
 * left to right, the label changes to say the hold is working, and on
 * completion the pill morphs to a high-contrast state with a tick. Opal keeps
 * its hold button INSIDE the confirmation sheet rather than replacing it, which
 * is the arrangement copied here — the sheet says what you will lose, the hold
 * is how you agree to lose it.
 *
 * Two things are deliberately not decorative:
 *
 *  • The fill still runs under Reduce Motion. It is the only thing telling you
 *    how long to hold, so removing it would leave a button that does nothing
 *    for a second for no visible reason. What Reduce Motion drops is the
 *    overshoot on the morph and the glow — the parts that are flourish.
 *  • With a screen reader on, the hold is dropped entirely and the control
 *    becomes an ordinary button. Press-and-hold fights VoiceOver's own gesture
 *    set, and an accessibility affordance that makes a destructive action
 *    HARDER to perform correctly is not an accessibility affordance. The sheet
 *    around it already carries the confirmation.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, font } from '../lib/theme';
import { duration, easing, spring, useReducedMotion } from '../lib/motion';
import { haptics } from '../lib/haptics';

/** How long the finger stays down. Long enough to be deliberate, short enough
 *  not to feel like a punishment — Opal's own is around a second. */
const HOLD_MS = 1100;
/** Letting go snaps back faster than it filled. Undo should never feel slow. */
const RELEASE_MS = 220;

export type HoldButtonProps = {
  /** Resting label, e.g. "Hold to join the line". Say that it is a hold. */
  label: string;
  /** Shown while the finger is down. */
  holdingLabel?: string;
  /** Shown once the hold completes, beside the tick. */
  doneLabel: string;
  onComplete: () => void;
  /** 'accent' for joining, 'danger' for leaving. */
  tone?: 'accent' | 'danger';
  disabled?: boolean;
  /** Parent's async work is in flight — shows a spinner in the done state. */
  busy?: boolean;
  /** Change this to send a completed button back to rest, e.g. after a failed
   *  request. Without it a network error would leave a tick on screen next to
   *  an error message saying the opposite. */
  resetSignal?: number;
  style?: StyleProp<ViewStyle>;
  hint?: string;
};

export function HoldButton({
  label,
  holdingLabel = 'Keep holding…',
  doneLabel,
  onComplete,
  tone = 'accent',
  disabled,
  busy,
  resetSignal = 0,
  style,
  hint,
}: HoldButtonProps) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  const progress = useSharedValue(0);
  const doneIn = useSharedValue(0);
  /* Completion is a one-way door. Without this guard a timing callback that
     resolves while the finger is lifting can fire onComplete a second time —
     and onComplete here leaves a queue. */
  const fired = useRef(false);

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
    progress.value = 0;
    doneIn.value = 0;
    setDone(false);
    setHolding(false);
  }, [resetSignal, progress, doneIn]);

  const finish = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    setHolding(false);
    setDone(true);
    haptics.success();
    doneIn.value = reduced
      ? withTiming(1, { duration: duration.quick, easing: easing.enter })
      : withSpring(1, spring.bouncy);
    onComplete();
  }, [onComplete, doneIn, reduced]);

  const start = () => {
    if (disabled || done) return;
    haptics.press();
    setHolding(true);
    progress.value = withTiming(
      1,
      { duration: HOLD_MS, easing: easing.move },
      (completed) => { if (completed) runOnJS(finish)(); },
    );
  };

  const stop = () => {
    if (fired.current) return;
    setHolding(false);
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: RELEASE_MS, easing: easing.exit });
  };

  /* The fill is a full-width layer slid in from the left rather than a view
     whose width animates. Width is a layout property — animating it re-measures
     every frame and stutters on Android — where translateX is a transform and
     stays on the UI thread. */
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + progress.value * width }],
  }));

  const doneStyle = useAnimatedStyle(() => ({
    opacity: doneIn.value,
    transform: [{ scale: 0.96 + doneIn.value * 0.04 }],
  }));

  const ground = tone === 'danger' ? colors.danger : colors.accent;
  const sweep: [string, string] = tone === 'danger'
    ? ['rgba(255,255,255,.10)', 'rgba(255,255,255,.34)']
    : ['rgba(255,255,255,.12)', 'rgba(255,255,255,.38)'];

  const body = (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={[
        {
          minHeight: 54,
          borderRadius: 18,
          backgroundColor: ground,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {width > 0 && !done && (
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width }, fillStyle]}>
          <LinearGradient
            colors={sweep}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}

      <Text
        numberOfLines={1}
        style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk, letterSpacing: -0.2 }}
      >
        {holding ? holdingLabel : label}
      </Text>

      {/* The morph: a high-contrast pill laid over the top once the hold lands,
          so the colour change and the tick arrive together rather than the
          label swapping underneath a ground that is still moving. */}
      {done && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0, right: 0, top: 0, bottom: 0,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            },
            doneStyle,
          ]}
        >
          {busy
            ? <ActivityIndicator color={ground} />
            : <Ionicons name="checkmark-circle" size={19} color={ground} />}
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.2 }}>
            {doneLabel}
          </Text>
        </Animated.View>
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
        {body}
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
      {body}
    </Pressable>
  );
}

export default HoldButton;
