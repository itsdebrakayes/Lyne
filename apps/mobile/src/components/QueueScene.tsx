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

type Pose = 'waiting' | 'checking' | 'leaving';

/**
 * One person. The head sits slightly off-centre for `checking` so the figure
 * reads as looking down at a watch — one pixel of characterisation, which is
 * what stops a row of identical shapes reading as a progress bar.
 */
function Figure({
  pose = 'waiting',
  tint,
  scale = 1,
  opacity = 1,
}: {
  pose?: Pose;
  tint: string;
  scale?: number;
  opacity?: number;
}) {
  const head = 13 * scale;
  const bodyW = 20 * scale;
  const bodyH = 30 * scale;

  return (
    <View style={{ alignItems: 'center', opacity }}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          backgroundColor: tint,
          marginBottom: 3 * scale,
          // The tilt is the whole characterisation. Kept small on purpose.
          transform: [{ translateX: pose === 'checking' ? 2 * scale : 0 }],
        }}
      />
      <View
        style={{
          width: bodyW,
          height: bodyH,
          backgroundColor: tint,
          borderTopLeftRadius: bodyW / 2,
          borderTopRightRadius: bodyW / 2,
          borderBottomLeftRadius: 4 * scale,
          borderBottomRightRadius: 4 * scale,
        }}
      />
    </View>
  );
}

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
        <Figure tint={waiting} scale={0.92} opacity={0.4} />
        <Figure tint={waiting} scale={1.0} pose="checking" opacity={0.62} />
        <Figure tint={waiting} scale={1.06} />
        <Figure tint={nearFront} scale={1.12} pose="checking" />

        {/* The one being served: full accent, stepped forward. This is the only
            element carrying brand colour, so the eye lands on the payoff rather
            than on the queue. */}
        <View style={{ marginLeft: 18 }}>
          <Figure tint={colors.accent} scale={1.18} pose="leaving" />
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
