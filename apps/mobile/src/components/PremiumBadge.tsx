/**
 * PremiumBadge — QMe's premium marker, styled after the JamAI subscription
 * badge: a rounded-full pill with a tier icon, a gradient fill, and white
 * text. One component so every "Premium" marker in the app reads the same.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { font } from '../lib/theme';

// Cyan → blue, echoing JamAI's "Plus" gradient but on QMe's brand cyan.
const GRADIENT = ['#1fc2de', '#2b6fe3'] as const;

export function PremiumBadge({
  label = 'Premium',
  icon = 'star',
  size = 'md',
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  return (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: sm ? 4 : 5,
        borderRadius: 999, paddingVertical: sm ? 4 : 5.5, paddingHorizontal: sm ? 9 : 11,
      }}
    >
      <Ionicons name={icon} size={sm ? 11 : 12.5} color="#fff" />
      <Text style={{ fontFamily: font.extra, fontSize: sm ? 11 : 12.5, color: '#fff', letterSpacing: 0.2 }}>{label}</Text>
    </LinearGradient>
  );
}

/** A whole-pill variant used where premium/free tiers are shown side by side. */
export function TierPill({ premium }: { premium: boolean }) {
  if (premium) return <PremiumBadge label="Premium" icon="star" size="sm" />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9, backgroundColor: '#eceef1' }}>
      <Ionicons name="ellipse-outline" size={11} color="#8a919b" />
      <Text style={{ fontFamily: font.extra, fontSize: 11, color: '#5c636d', letterSpacing: 0.2 }}>Free</Text>
    </View>
  );
}
