import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Text, View } from 'react-native';
import { colors, font } from '../lib/theme';
import WalkingFigure, { FIGURE_HEIGHT, FIGURE_WIDTH } from './WalkingFigure';

const SCREEN_WIDTH = Dimensions.get('window').width;

/** How long the figure takes to cross the screen. App.tsx holds the splash for this long. */
export const LAUNCH_DURATION_MS = 2600;

const GROUND_INSET = 96;        // how far above the bottom the figure walks

export default function LaunchScreen() {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, damping: 11, stiffness: 130, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // The walk carries the figure the full width of the screen — it enters from
    // off-frame left and leaves off-frame right, at a constant speed so the
    // stride length stays believable.
    Animated.timing(travel, {
      toValue: 1,
      duration: LAUNCH_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [opacity, scale, subOpacity, travel]);

  const walkX = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [-FIGURE_WIDTH - 20, SCREEN_WIDTH + 20],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Animated.View style={{ opacity, transform: [{ scale }], flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 58, height: 58, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 30 }}>L</Text>
        </View>
        <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 40, letterSpacing: -1.4 }}>Lyne</Text>
      </Animated.View>
      <Animated.Text style={{ opacity: subOpacity, color: 'rgba(255,255,255,.55)', fontFamily: font.semibold, fontSize: 13.5 }}>
        Skip the line, not your day.
      </Animated.Text>

      {/* The line the figure walks along, and the figure itself. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: GROUND_INSET, height: FIGURE_HEIGHT }}
      >
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: 'rgba(255,255,255,.10)' }} />
        <Animated.View style={{ position: 'absolute', bottom: 0, transform: [{ translateX: walkX }] }}>
          <WalkingFigure tone={{ limb: 'rgba(255,255,255,.85)', far: 'rgba(255,255,255,.34)' }} />
        </Animated.View>
      </View>
    </View>
  );
}
