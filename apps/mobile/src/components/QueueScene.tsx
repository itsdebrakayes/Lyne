/**
 * QueueScene — a line of people, drawn from primitives.
 *
 * This replaces the tilted icon mosaic that used to fill the onboarding and auth
 * screens. That mosaic was twelve unrelated glyphs — a ticket, a storefront, an
 * hourglass, a barcode, sparkles — arranged at an angle and bleeding off the
 * edges. It is the single most recognisable AI-generated app device, and it said
 * nothing: nine icons with no through-line, chosen for texture.
 *
 * A queue app should show a queue. Same reasoning as the Parcel splash, which
 * shows one thing — a delivery — because the app is about deliveries.
 *
 * No illustration is commissioned for this. It is circles and rounded
 * rectangles, which is enough: the thing that reads as "a queue" is the RHYTHM
 * — evenly spaced figures, one of them out of step at the front — not the
 * fidelity of the drawing. It also previews the splash animation
 * (docs/SPLASH_AND_LOADING_DESIGN.md) so the two share a language.
 */
import React from 'react';
import { View } from 'react-native';
import { colors } from '../lib/theme';
import { WalkingFigure } from './WalkingFigure';

/**
 * The figures were a circle on a rounded rectangle — a blob, not a person.
 * They now use WalkingFigure, which has a torso that tapers at the waist and
 * limbs that can hold a pose, so a standing figure reads as someone waiting
 * rather than as a shape.
 */
export function QueueScene({
  height = 190,
  /** Light surfaces need darker figures than a near-black ground does. */
  onDark = false,
}: {
  height?: number;
  onDark?: boolean;
}) {
  const waiting = onDark ? 'rgba(255,255,255,0.20)' : 'rgba(18,32,58,0.16)';
  const nearFront = onDark ? 'rgba(255,255,255,0.34)' : 'rgba(18,32,58,0.28)';
  const doorTint = onDark ? 'rgba(255,255,255,0.10)' : 'rgba(18,32,58,0.08)';

  return (
    <View style={{ height, justifyContent: 'flex-end', overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 24, gap: 15 }}>
        {/* The back of the line fades out rather than ending in a hard edge, so
            it reads as continuing off-screen instead of being exactly 5 people. */}
        <View style={{ opacity: 0.4 }}><WalkingFigure size={40} tint={waiting} still /></View>
        <View style={{ opacity: 0.62 }}><WalkingFigure size={44} tint={waiting} still checkingWatch /></View>
        <View><WalkingFigure size={47} tint={waiting} still /></View>
        <View><WalkingFigure size={50} tint={nearFront} still checkingWatch /></View>

        {/* The one being served: full accent, stepped forward. This is the only
            element carrying brand colour, so the eye lands on the payoff rather
            than on the queue. */}
        {/* The one being served is the only figure actually walking — they are
            stepping up to the counter while the rest stand. */}
        <View style={{ marginLeft: 18 }}>
          <WalkingFigure size={54} tint={colors.accent} cycleMs={1100} />
        </View>

        {/* The counter they are stepping up to. Same row as the figures, so it
            shares their baseline instead of floating at its own. */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View
            style={{
              width: 58, height: 86, borderRadius: 12,
              borderWidth: 2, borderColor: doorTint, backgroundColor: 'transparent',
            }}
          />
        </View>
      </View>

      {/* Ground line — gives the figures something to stand on. Without it they
          float, which is the same complaint as the auth form. */}
      <View
        style={{
          marginTop: 14,
          height: 1,
          marginHorizontal: 20,
          backgroundColor: onDark ? 'rgba(255,255,255,0.09)' : 'rgba(18,32,58,0.08)',
        }}
      />
    </View>
  );
}

export default QueueScene;
