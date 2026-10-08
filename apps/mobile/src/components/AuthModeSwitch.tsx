/**
 * AuthModeSwitch — "Create account | Sign in" at the top of both auth screens.
 *
 * People new to Lyne kept typing into the sign-in form believing it was
 * sign-up: the only way across was a line of small grey text under the
 * button. A two-segment control above the form says which form this is before
 * a single field is touched, and the other one is one tap away.
 *
 * replace(), not navigate(): flipping between the two must not build a back
 * stack of alternating forms.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, font } from '../lib/theme';

type Mode = 'signup' | 'signin';

const SEGMENTS: Array<{ mode: Mode; label: string; route: 'Signup' | 'Auth' }> = [
  { mode: 'signup', label: 'Create account', route: 'Signup' },
  { mode: 'signin', label: 'Sign in', route: 'Auth' },
];

export function AuthModeSwitch({ current }: { current: Mode }) {
  const navigation = useNavigation<any>();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 4, marginBottom: 22 }}
    >
      {SEGMENTS.map(seg => {
        const on = seg.mode === current;
        return (
          <TouchableOpacity
            key={seg.mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            activeOpacity={0.85}
            onPress={() => { if (!on) navigation.replace(seg.route); }}
            style={{
              flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? colors.surface : 'transparent',
              ...(on ? { shadowColor: '#0b1b3f', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 } : null),
            }}
          >
            <Text style={{ fontFamily: on ? font.bold : font.semibold, fontSize: 14, color: on ? colors.ink : colors.muted }}>{seg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
