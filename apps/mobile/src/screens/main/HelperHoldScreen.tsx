/**
 * HelperHoldScreen — screen 05 of the Predictive Insights design.
 *
 * The helper is in the line. This is the screen you actually live on: when to
 * leave, what your ticket is, how many are ahead, and roughly when you are up.
 *
 * LEAVE HOME BY is the biggest thing on it, at 54px, because it is the only
 * number that requires an action. The ticket number and the position are
 * reassurance; the departure time is the instruction.
 *
 * The three controls at the bottom are the three things that actually happen:
 * you set off, you need longer, or you are not coming. "Release my place" is
 * deliberately plain red text rather than a button — giving up a place you paid
 * to hold should take a moment of intent, and it genuinely leaves the queue so
 * the people behind move up.
 */
import React from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { font } from '../../lib/theme';
import { D } from '../../lib/predictiveDesign';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';

interface Helper {
  id: string;
  branch_name: string;
  service_name: string;
  target_served_at: string;
  travel_minutes: number;
  let_pass: boolean;
  max_pass_turns: number;
  passes_used: number;
  scheduled_join_at: string;
  leave_home_at: string;
  predicted_wait_minutes: number;
  status: 'scheduled' | 'holding' | 'checked_in' | string;
  ticket_number: string | null;
  people_ahead: number | null;
}

const clock = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const hhmm = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getHours() % 12 === 0 ? 12 : d.getHours() % 12}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** "in 4 min", "now", "12 min ago" — the urgency beside the departure time. */
function relative(iso?: string | null): string {
  if (!iso) return '';
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (!Number.isFinite(diff)) return '';
  if (diff === 0) return 'now';
  if (diff > 0) return diff < 60 ? `in ${diff} min` : `in ${Math.round(diff / 60)} hr`;
  const past = Math.abs(diff);
  return past < 60 ? `${past} min ago` : `${Math.round(past / 60)} hr ago`;
}

