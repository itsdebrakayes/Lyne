/**
 * PremiumBadge — the marker that says this account is on Lyne Premium.
 *
 * Modelled on JamAI's "Plus" badge (itsdebrakayes/JamAI,
 * src/components/SubscriptionBadge.tsx): a rounded pill with a left-to-right
 * blue-to-cyan gradient, a small lightning bolt, and the tier name in white,
 * medium weight, sentence case. The blue end is Lyne's own brand blue (the
 * logo's rope) rather than Tailwind's blue-500; the cyan end is JamAI's.
 *
 * The same badge appears wherever Premium is shown: the Predictive Insights
 * header, Settings' Premium card and the Premium screen.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { font } from '../lib/theme';

const FROM = '#3370FF';
const TO = '#06B6D4';

export function PremiumBadge({
  label = 'Premium',
  size = 'md',
}: {
  label?: string;
  size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  return (
    <View accessibilityRole="text" accessibilityLabel={label === "Premium" ? "Lyne Premium" : `Lyne Premium, ${label}`} style={{ borderRadius: 999, overflow: 'hidden' }}>
      <LinearGradient
        colors={[FROM, TO]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: sm ? 10 : 12, paddingVertical: sm ? 4 : 5,
        }}
      >
        <Ionicons name="flash" size={sm ? 11 : 12} color="#fff" />
        <Text style={{ fontFamily: font.semibold, fontSize: sm ? 12 : 13, color: '#fff' }}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

export default PremiumBadge;
