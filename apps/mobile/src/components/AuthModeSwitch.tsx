/**
 * AuthModeSwitch — "Create account | Sign in" above the auth form.
 *
 * People new to Lyne kept typing into the sign-in form believing it was
 * sign-up. A two-segment control above the form says which form this is before
 * a single field is touched.
 *
 * It switches the form in place: the highlight slides to the other segment and
 * the form grows or shrinks around the fields both modes share. It used to
 * replace the whole screen, which read as being sent somewhere else.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { colors, font } from '../lib/theme';

export type AuthMode = 'signup' | 'signin';

const SEGMENTS: Array<{ mode: AuthMode; label: string }> = [
  { mode: 'signup', label: 'Create account' },
  { mode: 'signin', label: 'Sign in' },
];

const PAD = 4;

export function AuthModeSwitch({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - PAD * 2) / 2 : 0;
  const x = useRef(new Animated.Value(mode === 'signup' ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(x, {
      toValue: mode === 'signup' ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode, x]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: PAD, marginBottom: 22 }}
    >
      {segment > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: PAD, bottom: PAD, left: PAD, width: segment,
            borderRadius: 11, backgroundColor: colors.surface,
            shadowColor: '#0b1b3f', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, segment] }) }],
          }}
        />
      )}
      {SEGMENTS.map(seg => {
        const on = seg.mode === mode;
        return (
          <TouchableOpacity
            key={seg.mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            activeOpacity={0.85}
            onPress={() => { if (!on) onChange(seg.mode); }}
            style={{ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 14, color: on ? colors.ink : colors.muted }}>{seg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
