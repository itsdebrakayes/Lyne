/**
 * HomeSections — the parts of the new Home below the hero.
 *
 * Structure follows Debra's reference screen closely: a four-across tile grid,
 * a horizontal card rail whose cards carry a badge and a primary action, and a
 * row of short proofs across the bottom.
 *
 * Where the reference shows things we do not have, the substitute is a real
 * number rather than a plausible-looking one:
 *
 *  • Stars. The reference card leads with "4.8 (2.3K)". Lyne has no ratings —
 *    nobody rates a tax office — so the same slot carries the two figures that
 *    actually decide whether to go: the live wait, and how many are ahead.
 *    Inventing a rating would be the fastest way to make the screen untrue.
 *
 *  • Price. There is nothing to charge for, so the card's money row is the
 *    branch's open/closed state instead, which is the other thing that stops a
 *    journey being worth making.
 *
 *  • "Verified Professional" becomes LIVE, and it is honest: it appears only
 *    when the branch has counters open and a moving line, and disappears when
 *    the figures are stale.
 */
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, isBranchOpen, orgMark, shortOrgName } from '../lib/theme';
import { BranchSummary } from '../lib/mobileData';

/* ── section header ─────────────────────────────────────────── */

export function RailHead({ title, actionLabel, onAction }: {
  title: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.5 }}>{title}</Text>
      {!!actionLabel && (
        <TouchableOpacity
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.accent }}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── agency tiles ───────────────────────────────────────────── */

export interface TileItem {
  id: string;
  label: string;
  slug?: string | null;
  onPress: () => void;
}

/**
 * Four across, wrapping — the reference's category grid.
 *
 * Labels sit under the tile at two lines maximum. "Tax Administration Jamaica"
 * cannot fit and must not be clipped mid-word, so the tile carries the initials
 * and the label carries the short name.
 */
export function TileGrid({ items }: { items: TileItem[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
      {items.map((it) => (
        <TouchableOpacity
          key={it.id}
          onPress={it.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={{ width: '25%', alignItems: 'center', paddingHorizontal: 4 }}
        >
          <View
            style={{
              width: 58, height: 58, borderRadius: 19, backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.borderSoft,
              alignItems: 'center', justifyContent: 'center', ...shadow.card,
            }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accent, letterSpacing: 0.2 }}>
              {orgMark(it.slug, it.label)}
            </Text>
          </View>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: font.semibold, fontSize: 11, color: colors.sub,
              textAlign: 'center', marginTop: 8, lineHeight: 14,
            }}
          >
            {shortOrgName(it.label, 26)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ── recommendation card ────────────────────────────────────── */

export type BadgeKind = 'shortest' | 'no_queue' | 'closest' | 'busiest' | null;

const BADGE: Record<Exclude<BadgeKind, null>, { label: string; bg: string; fg: string }> = {
  shortest: { label: 'Shortest wait', bg: colors.dark, fg: '#fff' },
  no_queue: { label: 'No queue right now', bg: colors.light, fg: '#04220f' },
  closest: { label: 'Closest to you', bg: colors.accent, fg: colors.accentInk },
  busiest: { label: 'Busiest today', bg: colors.moderate, fg: '#2a1a00' },
};

/** A stat pair, as the reference sets its rating and duration: icon, figure, caption. */
function Stat({ icon, value, caption }: { icon: keyof typeof Ionicons.glyphMap; value: string; caption: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink }}>{value}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.muted }}>{caption}</Text>
    </View>
  );
}

export function BranchCard({
  branch, badge, onOpen, onJoin,
}: {
  branch: BranchSummary;
  badge: BadgeKind;
  onOpen: () => void;
  onJoin: () => void;
}) {
  const wait = Math.round(Number(branch.avg_wait_minutes || 0));
  const waiting = Number(branch.total_waiting || 0);
  const open = isBranchOpen(branch);
  /* LIVE means the figures are moving, not merely that the door is unlocked:
     counters open AND somebody actually in the line. A branch that is open but
     idle is honestly "No queue", and says so in the badge. */
  const live = open && Number(branch.open_queues || 0) > 0 && waiting > 0;
  const b = badge ? BADGE[badge] : null;

  return (
    <View style={{ width: 232, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden', ...shadow.card }}>
      {/* Head panel — the reference's photo slot. A tinted block carrying the
          agency mark reads as deliberate; a stock photo of a building would be
          the thing that makes an app look generated. */}
      <TouchableOpacity activeOpacity={0.9} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${branch.business_name}, ${branch.name}`}>
        <View style={{ height: 96, backgroundColor: colors.dark, paddingHorizontal: 16, justifyContent: 'center' }}>
          {!!b && (
            <View style={{
              position: 'absolute', top: 12, left: 12, borderRadius: 8,
              paddingHorizontal: 9, paddingVertical: 4, backgroundColor: b.bg,
            }}>
              <Text style={{ fontFamily: font.extra, fontSize: 10, color: b.fg, letterSpacing: 0.3 }}>{b.label}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <View style={{
              width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.accent }}>
                {orgMark(branch.business_slug, branch.business_name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.72)' }}>
                {shortOrgName(branch.business_name, 24)}
              </Text>
              {live && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light }} />
                  <Text style={{ fontFamily: font.extra, fontSize: 10.5, color: colors.light, letterSpacing: 0.4 }}>LIVE</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={{ padding: 14 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>
          {branch.name}
        </Text>

        <View style={{ gap: 6, marginTop: 9 }}>
          <Stat icon="time-outline" value={wait ? `${wait} min` : 'No wait'} caption="to be seen" />
          <Stat icon="people-outline" value={String(waiting)} caption={waiting === 1 ? 'person ahead' : 'people ahead'} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: open ? colors.light : colors.muted }} />
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: open ? colors.ink : colors.muted }}>
              {open ? 'Open now' : 'Closed'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onJoin}
            disabled={!open}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={open ? `Join the line at ${branch.name}` : `${branch.name} is closed`}
            accessibilityState={{ disabled: !open }}
            style={{
              minHeight: 36, borderRadius: 12, paddingHorizontal: 15,
              backgroundColor: open ? colors.accent : colors.surfaceAlt,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: open ? colors.accentInk : colors.muted }}>
              Join now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ── proof row ──────────────────────────────────────────────── */

const PROOFS: Array<{ icon: keyof typeof Ionicons.glyphMap; a: string; b: string }> = [
  { icon: 'pulse-outline', a: 'Live from', b: 'the counter' },
  { icon: 'phone-portrait-outline', a: 'Hold your', b: 'spot remotely' },
  { icon: 'notifications-outline', a: 'Told when', b: 'to set off' },
  { icon: 'exit-outline', a: 'Leave any', b: 'time, free' },
];

/** The reference's trust strip: four short claims, each one Lyne actually does. */
export function ProofRow() {
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 22,
      paddingVertical: 18, paddingHorizontal: 8, ...shadow.card,
    }}>
      {PROOFS.map(p => (
        <View key={p.a} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
          <View style={{
            width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name={p.icon} size={17} color={colors.accent} />
          </View>
          <Text style={{ fontFamily: font.semibold, fontSize: 10, color: colors.sub, textAlign: 'center', marginTop: 7, lineHeight: 13 }}>
            {p.a}{'\n'}{p.b}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── horizontal rail ────────────────────────────────────────── */

export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      /* The cards are 232 wide with a 12 gap, so a flick lands one card at a
         time rather than drifting to a half-shown edge. */
      snapToInterval={244}
      decelerationRate="fast"
    >
      {children}
    </ScrollView>
  );
}
