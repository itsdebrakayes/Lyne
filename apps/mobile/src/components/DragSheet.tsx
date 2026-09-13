/**
 * DragSheet — the bottom sheet, as an object you can grab.
 *
 * Both of this app's sheets used `<Modal animationType="slide">`. That gives a
 * fixed 300ms tween in and out, and nothing else: you cannot grab the sheet,
 * you cannot drag it away, and if you catch it mid-animation it ignores you
 * and finishes what it was doing. It is a picture of a sheet.
 *
 * Every phone the customer already owns behaves differently. Apple's own
 * sheets follow the finger 1:1, resist when you pull them past their stop,
 * fly away if you flick them, come back if you don't, and can be caught and
 * reversed at any point in any of that. The gap between those two things is
 * most of why an app feels bought rather than built.
 *
 * Four rules from Designing Fluid Interfaces, in the order they matter:
 *
 *  1. Direct manipulation. While a finger is down the sheet tracks it exactly,
 *     from the offset where it was GRABBED. Snapping to centre on grab breaks
 *     the illusion in the first frame.
 *  2. Interruptibility. Any animation can be seized mid-flight. We stop it,
 *     read the value where it actually IS on screen, and carry on from there —
 *     never from where it was headed, which is what causes a visible jump.
 *  3. Velocity handoff. The spring starts at the exact speed the finger left
 *     at, so there is no seam between dragging and animating.
 *  4. Momentum projection. A release animates to where the gesture was GOING
 *     (projectDecay), not to whatever was nearest when the finger lifted. This
 *     is what makes a small flick throw the sheet properly.
 *
 * No new native dependency: PanResponder and Animated ship with React Native.
 * That matters this close to submission — react-native-gesture-handler would
 * mean a new native build to get a sheet to slide.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../lib/theme';
import { duration, spring, projectDecay, rubberband, useReducedMotion } from '../lib/motion';
import { haptics } from '../lib/haptics';

const SCREEN_H = Dimensions.get('window').height;

/** Movement before we commit to "this is a drag" — below it, it is still a tap. */
const DRAG_THRESHOLD = 10;

/** Fraction of the sheet's own height the projected landing must pass to dismiss. */
const DISMISS_RATIO = 0.5;

export type DragSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Set false while an action is in flight — the sheet must not be dragged away mid-request. */
  dismissible?: boolean;
  /** Style for the sheet surface itself (padding, radius, background). */
  sheetStyle?: ViewStyle;
  /** Announced when the sheet opens. */
  label?: string;
};

