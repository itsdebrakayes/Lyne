import React from 'react';
import { View } from 'react-native';

/**
 * Code39Barcode — renders a genuine, scannable Code 39 barcode from a value.
 *
 * Ticket verification codes are uppercase hex (0-9 A-F), which Code 39 encodes
 * natively, so counter scanners and phone cameras can read the ticket straight
 * off the screen. Rendered with plain Views — no native dependencies.
 */

// Each character is 9 elements (5 bars, 4 spaces), alternating bar/space,
// starting with a bar. '1' = wide element, '0' = narrow element.
const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100',
  A: '100001001', B: '001001001', C: '101001000', D: '000011001',
  E: '100011000', F: '001011000', G: '000001101', H: '100001100',
  I: '001001100', J: '000011100', K: '100000011', L: '001000011',
  M: '101000010', N: '000010011', O: '100010010', P: '001010010',
  Q: '000000111', R: '100000110', S: '001000110', T: '000010110',
  U: '110000001', V: '011000001', W: '111000000', X: '010010001',
  Y: '110010000', Z: '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
};

interface Code39BarcodeProps {
  value: string;
  height?: number;
  color?: string;
  narrowWidth?: number;
}

export default function Code39Barcode({
  value,
  height = 58,
  color = '#15151a',
  narrowWidth = 2,
}: Code39BarcodeProps) {
  const wideWidth = Math.round(narrowWidth * 2.5);
  const sanitized = value.toUpperCase().replace(/[^0-9A-Z\-. ]/g, '');
  const content = `*${sanitized}*`;

  const segments: Array<{ width: number; bar: boolean }> = [];
  for (const char of content) {
    const pattern = CODE39[char];
    if (!pattern) continue;
    if (segments.length > 0) segments.push({ width: narrowWidth, bar: false });
    pattern.split('').forEach((bit, index) => {
      segments.push({ width: bit === '1' ? wideWidth : narrowWidth, bar: index % 2 === 0 });
    });
  }

  return (
    <View
      accessible
      accessibilityLabel={`Barcode for code ${sanitized}`}
      style={{ height, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center' }}
    >
      {segments.map((segment, index) => (
        <View
          key={index}
          style={{ width: segment.width, backgroundColor: segment.bar ? color : 'transparent' }}
        />
      ))}
    </View>
  );
}
