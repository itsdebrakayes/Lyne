/**
 * Press — the app's one interactive primitive.
 *
 * Every touchable in this app was a TouchableOpacity, which fades and nothing
 * else. A fade is the cheapest feedback there is: it tells you the tap
 * registered, but it has no weight, so the whole interface reads flat next to
 * anything from Apple or Google. Their controls *depress* — they take the
 * press, then spring back.
 *
 * So: scale + opacity together, fast in and slower out (a press should feel
 * instant, a release should feel like it settles), on a native-driven spring so
 * it never stutters behind JS work.
 *
 * It also fixes two things that were missing app-wide:
 *
 *  • Accessibility. There was one accessibilityLabel across 118 touchables.
 *    Here `label` is a first-class prop and the role defaults to "button", so
 *    using this component at all makes a control announce itself.
 *  • Touch target. Anything under 44x44 gets hitSlop padded out to it
 *    automatically — the iOS HIG minimum — instead of each call site
 *    remembering (8 of 118 did).
 */
import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';
import { press as physics } from '../lib/theme';
import { haptics } from '../lib/haptics';

export type PressProps = {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Screen-reader name. Required for anything without visible text. */
  label?: string;
  hint?: string;
  role?: 'button' | 'link' | 'tab' | 'switch' | 'checkbox';
  /** Fire a selection tick on press-in. For committing actions, not navigation. */
  haptic?: boolean;
  /** How far it depresses. 'firm' for large cards, 'soft' for small controls. */
  weight?: 'soft' | 'firm';
  /** Minimum touch target; anything smaller gets hitSlop to reach it. */
  minTarget?: number;
};

export function Press({
  children, onPress, onLongPress, style, disabled,
  label, hint, role = 'button', haptic, weight = 'soft', minTarget = 44,
}: PressProps) {
  const anim = useRef(new Animated.Value(0)).current;

  // Big surfaces need less scale to read as pressed — a card shrinking 3%
  // looks broken, where a 44pt button shrinking 3% looks right.
  const target = weight === 'firm' ? 0.985 : physics.scale;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, target] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, physics.opacity] });

  const to = (value: number, duration: number) =>
    Animated.timing(anim, { toValue: value, duration, useNativeDriver: true }).start();

  const flat = useMemo(
    () => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as any) || {}),
    [style],
  );

  // A control smaller than the HIG minimum gets its tappable area padded out
  // without changing how it looks.
  const slop = useMemo(() => {
    const w = Number(flat.width) || minTarget;
    const h = Number(flat.height) || minTarget;
    const x = Math.max(0, Math.ceil((minTarget - w) / 2));
    const y = Math.max(0, Math.ceil((minTarget - h) / 2));
    return x || y ? { top: y, bottom: y, left: x, right: x } : undefined;
  }, [flat, minTarget]);

  // The style lands on the inner Animated.View, so anything the PARENT needs to
  // lay this out — flex above all — never reached the Pressable, and a
  // `flex: 1` Press sized itself to its text instead of taking its share of the
  // row. Forward just the layout-participation props; everything visual stays
  // inside, where the press transform applies to it.
  const outer = useMemo(() => ({
    flex: flat.flex,
    flexGrow: flat.flexGrow,
    flexShrink: flat.flexShrink,
    flexBasis: flat.flexBasis,
    alignSelf: flat.alignSelf,
  }), [flat]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={slop}
      style={outer}
      accessible
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={() => { if (haptic) haptics.select(); to(1, physics.inDuration); }}
      onPressOut={() => to(0, physics.outDuration)}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled ? 0.45 : opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default Press;