export function DragSheet({
  visible,
  onClose,
  children,
  dismissible = true,
  sheetStyle,
  label,
}: DragSheetProps) {
  const reduced = useReducedMotion();

  // `mounted` outlives `visible`: the sheet has to stay in the tree long
  // enough to animate out. Unmounting on the prop change is why so many sheets
  // vanish instantly instead of leaving.
  const [mounted, setMounted] = useState(visible);
  const [sheetH, setSheetH] = useState(SCREEN_H * 0.4);

  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // The live on-screen value. Read on grab so an interrupted animation
  // continues from where the sheet IS, not from where it was going.
  const current = useRef(SCREEN_H);
  const grabOffset = useRef(0);
  const dragging = useRef(false);
  const exiting = useRef(false);
  const heightRef = useRef(sheetH);
  heightRef.current = sheetH;
  // Until onLayout has fired once, heightRef holds a guess. Entering from a
  // guess that is short leaves the sheet half on screen for a frame before it
  // springs, so the first open travels the whole screen instead.
  const measured = useRef(false);
  const offscreen = () => (measured.current ? heightRef.current + 40 : SCREEN_H);
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const id = translateY.addListener(({ value }) => { current.current = value; });
    return () => translateY.removeListener(id);
  }, [translateY]);

  const settle = useCallback((velocity = 0) => {
    exiting.current = false;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        velocity,
        ...spring.gentle,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: duration.quick,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, fade]);

  const dismiss = useCallback((velocity = 0) => {
    // Exit is faster than entry: the sheet is already irrelevant, and making
    // someone watch it leave is the commonest way an app feels slow.
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: offscreen(),
        velocity,
        ...spring.gentle,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: duration.quick,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // Only tear down if the exit really finished. If a finger caught it on
      // the way out, the sheet is under the user's control now.
      if (finished && !dragging.current) setMounted(false);
      exiting.current = false;
    });
    // Flagged BEFORE onClose, because onClose flips `visible` synchronously and
    // the effect below would otherwise start a second, fixed-duration exit over
    // this one — overwriting the velocity the finger just handed us.
    exiting.current = true;
    onClose();
  }, [translateY, fade, onClose]);

  // Open / close driven by the prop.
  useEffect(() => {
    if (visible) {
      exiting.current = false;
      setMounted(true);
      if (reduced) {
        // Reduce Motion means a gentler equivalent, not silence: the sheet
        // cross-fades in place rather than travelling up the screen.
        translateY.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: duration.base, useNativeDriver: true }).start();
      } else {
        translateY.setValue(offscreen());
        settle();
      }
      if (label) AccessibilityInfo.announceForAccessibility?.(label);
    } else if (mounted && !exiting.current) {
      if (reduced) {
        Animated.timing(fade, { toValue: 0, duration: duration.quick, useNativeDriver: true })
          .start(({ finished }) => { if (finished) setMounted(false); });
      } else {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: offscreen(),
            duration: duration.quick,
            useNativeDriver: true,
          }),
          Animated.timing(fade, { toValue: 0, duration: duration.quick, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) setMounted(false); });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  const responder = useRef(
    PanResponder.create({
      // Claim the touch on DOWN, not on move, so a sheet mid-flight can be
      // caught the instant a finger lands on it (rule 2).
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > DRAG_THRESHOLD,
      // Let a ScrollView inside the sheet win vertical drags that start in it.
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: () => {
        dragging.current = true;
        // Read the presentation value and stop dead there. Reading the target
        // instead is what makes an interrupted sheet jump.
        translateY.stopAnimation((value: number) => {
          current.current = value;
          grabOffset.current = value;
          translateY.setValue(value);
        });
        grabOffset.current = current.current;
      },

      onPanResponderMove: (_e, g) => {
        const raw = grabOffset.current + g.dy;
        // Downward is free travel; upward is past the stop, so it resists
        // progressively instead of refusing (rule: soft boundaries).
        const next = raw >= 0 ? raw : rubberband(raw, heightRef.current);
        translateY.setValue(next);
        current.current = next;
      },

      onPanResponderRelease: (_e, g) => {
        dragging.current = false;
        // gestureState.vy is px/ms; everything below is px/s.
        const velocity = g.vy * 1000;
        const projected = current.current + projectDecay(velocity);

        if (dismissibleRef.current && projected > heightRef.current * DISMISS_RATIO) {
          haptics.select();
          dismiss(velocity);
        } else {
          settle(velocity);
        }
      },

      onPanResponderTerminate: () => {
        dragging.current = false;
        settle();
      },
    }),
  ).current;

  if (!mounted) return null;

  const scrimOpacity = fade.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* A modal task dims its background — the sheet is the only thing to
            deal with until it is dealt with. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,16,14,.5)', opacity: scrimOpacity }]}
        >
          <View
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={() => true}
            onResponderRelease={onClose}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>

        <Animated.View
          onLayout={(e) => { measured.current = true; setSheetH(e.nativeEvent.layout.height); }}
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingBottom: 34,
            },
            sheetStyle,
            { transform: [{ translateY }] },
          ]}
        >
          {/* The grab handle is the affordance AND the grab area. Everything in
              the top strip is draggable, so the gesture is discoverable by the
              obvious means: putting a finger on the thing that looks grabbable. */}
          <View {...responder.panHandlers} style={{ paddingTop: 10, paddingBottom: 8 }}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Drag down to dismiss"
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: 'center',
              }}
            />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default DragSheet;
