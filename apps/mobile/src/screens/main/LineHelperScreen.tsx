/**
 * LineHelperScreen — screen 04 of the Predictive Insights design.
 *
 * "Lyne joins the line at the time you agree." You say when you want to be
 * SERVED and how long you take to get there; the server works backwards through
 * the predicted wait for that slot and schedules the join.
 *
 * THE TOGGLE IS THE POINT, not a setting. "Let people pass if I'm late" is what
 * makes holding a place for an absent person defensible: when the ticket is
 * called and you are not there, it yields to the person behind you, up to three
 * turns, then ends. Without it this is a paid queue-jump, which no agency would
 * accept and which the first person stuck behind an empty space would — rightly
 * — complain about. It defaults ON.
 *
 * Every wait shown on an arrival chip is quoted by the server from real history
 * for that branch, service, weekday and hour. Where there is not enough history
 * the chip says so and cannot be chosen, rather than showing a confident number
 * somebody would plan a morning around.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { font } from '../../lib/theme';
import { D } from '../../lib/predictiveDesign';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { InsightsHeader } from '../../components/InsightsHeader';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'LineHelper'>;

/** The design's three travel options. */
const TRAVEL = [15, 25, 40];

const clock = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
};

export default function LineHelperScreen() {
  const topPad = useTopPad(8);
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user } = useAuth();

  const { businessId, branchId, branchName, serviceId, serviceName, targetDow, targetHour } = route.params ?? ({} as any);

  const [travel, setTravel] = useState<number>(25);
  const [letPass, setLetPass] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /* The bookable times come from the server: within opening hours, with
     enough history to predict the wait, and far enough ahead for the helper
     to join. The app never guesses a time the server would refuse, so there
     is no "Closed" state to show. Days ahead are normal — booking Thursday
     8am on a Monday is the point of the feature. */
  type Option = { served_at: string; hour: number; predicted_wait_minutes: number };
  const options = useQuery({
    queryKey: ['helper-options', branchId, serviceId, targetDow, targetHour],
    queryFn: () => api.post<{ day?: string; moved?: boolean; options: Option[]; message?: string }>('/line-helper/options', {
      branch_id: branchId,
      service_id: serviceId,
      ...(typeof targetDow === 'number' ? { target_dow: targetDow } : {}),
      ...(typeof targetHour === 'number' ? { target_hour: targetHour } : {}),
    }),
    enabled: Boolean(branchId && serviceId),
    staleTime: 1000 * 60 * 5,
  });
  const offered = options.data?.options ?? [];
  const [picked, setPicked] = useState(0);
  const option: Option | null = offered[picked] ?? offered[0] ?? null;

  const target = option ? new Date(option.served_at) : new Date();
  const chosenWait = option ? option.predicted_wait_minutes : null;
  const joinAt = chosenWait === null ? null : new Date(target.getTime() - chosenWait * 60000);
  const leaveAt = new Date(target.getTime() - travel * 60000);

  const steps = useMemo(() => {
    if (!joinAt) return [];
    return [
      { label: 'Helper joins the line', at: joinAt, dot: D.accentBright, icon: 'list' as const },
      { label: 'You leave home', at: leaveAt, dot: '#f5a623', icon: 'home' as const },
      { label: 'You reach the branch', at: new Date(target.getTime() - 2 * 60000), dot: D.sub, icon: 'log-in-outline' as const },
      { label: 'Called to counter', at: target, dot: D.good, icon: 'notifications' as const },
    ].sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [joinAt, leaveAt, target]);

  const schedule = async () => {
    if (!joinAt) return;
    try {
      setBusy(true); setError('');
      await api.post('/line-helper', {
        branch_id: branchId,
        service_id: serviceId,
        target_served_at: target.toISOString(),
        travel_minutes: travel,
        let_pass: letPass,
      });
      navigation.replace('HelperHold');
    } catch (e: any) {
      setError(e?.message || 'That did not schedule. Try again in a moment.');
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 150 + lift }} showsVerticalScrollIndicator={false}>

        <InsightsHeader title="Line Helper" onBack={() => navigation.goBack()} />

        <Text style={{ fontFamily: font.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: D.ink, maxWidth: 300 }}>
          Lyne joins the line at the time you agree.
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: D.sub, marginTop: 8, marginBottom: 16 }}>
          {target.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · {branchName || 'this branch'} · {serviceName || 'this service'}
        </Text>

        <View style={{ backgroundColor: D.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#edf0f4' }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: D.sub, marginBottom: 10 }}>Be served around</Text>
          {!!options.data?.moved && offered.length > 0 && (
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: D.sub, marginTop: -4, marginBottom: 10, lineHeight: 18 }}>
              These are the nearest times the branch is open and Lyne can book for you.
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {options.isLoading ? (
              <ActivityIndicator color={D.accent} style={{ paddingVertical: 14 }} />
            ) : offered.length === 0 ? (
              <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13, color: D.sub, lineHeight: 19 }}>
                {options.data?.message || (options.error ? 'Times could not be loaded. Check your connection and try again.' : 'No bookable times yet.')}
              </Text>
            ) : offered.map((o, i) => {
              const on = o === option;
              return (
                <TouchableOpacity
                  key={o.served_at}
                  onPress={() => setPicked(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${clock(new Date(o.served_at))}, about ${o.predicted_wait_minutes} minute wait`}
                  style={{
                    flex: 1, borderRadius: 14, paddingVertical: 8, alignItems: 'center',
                    backgroundColor: on ? D.ink : D.surface,
                    borderWidth: 1, borderColor: on ? D.ink : '#e3e7ee',
                  }}
                >
                  <Text style={{ fontFamily: font.semibold, fontSize: 15, color: on ? '#fff' : D.ink }}>
                    {clock(new Date(o.served_at))}
                  </Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 12, marginTop: 2, color: on ? '#fff' : D.ink, opacity: 0.65 }}>
                    ~{o.predicted_wait_minutes} min wait
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: D.sub, marginTop: 14, marginBottom: 10 }}>Travel time</Text>
          <View style={{ flexDirection: 'row', gap: 4, backgroundColor: D.bg, borderRadius: 12, padding: 4 }}>
            {TRAVEL.map((t) => {
              const on = t === travel;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTravel(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, height: 34,
                    backgroundColor: on ? D.surface : 'transparent',
                    shadowColor: '#000', shadowOpacity: on ? 0.08 : 0,
                    shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                    elevation: on ? 2 : 0,
                  }}
                >
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: on ? D.ink : '#8a94a6' }}>{t} min</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* The fairness toggle. */}
          <TouchableOpacity
            onPress={() => setLetPass((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: letPass }}
            accessibilityLabel="Let others pass if I'm late. Holds your place for up to 3 turns."
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#edf0f4' }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: D.ink }}>Let others pass if I&rsquo;m late</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#8a94a6', marginTop: 2 }}>
                Holds your place for up to 3 turns
              </Text>
            </View>
            <View style={{
              width: 48, height: 28, borderRadius: 14, padding: 3,
              /* The design's off-track is #e7eaf0 (D.line). It is pale against
                 the white card, and it is legible anyway because the knob
                 carries the design's own drop shadow — which is what draws the
                 edge. Default is on, so this is the rarer state. */
              backgroundColor: letPass ? D.accent : '#d8dee7',
              flexDirection: 'row', justifyContent: letPass ? 'flex-end' : 'flex-start',
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
                shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
              }} />
            </View>
          </TouchableOpacity>

          {/* Switching it off is allowed, and it is explained rather than
              prevented — but the consequence is stated, because the person
              choosing it is choosing the branch's ordinary no-show rules. */}
          {!letPass && (
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: D.warmInk, marginTop: 10, lineHeight: 18 }}>
              With this off, your place is held rigidly — and if you are not there when you are called, the branch&rsquo;s normal no-show rules apply straight away.
            </Text>
          )}
        </View>

        {/* YOUR PLAN */}
        <View style={{ backgroundColor: D.ink, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 20, marginTop: 12 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 10 }}>
            Your plan
          </Text>
          {options.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : !joinAt ? (
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 19 }}>
              {options.data?.message || 'Pick a time above to see the plan.'}
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {steps.map((s) => (
                <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: s.dot, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={s.icon} size={12} color="#fff" />
                  </View>
                  <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,.85)' }}>{s.label}</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: '#fff' }}>{clock(s.at)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {!!error && (
          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: '#a62b25', marginTop: 14, textAlign: 'center' }}>
            {error}
          </Text>
        )}
      </ScrollView>

      {/* the committed action */}
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 34 + lift }}>
        {/* A TAP, as v2 draws it — and as joining a line now is. Both used to be
            hold-to-confirm; the design changed both together, so the two
            actions with the same consequence still carry the same weight. The
            line under the button says what the commitment is. */}
        <TouchableOpacity
          onPress={schedule}
          disabled={!joinAt || busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !joinAt || busy, busy }}
          style={{
            height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: D.accent, opacity: joinAt ? 1 : 0.5,
          }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ fontFamily: font.semibold, fontSize: 16, color: '#fff' }}>
              {joinAt ? `Schedule for ${clock(joinAt)}` : 'Pick a time with history'}
            </Text>
          )}
        </TouchableOpacity>
        {!!joinAt && (
          <Text style={{ textAlign: 'center', fontFamily: font.medium, fontSize: 12, color: '#8a94a6', marginTop: 10 }}>
            Free to cancel until {clock(joinAt)}. Branch no-show rules apply.
          </Text>
        )}
      </View>
    </View>
  );
}
