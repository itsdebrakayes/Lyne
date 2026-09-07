/**
 * TicketPass — the ticket as a boarding pass.
 *
 * Modelled on the pass in Debra's reference: a dark panel carrying the journey,
 * a progress line between two points, a row of small facts, a perforation, and
 * the scannable half below it.
 *
 * The translation that matters is what the two ends of the line MEAN. On a
 * boarding pass they are two airports and the line is a flight. Here they are
 * two moments — when you joined and when you are expected to be seen — and the
 * line is your wait. That makes the dot on it the most useful thing on the
 * screen: it is the answer to "how much longer", drawn rather than stated, and
 * it moves while you watch it.
 *
 * The estimate underneath it is honest about being an estimate. A queue is not
 * a scheduled departure: counters close, somebody ahead takes twenty minutes,
 * and a number presented to the minute would be a promise the branch never
 * made. So the line shows progress and the label says "about".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '../lib/theme';

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** "9:41 am" — the clock a person reads, not an ISO string. */
export function clockOf(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Minutes between now and a timestamp, floored at zero. */
function minutesSince(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60_000));
}

export interface PassProgress {
  /** 0 → just joined, 1 → due now. */
  fraction: number;
  waitedMinutes: number | null;
  remainingMinutes: number;
  /** When we expect them to be seen, as a clock reading. */
  dueLabel: string;
}

/**
 * Where the dot sits.
 *
 * Progress is elapsed ÷ (elapsed + remaining) rather than elapsed ÷ original
 * estimate. Queues do not run to a schedule — when the remaining estimate goes
 * UP because a counter closed, a bar measured against the original estimate
 * marches on regardless and then sits pinned at the end lying to somebody who
 * is still waiting. Measured against the live total, the dot slows down, which
 * is what is actually happening to them.
 */
export function computeProgress(joinedAt?: string | null, remaining = 0): PassProgress {
  const waited = minutesSince(joinedAt);
  const left = Math.max(0, Math.round(num(remaining)));
  const total = (waited ?? 0) + left;
  const fraction = total > 0 ? Math.min(1, Math.max(0, (waited ?? 0) / total)) : 0;
  const due = new Date(Date.now() + left * 60_000);
  return {
    fraction,
    waitedMinutes: waited,
    remainingMinutes: left,
    dueLabel: due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  };
}

/* ── the line ───────────────────────────────────────────────────────────── */

function ProgressLine({ fraction, called }: { fraction: number; called: boolean }) {
  const [width, setWidth] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    const target = called ? 1 : fraction;
    if (reduceMotion) { anim.setValue(target); return undefined; }
    const a = Animated.timing(anim, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      /* Not native-driven: this animates `left`, a layout property, and the
         native driver silently refuses those on some platforms — which is how
         a progress dot ends up frozen at zero on the one screen where it is
         the point. */
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [fraction, called, anim, reduceMotion]);

  const travel = Math.max(0, width - 18);

  return (
    <View
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 18, justifyContent: 'center', marginTop: 14 }}
    >
      {/* the track */}
      <View style={{ height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,.18)' }} />

      {/* the distance already covered */}
      <Animated.View
        style={{
          position: 'absolute', left: 0, height: 2, borderRadius: 1,
          backgroundColor: colors.light,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }),
        }}
      />

      {/* where you joined */}
      <View style={{
        position: 'absolute', left: 0, width: 10, height: 10, borderRadius: 5,
        backgroundColor: colors.light,
      }} />

      {/* where you are now — the dot that moves */}
      <Animated.View
        style={{
          position: 'absolute', width: 18, height: 18, borderRadius: 9,
          backgroundColor: colors.light,
          borderWidth: 4, borderColor: colors.dark,
          left: anim.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }),
        }}
      />

      {/* the counter you are heading for */}
      <View style={{
        position: 'absolute', right: 0, width: 10, height: 10, borderRadius: 5,
        borderWidth: 2, borderColor: 'rgba(255,255,255,.45)',
      }} />
    </View>
  );
}

/* ── a small fact, the row the reference gives Class/Terminal/Gate/Seat ─── */

