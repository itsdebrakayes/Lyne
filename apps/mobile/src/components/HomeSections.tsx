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
import { colors, font, shadow, isBranchOpen } from '../lib/theme';
import { BranchSummary, orgAcronym, shortBranchName } from '../lib/mobileData';

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
  /** The full legal name — for screen readers, never drawn. */
  label: string;
  /** What people call it. This is what the tile shows. */
  acronym: string;
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
    /* One row that scrolls, not a wrapping grid.
       Eight tiles over two rows pushed the agency cards below the fold, so the
       first thing on Home after the promo was a wall of acronyms rather than
       the lines somebody actually came to check. Four fit across; the rest are
       a thumb-flick away, which is the right cost for the ninth agency. */
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      snapToInterval={84}
      decelerationRate="fast"
    >
      {items.map((it) => (
        <TouchableOpacity
          key={it.id}
          onPress={it.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          /* The tile shows letters; a screen reader still gets the whole name,
             because "CFC" read aloud is not a name. */
          accessibilityLabel={it.label}
          style={{ width: 72 }}
        >
          <View
            style={{
              width: 72, height: 72, borderRadius: 22, backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.borderSoft,
              alignItems: 'center', justifyContent: 'center', ...shadow.card,
            }}
          >
            {/* One line, always. UTECH is the longest real acronym at five
                characters and has to sit at the same optical weight as NHT, so
                the type steps down rather than the tile growing. */}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: font.extra,
                fontSize: it.acronym.length >= 5 ? 14 : 16.5,
                color: colors.accent, letterSpacing: 0.2,
              }}
            >
              {it.acronym}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
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
     counters open AND somebody actually in the line. */
  const live = open && Number(branch.open_queues || 0) > 0 && waiting > 0;
  const b = badge ? BADGE[badge] : null;

  return (
    /* Wider and taller than the first pass. At 232 the badge sat on top of the
       agency name and the branch name clipped — on a phone, held at arm's
       length, that is a card you have to decode rather than read. */
    <View style={{ width: 268, borderRadius: 24, backgroundColor: colors.surface, overflow: 'hidden', ...shadow.card }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${branch.business_name}, ${branch.name}`}
      >
        {/* Head: the agency, and whether it is live. Nothing else competes for
            this strip now that the badge has moved down. */}
        <View style={{ height: 74, backgroundColor: colors.dark, paddingHorizontal: 16, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: font.extra,
                  fontSize: orgAcronym(branch.business_id, branch.business_name).length >= 5 ? 11 : 13,
                  color: colors.accent,
                }}
              >
                {orgAcronym(branch.business_id, branch.business_name)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 13.5, color: '#fff', letterSpacing: -0.2 }}>
                {orgAcronym(branch.business_id, branch.business_name)}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
                {live ? 'Line moving now' : open ? 'Open, no queue' : 'Closed'}
              </Text>
            </View>
            {live && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light }} />
                <Text style={{ fontFamily: font.extra, fontSize: 10, color: colors.light, letterSpacing: 0.5 }}>LIVE</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View style={{ padding: 16, flex: 1 }}>
        {/* The badge gets its own line. Overlaid on the head it read as part of
            the agency name; here it is plainly a label ABOUT the branch below
            it, which is what it is. */}
        {!!b && (
          <View style={{ flexDirection: 'row', marginBottom: 9 }}>
            <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: b.bg }}>
              <Text style={{ fontFamily: font.extra, fontSize: 10.5, color: b.fg, letterSpacing: 0.3 }}>{b.label}</Text>
            </View>
          </View>
        )}

        {/* Two lines allowed. A branch name is the one thing on this card that
            must never be truncated — it is the answer to "where do I go". */}
        <Text numberOfLines={2} style={{ fontFamily: font.extra, fontSize: 17, lineHeight: 21, color: colors.ink, letterSpacing: -0.4 }}>
          {shortBranchName(branch.name)}
        </Text>

        <View style={{ gap: 7, marginTop: 11, marginBottom: 14 }}>
          <Stat icon="time-outline" value={wait ? `${wait} min` : 'No wait'} caption="to be seen" />
          <Stat icon="people-outline" value={String(waiting)} caption={waiting === 1 ? 'person ahead' : 'people ahead'} />
        </View>

        <TouchableOpacity
          onPress={onJoin}
          disabled={!open}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={open ? `Join the line at ${branch.name}` : `${branch.name} is closed`}
          accessibilityState={{ disabled: !open }}
          style={{
            minHeight: 44, borderRadius: 14, marginTop: 'auto', paddingTop: 0,
            backgroundColor: open ? colors.accent : colors.surfaceAlt,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: font.extra, fontSize: 14, color: open ? colors.accentInk : colors.muted }}>
            {open ? 'Join now' : 'Closed'}
          </Text>
        </TouchableOpacity>
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
      snapToInterval={280}
      decelerationRate="fast"
    >
      {children}
    </ScrollView>
  );
}
