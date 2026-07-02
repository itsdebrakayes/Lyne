import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brandGradient } from '../lib/mobileV3Styles';

export default function LaunchScreen() {
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 130, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  return (
    <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center', gap: 16 }}>
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#6b4eff', fontSize: 32, fontWeight: '900' }}>Q</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 }}>QME Now</Text>
        <Text style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: '600' }}>The calm queue layer</Text>
      </Animated.View>
    </LinearGradient>
  );
}
