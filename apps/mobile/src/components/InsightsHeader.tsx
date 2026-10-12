/**
 * InsightsHeader — the top bar on the Predictive Insights v2 screens.
 *
 * The design draws two: iOS gets a 40pt round back button with the title
 * centred over the bar; Android gets the Material top app bar — a 48dp arrow,
 * then a 20pt title left-aligned beside it. Same screen, the platform's own
 * convention for the chrome.
 */
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';

export function InsightsHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  /** Optional trailing element. */
  right?: React.ReactNode;
}) {
  if (Platform.OS === 'android') {
    return (
      <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: -16, paddingRight: 16, marginBottom: 4 }}>
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text numberOfLines={1} accessibilityRole="header" style={{ flex: 1, fontFamily: font.semibold, fontSize: 20, letterSpacing: -0.3, color: colors.ink }}>
          {title}
        </Text>
        {right}
      </View>
    );
  }
  return (
    <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
          borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <Text
        pointerEvents="none"
        accessibilityRole="header"
        style={{ position: 'absolute', left: 56, right: 56, textAlign: 'center', fontFamily: font.semibold, fontSize: 16, color: colors.ink }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export default InsightsHeader;
