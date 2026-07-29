import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { colors, font } from '../lib/theme';

/** A single loading dot that breathes on a staggered loop. */
function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 520, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, opacity: v }} />;
}

export default function LaunchScreen() {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 11, stiffness: 130, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // A soft glow behind the mark, breathing on a slow loop so the screen feels
    // alive during the load rather than frozen after the entrance.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, scale, subOpacity, glow]);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.24] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {/* breathing glow behind the mark */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', width: 190, height: 190, borderRadius: 95,
            backgroundColor: colors.accent, opacity: glowOpacity, transform: [{ scale: glowScale }],
          }}
        />
        <Animated.View style={{ opacity, transform: [{ scale }], flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 30 }}>Q</Text>
          </View>
          <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 40, letterSpacing: -1.4 }}>QMe Now</Text>
        </Animated.View>
      </View>

      <Animated.Text style={{ opacity: subOpacity, color: 'rgba(255,255,255,.55)', fontFamily: font.semibold, fontSize: 13.5 }}>
        Skip the line, not your day.
      </Animated.Text>

      {/* subtle loading rhythm */}
      <Animated.View style={{ opacity: subOpacity, flexDirection: 'row', gap: 7, marginTop: 6 }}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </Animated.View>
    </View>
  );
}
