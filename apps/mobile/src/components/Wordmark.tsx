/**
 * Wordmark — the word "Lyne", set the one way it is allowed to be set.
 *
 * The brand name is part of the logo, not a string in the UI typeface. The kit
 * sets it in Cormorant Italic; writing it in Manrope — however carefully
 * letter-spaced — produces something that is almost the logo, which is worse
 * than something that is obviously not.
 *
 * So every place the product refers to itself by name goes through here, and
 * the face lives in exactly one file. If the wordmark is ever redrawn, this is
 * the only thing that changes.
 *
 * Cormorant is under the SIL Open Font License, which permits commercial use
 * and explicitly permits use in logos — the licensing question that blocked the
 * first brand kit does not arise with this one.
 *
 * It is NOT a UI font. Nothing else in the app may use it: a serif italic at
 * 13px in a table is unreadable, and the moment it appears somewhere that is
 * not the brand it stops reading as the brand.
 */
import React from 'react';
import { Text, TextStyle } from 'react-native';
import { colors } from '../lib/theme';

export const WORDMARK_FONT = 'Cormorant_600SemiBold_Italic';

export function Wordmark({
  size = 24,
  color,
  style,
}: {
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      /* Read as a name, not as a heading — otherwise a screen reader announces
         "heading, Lyne" every time the app mentions itself. */
      accessibilityRole="text"
      allowFontScaling={false}
      style={[
        {
          fontFamily: WORDMARK_FONT,
          fontSize: size,
          color: color ?? colors.ink,
          /* Cormorant sits small on the body relative to its point size, and
             italic descenders get clipped at a tight line height. */
          lineHeight: size * 1.25,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      Lyne
    </Text>
  );
}

export default Wordmark;
