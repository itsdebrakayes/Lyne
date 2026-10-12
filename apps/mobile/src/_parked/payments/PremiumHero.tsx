/**
 * PremiumHero — the Lyne lockup with "Premium" set under it.
 *
 * "Premium" is in the wordmark's own face (Cormorant Garamond), Bold Italic,
 * filled with the brand gradient: the deep blue of the app into the two blues
 * of the logo's rope. It is drawn as SVG text because React Native cannot fill
 * ordinary text with a gradient, and SVG needs no extra native module.
 */
import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { colors } from '../lib/theme';

const LIGHT_BG = '#f1f3f7';

export function PremiumHero({ width = 320 }: { width?: number }) {
  const light = colors.bg === LIGHT_BG;
  const h = 72;
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityRole="header" accessibilityLabel="Lyne Premium">
      <Image
        source={light ? require('../../assets/lyne-logo-dark.png') : require('../../assets/lyne-logo-light.png')}
        style={{ width: 150, height: 57 }}
        resizeMode="contain"
      />
      <Svg width={width} height={h} style={{ marginTop: -2 }}>
        <Defs>
          <LinearGradient id="premiumFill" x1="0" y1="0" x2="1" y2="0.35">
            <Stop offset="0" stopColor={light ? '#143a6e' : '#84D2FF'} />
            <Stop offset="0.5" stopColor="#3370FF" />
            <Stop offset="1" stopColor={light ? '#5CC4F8' : '#B9E6FF'} />
          </LinearGradient>
        </Defs>
        <SvgText
          x={width / 2}
          y={h - 16}
          textAnchor="middle"
          fontFamily="CormorantGaramond_700Bold_Italic"
          fontSize={60}
          fill="url(#premiumFill)"
        >
          Premium
        </SvgText>
      </Svg>
    </View>
  );
}

export default PremiumHero;