function Cell({ label, value, tone = 'dark' }: {
  label: string; value: React.ReactNode; tone?: 'dark' | 'light';
}) {
  const dim = tone === 'dark' ? 'rgba(255,255,255,.5)' : colors.muted;
  const ink = tone === 'dark' ? '#fff' : colors.ink;
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: dim, letterSpacing: 1 }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: ink, marginTop: 4, letterSpacing: -0.2 }}>
        {value}
      </Text>
    </View>
  );
}

/* ── the pass ───────────────────────────────────────────────────────────── */

export function TicketPass({
  branchName, serviceName, ticketNumber, joinedAt, remainingMinutes,
  place, ahead, inLine, status, children,
}: {
  branchName: string;
  serviceName: string;
  ticketNumber: string;
  joinedAt?: string | null;
  remainingMinutes: number;
  place: number | null;
  ahead: number;
  inLine: number | null;
  status: string;
  /** The stub below the perforation — code, barcode, wallet. */
  children?: React.ReactNode;
}) {
  const called = status === 'called' || status === 'in_service';
  const active = called || status === 'waiting';

  /* Recomputed on a timer, because the whole point of the line is that it
     moves without anybody touching the screen. A minute is the resolution the
     numbers are stated in, so a minute is how often it needs to change. */
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, [active]);

  const progress = useMemo(
    () => computeProgress(joinedAt, remainingMinutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [joinedAt, remainingMinutes, Math.floor(Date.now() / 30_000)],
  );

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 26, padding: 12, ...shadow.hero }}>
      {/* ── the journey, inset ───────────────────────────────────────── */}
      <View style={{ backgroundColor: colors.dark, borderRadius: 18, padding: 20 }}>
        {/* Where you are going, and what for — the two city names. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 10, color: 'rgba(255,255,255,.45)', letterSpacing: 1 }}>BRANCH</Text>
            <Text numberOfLines={2} style={{ fontFamily: font.extra, fontSize: 16, lineHeight: 20, color: '#fff', marginTop: 4, letterSpacing: -0.3 }}>
              {branchName}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 10, color: 'rgba(255,255,255,.45)', letterSpacing: 1 }}>SERVICE</Text>
            <Text numberOfLines={2} style={{ fontFamily: font.extra, fontSize: 16, lineHeight: 20, color: '#fff', marginTop: 4, textAlign: 'right', letterSpacing: -0.3 }}>
              {serviceName}
            </Text>
          </View>
        </View>

        {/* The two moments the line runs between. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22 }}>
          <View>
            <Text style={{ fontFamily: font.extra, fontSize: 27, color: '#fff', letterSpacing: -1 }}>{ticketNumber}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
              joined {clockOf(joinedAt)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 27, color: '#fff', letterSpacing: -1 }}>
              {called ? 'Now' : progress.dueLabel}
            </Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
              {called ? 'at the counter' : 'seen at about'}
            </Text>
          </View>
        </View>

        <ProgressLine fraction={progress.fraction} called={called} />

        {/* The middle label — the reference's "16h 30m". */}
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: called ? colors.light : 'rgba(255,255,255,.62)' }}>
            {called
              ? "It's your turn"
              : progress.remainingMinutes > 0
                ? `about ${progress.remainingMinutes} min left`
                : 'you are next'}
            {progress.waitedMinutes != null && !called ? `  ·  waited ${progress.waitedMinutes} min` : ''}
          </Text>
        </View>

        {/* The facts row — Class / Terminal / Gate / Seat, in this world. */}
        <View style={{
          flexDirection: 'row', gap: 12, marginTop: 20, paddingTop: 16,
          borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.12)',
        }}>
          <Cell label="PLACE" value={place != null ? `#${place}` : '—'} />
          <Cell label="AHEAD" value={ahead} />
          <Cell label="WAIT" value={active ? `${progress.remainingMinutes}m` : '—'} />
          <Cell label="IN LINE" value={inLine != null ? inLine : '—'} />
        </View>
      </View>

      {/* The tear line. Notches are punched in the SCREEN colour so the card
          reads as perforated rather than as two cards with a gap. */}
      <View style={{ height: 26, justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: -25, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.dark }} />
        <View style={{ position: 'absolute', right: -25, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.dark }} />
        <View style={{ marginHorizontal: 10, borderTopWidth: 1.6, borderStyle: 'dashed', borderColor: '#D3D9E3' }} />
      </View>

      {children}
    </View>
  );
}

export default TicketPass;
