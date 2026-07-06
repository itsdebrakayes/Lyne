import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { colors, font } from '../lib/theme';

export default function LaunchScreen() {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 11, stiffness: 130, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, subOpacity]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Animated.View style={{ opacity, transform: [{ scale }], flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 30 }}>Q</Text>
        </View>
        <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 40, letterSpacing: -1.4 }}>QMe Now</Text>
      </Animated.View>
      <Animated.Text style={{ opacity: subOpacity, color: 'rgba(255,255,255,.55)', fontFamily: font.semibold, fontSize: 13.5 }}>
        Skip the line, not your day.
      </Animated.Text>
    </View>
  );
}
