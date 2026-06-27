import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

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
    <View style={{ flex: 1, backgroundColor: '#080808', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center', gap: 16 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#080808', fontSize: 30, fontWeight: '900' }}>Q</Text></View>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>QMe Now</Text>
      </Animated.View>
    </View>
  );
}