export default function HelperHoldScreen() {
  const topPad = useTopPad(8);
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const focused = useIsFocused();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['line-helper-active'],
    queryFn: () => api.get<{ helper: Helper | null }>('/line-helper/active'),
    /* 30s: the position ahead of you moves, and this screen is the one somebody
       stares at while deciding whether to set off. */
    refetchInterval: 30_000,
  });

  const act = useMutation({
    mutationFn: (action: 'on_my_way' | 'push_back' | 'release') =>
      api.patch(`/line-helper/${q.data!.helper!.id}`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line-helper-active'] }),
  });

  const helper = q.data?.helper ?? null;

  if (q.isLoading) {
    return <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: topPad, padding: 22 }}><SkeletonRows count={4} /></View>;
  }
  if (q.error) {
    return (
      <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: topPad, padding: 22 }}>
        <ErrorCard title="Helper unavailable" message="Your Line Helper could not be loaded." onRetry={() => q.refetch()} />
      </View>
    );
  }
  if (!helper) {
    return (
      <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: topPad, padding: 22 }}>
        <EmptyState icon="clock" title="No helper running"
          body="When you schedule a Line Helper it joins the line for you and this screen tells you when to leave."
          actionLabel="Go back" onAction={() => navigation.goBack()} />
      </View>
    );
  }

  const joined = helper.status === 'holding' || helper.status === 'checked_in';
  const turnAt = new Date(new Date(helper.target_served_at).getTime());

  /* Compared by calendar date, not by elapsed hours: a helper at 9am tomorrow
     is 18 hours away but is emphatically not "today". */
  const planDayLabel = (() => {
    const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((midnight(turnAt) - midnight(new Date())) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return turnAt.toLocaleDateString([], { weekday: 'long' });
  })();

  const confirmRelease = () => {
    Alert.alert(
      'Release your place?',
      'Your ticket leaves the line and the people behind you move up. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Release', style: 'destructive',
          onPress: () => act.mutate('release', { onSuccess: () => navigation.goBack() }),
        },
      ],
    );
  };

  const updatedAt = q.dataUpdatedAt ? hhmm(new Date(q.dataUpdatedAt).toISOString()) : null;
  const title = joined ? 'Holding your place' : 'Helper scheduled';
  const checkedIn = helper.status === 'checked_in';

  /* The v2 timeline: done rows are filled navy with a tick, the current row is
     a blue ring with a dot, the rest are pale rings; the connector between two
     rows is navy once the row above it is done. */
  type Step = { title: string; sub: string; time: string; state: 'done' | 'now' | 'todo' };
  const steps: Step[] = [
    {
      title: joined ? 'Helper joined the line' : 'Helper joins the line',
      sub: joined && helper.people_ahead !== null
        ? `${helper.people_ahead} ${helper.people_ahead === 1 ? 'person' : 'people'} ahead`
        : `About ${helper.predicted_wait_minutes} min before your turn`,
      time: hhmm(helper.scheduled_join_at),
      state: joined ? 'done' : 'now',
    },
    {
      title: 'Leave home',
      // "journey", not the design's "drive" — a route taxi is not a drive.
      sub: `${helper.travel_minutes} min journey`,
      time: hhmm(helper.leave_home_at),
      state: checkedIn ? 'done' : joined ? 'now' : 'todo',
    },
    {
      title: 'Check in at the branch',
      sub: 'Scan at the kiosk to take over',
      time: `~${hhmm(new Date(turnAt.getTime() - 2 * 60000).toISOString())}`,
      state: checkedIn ? 'done' : 'todo',
    },
    {
      title: 'Called to counter',
      sub: helper.ticket_number ? `Ticket ${helper.ticket_number}` : `Around ${clock(helper.target_served_at)}`,
      time: `~${hhmm(turnAt.toISOString())}`,
      state: checkedIn ? 'now' : 'todo',
    },
  ];
  const android = Platform.OS === 'android';

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      {/* Light status bar over the dark head; leaving hands it back. */}
      {focused && <StatusBar style="light" />}
      {/* ── the dark head ── */}
      <View style={{ backgroundColor: D.ink, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingTop: topPad }}>
        {android ? (
          <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 16 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 20, letterSpacing: -0.3, color: '#fff' }}>{title}</Text>
              {!!updatedAt && <Text style={{ fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>Live · updated {updatedAt}</Text>}
            </View>
          </View>
        ) : (
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View pointerEvents="none" style={{ position: 'absolute', left: 64, right: 64, alignItems: 'center' }}>
              <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 16, color: '#fff' }}>{title}</Text>
              {!!updatedAt && <Text style={{ fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 1 }}>Live · updated {updatedAt}</Text>}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Leave home by</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 56, letterSpacing: -2, lineHeight: 60, color: '#fff' }}>
              {hhmm(helper.leave_home_at)}
            </Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: D.onDarkAccent }}>
              {relative(helper.leave_home_at)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.1)' }}>
            {[
              { v: helper.ticket_number || '—', l: 'Ticket' },
              { v: helper.people_ahead === null ? '—' : String(helper.people_ahead), l: 'Ahead of you' },
              { v: hhmm(turnAt.toISOString()), l: 'Your turn, approx.' },
            ].map((t, i) => (
              <View key={t.l} style={{
                flex: 1, minWidth: 0,
                borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: 'rgba(255,255,255,.1)', paddingLeft: i === 0 ? 0 : 16,
              }}>
                <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 20, color: '#fff' }}>{t.v}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{t.l}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 + lift }} showsVerticalScrollIndicator={false}>
        {/* The design says "Today" because its mock is a same-day helper. A
            helper can be scheduled for any day, and a checklist headed "Today"
            over tomorrow's times is simply wrong — it is the kind of thing that
            has somebody leaving home 24 hours early. So the heading says which
            day it actually is. */}
        <Text style={{ fontFamily: font.semibold, fontSize: 17, color: D.ink, marginBottom: 12 }}>{planDayLabel}</Text>

        <View style={{ backgroundColor: D.surface, borderRadius: 20, borderWidth: 1, borderColor: '#edf0f4', paddingVertical: 4 }}>
          {steps.map((row, i) => {
            const prevDone = i > 0 && steps[i - 1].state === 'done';
            const last = i === steps.length - 1;
            return (
              <View key={row.title} style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16 }}>
                <View style={{ width: 22, alignItems: 'center' }}>
                  <View style={{ width: 2, height: 12, backgroundColor: i === 0 ? 'transparent' : prevDone ? D.accent : '#e3e7ee' }} />
                  <View style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    backgroundColor: row.state === 'done' ? D.accent : '#fff',
                    borderColor: row.state === 'done' ? D.accent : row.state === 'now' ? D.accentBright : '#d8dee7',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {row.state === 'done' && <Ionicons name="checkmark" size={12} color="#fff" />}
                    {row.state === 'now' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: D.accentBright }} />}
                  </View>
                  <View style={{ flex: 1, width: 2, backgroundColor: last ? 'transparent' : row.state === 'done' ? D.accent : '#e3e7ee' }} />
                </View>
                <View style={{
                  flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12,
                  borderBottomWidth: last ? 0 : 1, borderBottomColor: '#edf0f4',
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 16, color: row.state === 'todo' ? D.sub : D.ink }}>{row.title}</Text>
                    <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#8a94a6', marginTop: 2 }}>{row.sub}</Text>
                  </View>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#8a94a6', paddingTop: 2 }}>{row.time}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* How many yields are left, when any have been used. Silent otherwise —
            a counter at 0 of 3 is noise, and the number only becomes meaningful
            once it has started moving. */}
        {helper.let_pass && helper.passes_used > 0 && (
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: D.warmInk, marginTop: 12, lineHeight: 18 }}>
            You have been called and let {helper.passes_used} {helper.passes_used === 1 ? 'person' : 'people'} past.
            {' '}{helper.max_pass_turns - helper.passes_used} turn{helper.max_pass_turns - helper.passes_used === 1 ? '' : 's'} left before the ticket ends.
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => act.mutate('on_my_way')}
            disabled={act.isPending}
            accessibilityRole="button"
            style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: D.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#fff' }}>I&rsquo;m on my way</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => act.mutate('push_back')}
            /* Only before it joins — once the ticket exists the position is real
               and cannot be slid along by fifteen minutes. */
            disabled={act.isPending || joined}
            accessibilityRole="button"
            accessibilityState={{ disabled: act.isPending || joined }}
            style={{
              flex: 1, height: 50, borderRadius: 14, backgroundColor: D.coolBg,
              alignItems: 'center', justifyContent: 'center',
              opacity: joined ? 0.45 : 1,
            }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: D.coolInk }}>Push back 15 min</Text>
          </TouchableOpacity>
        </View>

        {joined && (
          <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#8a94a6', textAlign: 'center', marginTop: 8 }}>
            The helper has already joined, so the time cannot move.
          </Text>
        )}

        <TouchableOpacity onPress={confirmRelease} disabled={act.isPending} accessibilityRole="button" style={{ marginTop: 20, paddingVertical: 6 }}>
          <Text style={{ textAlign: 'center', fontFamily: font.semibold, fontSize: 14, color: '#a62b25' }}>
            Release my place
          </Text>
        </TouchableOpacity>

        {act.isPending && <ActivityIndicator style={{ marginTop: 12 }} color={D.accent} />}
      </ScrollView>
    </View>
  );
}
