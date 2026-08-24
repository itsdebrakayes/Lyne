/**
 * QueuePosition — the line, drawn.
 *
 * The ticket screen told you "2 ahead of you" and "~13 min". Both true, both
 * numbers you have to take on faith. The one thing a person standing in a queue
 * actually wants to know is *am I moving*, and a number that changes from 3 to 2
 * while you are not looking answers that badly.
 *
 * So: draw the line. One dot per person in front, then you. When someone is
 * served a dot disappears and your marker slides forward — the same information,
 * but as motion you can feel rather than a figure you have to compare against a
 * figure you no longer remember.
 *
 * Long lines compress rather than scroll: past a dozen dots the exact count
 * stops meaning anything and "24 ahead" is the honest summary.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { colors, font, sp, radius, type } from '../lib/theme';

const MAX_DOTS = 12;

export function QueuePosition({ ahead, called }: { ahead: number; called?: boolean }) {
  const shown = Math.max(0, Math.min(ahead, MAX_DOTS));
  const overflow = Math.max(0, ahead - MAX_DOTS);

  /* Your marker pulses only while you are actually next or being called — a
     permanently animating dot is decoration and stops meaning anything. */
  const pulse = useRef(new Animated.Value(0)).current;
  const live = called || ahead === 0;
  useEffect(() => {
    if (!live) { pulse.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  const label = called ? 'They are calling you now'
    : ahead === 0 ? 'You are next'
    : ahead === 1 ? `1 person ahead of you — you are ${ahead + 1}${nth(ahead + 1)}`
    : `${ahead} people ahead of you — you are ${ahead + 1}${nth(ahead + 1)}`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ alignSelf: 'stretch', marginTop: sp.xl }}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: sp.m, paddingHorizontal: sp.l,
        backgroundColor: colors.surfaceAlt, borderRadius: radius.l,
      }}>
        {overflow > 0 ? (
          <Text style={{ ...type.caption, color: colors.muted, marginRight: 2 }}>+{overflow}</Text>
        ) : null}

        {Array.from({ length: shown }).map((_, i) => (
          <View key={i} style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: colors.border,
            // the two immediately in front read darker: nearly your turn
            ...(i >= shown - 2 ? { backgroundColor: colors.chevron } : null),
          }} />
        ))}

        {/* you */}
        <View style={{ marginLeft: shown ? 4 : 0, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
          {live ? (
            <Animated.View style={{
              position: 'absolute', width: 16, height: 16, borderRadius: 8,
              backgroundColor: called ? colors.accent : colors.light,
              opacity: glow, transform: [{ scale }],
            }} />
          ) : null}
          <View style={{
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: called ? colors.accent : colors.dark,
          }} />
        </View>

      </View>

      <Text style={{ ...type.callout, color: colors.muted, marginTop: sp.s, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

/** 1st, 2nd, 3rd, 4th… including the 11th–13th exceptions. */
function nth(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export default QueuePosition;
