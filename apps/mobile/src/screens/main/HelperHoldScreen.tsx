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
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { font } from '../../lib/theme';
import { D } from '../../lib/predictiveDesign';
import { useTopPad } from '../../lib/insets';
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
  const navigation = useNavigation<any>();
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

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      {/* ── the dark head ── */}
      <View style={{ backgroundColor: D.ink, paddingBottom: 26, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, paddingTop: topPad }}>
        <View style={{ paddingHorizontal: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 7,
              backgroundColor: 'rgba(47,191,113,.16)', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12,
            }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#3fd07f' }} />
              <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: '#5fd99a' }}>
                {joined ? 'Helper in line' : 'Helper scheduled'}
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.6, color: 'rgba(255,255,255,.55)' }}>
            LEAVE HOME BY
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 54, letterSpacing: -2, lineHeight: 58, color: '#fff' }}>
              {hhmm(helper.leave_home_at)}
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: D.onDarkAccent }}>
              {relative(helper.leave_home_at)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
            {[
              { v: helper.ticket_number || '—', l: 'Your ticket' },
              { v: helper.people_ahead === null ? '—' : String(helper.people_ahead), l: 'Ahead of you' },
              { v: `~${hhmm(turnAt.toISOString())}`, l: 'Your turn' },
            ].map((t) => (
              <View key={t.l} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.07)', borderRadius: 16, padding: 12 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 20, color: '#fff' }}>{t.v}</Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>{t.l}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: font.extra, fontSize: 17, color: D.ink, marginBottom: 12 }}>Today</Text>

        <View style={{ backgroundColor: D.surface, borderRadius: 22, borderWidth: 1, borderColor: D.lineSoft, paddingVertical: 6, paddingHorizontal: 16 }}>
          {[
            {
              title: 'Helper joined the line',
              sub: joined
                ? `${clock(helper.scheduled_join_at)}${helper.people_ahead !== null ? ` · ${helper.people_ahead} people ahead` : ''}`
                : `Scheduled for ${clock(helper.scheduled_join_at)}`,
              state: joined ? 'done' : 'todo',
            },
            {
              title: 'Leave home',
              sub: `${clock(helper.leave_home_at)} · ${helper.travel_minutes} min journey`,
              state: joined ? 'now' : 'todo',
            },
            {
              title: 'Check in at the branch',
              sub: 'Scan at the kiosk to take over the ticket',
              state: helper.status === 'checked_in' ? 'done' : 'todo',
            },
            {
              title: 'Called to counter',
              sub: `Around ${clock(helper.target_served_at)}`,
              state: 'todo',
            },
          ].map((row, i, all) => (
            <View key={row.title} style={{
              flexDirection: 'row', gap: 14, paddingVertical: 12,
              borderBottomWidth: i === all.length - 1 ? 0 : 1, borderBottomColor: D.lineSoft,
            }}>
              {row.state === 'done' ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: D.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                </View>
              ) : row.state === 'now' ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: D.accentBright, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: D.accentBright }} />
                </View>
              ) : (
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: D.line }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: row.state === 'todo' ? D.sub : D.ink }}>
                  {row.title}
                </Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: row.state === 'todo' ? D.faint : D.muted, marginTop: 2 }}>
                  {row.sub}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* How many yields are left, when any have been used. Silent otherwise —
            a counter at 0 of 3 is noise, and the number only becomes meaningful
            once it has started moving. */}
        {helper.let_pass && helper.passes_used > 0 && (
          <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: D.warmInk, marginTop: 12, lineHeight: 17 }}>
            You have been called and let {helper.passes_used} {helper.passes_used === 1 ? 'person' : 'people'} past.
            {' '}{helper.max_pass_turns - helper.passes_used} turn{helper.max_pass_turns - helper.passes_used === 1 ? '' : 's'} left before the ticket ends.
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <TouchableOpacity
            onPress={() => act.mutate('on_my_way')}
            disabled={act.isPending}
            accessibilityRole="button"
            style={{ flex: 1, height: 50, borderRadius: 16, backgroundColor: D.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: '#fff' }}>I&rsquo;m on my way</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => act.mutate('push_back')}
            /* Only before it joins — once the ticket exists the position is real
               and cannot be slid along by fifteen minutes. */
            disabled={act.isPending || joined}
            accessibilityRole="button"
            accessibilityState={{ disabled: act.isPending || joined }}
            style={{
              flex: 1, height: 50, borderRadius: 16, backgroundColor: D.surface,
              borderWidth: 1, borderColor: D.line, alignItems: 'center', justifyContent: 'center',
              opacity: joined ? 0.45 : 1,
            }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: D.ink }}>Push back 15 min</Text>
          </TouchableOpacity>
        </View>

        {joined && (
          <Text style={{ fontFamily: font.semibold, fontSize: 11, color: D.muted, textAlign: 'center', marginTop: 8 }}>
            The helper has already joined, so the time cannot move.
          </Text>
        )}

        <TouchableOpacity onPress={confirmRelease} disabled={act.isPending} accessibilityRole="button" style={{ marginTop: 16 }}>
          <Text style={{ textAlign: 'center', fontFamily: font.bold, fontSize: 12.5, color: '#a62b25' }}>
            Release my place
          </Text>
        </TouchableOpacity>

        {act.isPending && <ActivityIndicator style={{ marginTop: 12 }} color={D.accent} />}
      </ScrollView>
    </View>
  );
}
