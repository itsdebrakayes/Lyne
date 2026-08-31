/**
 * AuthMotifFrame — the brand tiles that frame the auth screens.
 *
 * A row of Lyne tiles bleeds off the top edge and a mirrored row off the
 * bottom, each fading into the page. Shared by sign in and sign up so the two
 * cannot drift apart: continuity between them is the whole point of the frame,
 * and it is the first thing to break when the same layout is maintained twice.
 *
 * Docked, not scrolled. It is absolutely positioned against the screen and
 * rendered BEFORE the content, so on sign up — which is a long scrolling form —
 * the frame stays pinned to the edges while the fields move past it, exactly as
 * it behaves on the single-page sign in. Nothing here takes touches.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, hexToRgba, shadow } from '../lib/theme';

type Tile = { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string };

const TOP_TILES: Tile[] = [
  { icon: 'ticket', bg: colors.dark, fg: colors.accent },
  { icon: 'time-outline', bg: '#ffffff', fg: colors.accentDeep },
  { icon: 'barcode-outline', bg: colors.accent, fg: colors.accentInk },
  { icon: 'location', bg: colors.dark, fg: '#ffffff' },
  { icon: 'notifications', bg: '#ffffff', fg: colors.accentDeep },
];
const BOTTOM_TILES: Tile[] = [
  { icon: 'qr-code-outline', bg: colors.dark, fg: '#ffffff' },
  { icon: 'people-outline', bg: colors.accent, fg: colors.accentInk },
  { icon: 'sparkles', bg: '#ffffff', fg: colors.accentDeep },
  { icon: 'navigate', bg: colors.dark, fg: colors.accent },
  { icon: 'checkmark-done', bg: colors.accent, fg: colors.accentInk },
];

function MotifRow({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 13, transform: [{ rotate: '-7deg' }] }}>
      {tiles.map((tile, index) => (
        <View
          key={index}
          style={{
            width: 84, height: 84, borderRadius: 25, backgroundColor: tile.bg,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: tile.bg === '#ffffff' ? 1 : 0, borderColor: colors.border,
            ...shadow.card,
          }}
        >
          <Ionicons name={tile.icon} size={31} color={tile.fg} />
        </View>
      ))}
    </View>
  );
}

export function AuthMotifFrame() {
  return (
    <>
      <View style={styles.topMotif} pointerEvents="none"><MotifRow tiles={TOP_TILES} /></View>
      <LinearGradient
        pointerEvents="none"
        /* Both stops derive from the surface. Naming the transparent one as
           rgba(255,255,255,0) hides the hue at the stop but not between stops,
           so on a dark surface the fade washed pale before it landed. */
        colors={[hexToRgba(colors.surface, 0), colors.surface]}
        locations={[0, 0.82]}
        style={styles.topFade}
      />

      <View style={styles.bottomMotif} pointerEvents="none"><MotifRow tiles={BOTTOM_TILES} /></View>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.surface, hexToRgba(colors.surface, 0)]}
        locations={[0.18, 1]}
        style={styles.bottomFade}
      />
    </>
  );
}

const styles = StyleSheet.create({
  /* The tiles are 84 tall and were once offset -46, so barely half a row
     survived at each edge and the brand read as a stray sliver. At -18 most of
     the row is on screen and the frame carries the page. The fades match — at
     210 they erased what the smaller offset had just revealed. */
  topMotif: { position: 'absolute', top: -18, left: -44, right: -44, alignItems: 'center' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 186 },
  bottomMotif: { position: 'absolute', bottom: -18, left: -44, right: -44, alignItems: 'center' },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 186 },
});

export default AuthMotifFrame;
