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
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import HoldButton from '../../components/HoldButton';
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
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user } = useAuth();
  const premium = Boolean(Number(user?.is_premium || 0));

  const { businessId, branchId, branchName, serviceId, serviceName, targetDow, targetHour } = route.params ?? ({} as any);

  /** The three arrival options, around the hour the caller suggested. */
  const baseHour = typeof targetHour === 'number' ? targetHour : 11;
  const hourOptions = useMemo(
    () => [baseHour, baseHour + 3, baseHour + 4].filter((h) => h >= 7 && h <= 18),
    [baseHour],
  );

  /** The date those hours land on — the next occurrence of the chosen weekday. */
  const dateFor = (hour: number) => {
    const now = new Date();
    const want = typeof targetDow === 'number' ? targetDow : now.getDay();
    const delta = (want - now.getDay() + 7) % 7;
    const d = new Date(now);
    d.setDate(now.getDate() + delta);
    d.setHours(hour, 0, 0, 0);
    /* If that moment has already passed today, it means next week. */
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    return d;
  };

  const [hour, setHour] = useState<number>(hourOptions[0] ?? 11);
  const [travel, setTravel] = useState<number>(25);
  const [letPass, setLetPass] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /* Bumped on failure so the hold ring returns to empty rather than sitting
     complete over an error. */
  const [resetTick, setResetTick] = useState(0);

  /* Quotes for all three chips at once, so the labels are real before anybody
     chooses. They come from the server because the prediction lives there and
     must match what the scheduler will actually use. */
  const quotes = useQuery({
    queryKey: ['helper-quotes', branchId, serviceId, hourOptions.join(','), targetDow],
    queryFn: async () => {
      const out: Record<number, number | null> = {};
      await Promise.all(hourOptions.map(async (h) => {
        try {
          const r = await api.post<{ predicted_wait_minutes: number | null }>(
            '/line-helper/quote',
            { branch_id: branchId, service_id: serviceId, target_served_at: dateFor(h).toISOString() },
          );
          out[h] = r.predicted_wait_minutes;
        } catch { out[h] = null; }
      }));
      return out;
    },
    enabled: Boolean(premium && branchId && serviceId && hourOptions.length),
    staleTime: 1000 * 60 * 10,
  });

  const waitFor = (h: number) => quotes.data?.[h] ?? null;
  const chosenWait = waitFor(hour);
  const target = dateFor(hour);
  const joinAt = chosenWait === null ? null : new Date(target.getTime() - chosenWait * 60000);
  const leaveAt = new Date(target.getTime() - travel * 60000);

  /* If the pre-selected hour turns out to have no history, move to one that
     does rather than leaving the primary button disabled with no explanation. */
  useEffect(() => {
    if (!quotes.data) return;
    if (waitFor(hour) !== null) return;
    const usable = hourOptions.find((h) => quotes.data?.[h] !== null);
    if (usable !== undefined) setHour(usable);
  }, [quotes.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => {
    if (!joinAt) return [];
    return [
      { label: 'Helper joins the line', at: joinAt, dot: D.accentBright },
      { label: 'You leave home', at: leaveAt, dot: D.onDarkAccent },
      { label: 'You arrive and check in', at: new Date(target.getTime() - 2 * 60000), dot: 'rgba(255,255,255,.35)' },
      { label: 'Called to counter', at: target, dot: '#3fd07f' },
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
      setResetTick((n) => n + 1);
    } finally { setBusy(false); }
  };

  if (!premium) {
    return (
      <View style={{ flex: 1, backgroundColor: D.bg, paddingTop: topPad }}>
        <View style={{ padding: 22 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: D.surface, borderWidth: 1, borderColor: D.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={D.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 24, color: D.ink, marginTop: 20, letterSpacing: -0.6 }}>
            Line Helper is part of Premium
          </Text>
          <Text style={{ fontFamily: font.medium, fontSize: 14, color: D.sub, marginTop: 10, lineHeight: 21 }}>
            It joins the line for you at the time you agree, and tells you when to leave home.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: D.surface, borderWidth: 1, borderColor: D.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color={D.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: D.ink }}>Line Helper</Text>
          <View style={{ width: 44 }} />
        </View>

        <Text style={{ fontSize: 28, lineHeight: 32, letterSpacing: -0.8, marginBottom: 6 }}>
          <Text style={{ fontFamily: font.extra, color: D.ink }}>Lyne joins the line </Text>
          <Text style={{ fontFamily: font.medium, color: D.sub }}>at the time you agree.</Text>
        </Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: D.muted, marginBottom: 18 }}>
          {target.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })} · {branchName || 'this branch'} · {serviceName || 'this service'}
        </Text>

        <View style={{ backgroundColor: D.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: D.lineSoft }}>
          <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: D.ink, marginBottom: 10 }}>I want to be served around</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {hourOptions.map((h) => {
              const on = h === hour;
              const w = waitFor(h);
              const usable = w !== null;
              return (
                <TouchableOpacity
                  key={h}
                  disabled={!usable}
                  onPress={() => setHour(h)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: !usable }}
                  style={{
                    flex: 1, borderRadius: 15, paddingVertical: 10, alignItems: 'center',
                    backgroundColor: on ? D.ink : D.surface,
                    borderWidth: 1, borderColor: on ? D.ink : D.line,
                    opacity: usable ? 1 : 0.5,
                  }}
                >
                  <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: on ? '#fff' : D.ink }}>
                    {clock(dateFor(h))}
                  </Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 10, marginTop: 2, color: on ? 'rgba(255,255,255,.7)' : D.muted }}>
                    {quotes.isLoading ? '…' : usable ? `~${w}m wait` : 'no history'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: D.ink, marginTop: 16, marginBottom: 10 }}>My travel time</Text>
          <View style={{ flexDirection: 'row', gap: 6, backgroundColor: '#f2f4f8', borderRadius: 14, padding: 4 }}>
            {TRAVEL.map((t) => {
              const on = t === travel;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setTravel(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1, alignItems: 'center', borderRadius: 11, paddingVertical: 9,
                    backgroundColor: on ? D.surface : 'transparent',
                    shadowColor: '#000', shadowOpacity: on ? 0.08 : 0,
                    shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
                    elevation: on ? 2 : 0,
                  }}
                >
                  <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: on ? D.ink : D.muted }}>{t} min</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* The fairness toggle. */}
          <TouchableOpacity
            onPress={() => setLetPass((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: letPass }}
            accessibilityLabel="Let people pass if I'm late. Keeps your place for up to 3 turns."
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: D.ink }}>Let people pass if I&rsquo;m late</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 11, color: D.muted, marginTop: 2 }}>
                Keeps your place for up to 3 turns
              </Text>
            </View>
            <View style={{
              width: 46, height: 28, borderRadius: 14, padding: 3,
              backgroundColor: letPass ? D.accent : '#d3d8e0',
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
            <Text style={{ fontFamily: font.semibold, fontSize: 11, color: D.warmInk, marginTop: 10, lineHeight: 16 }}>
              With this off, your place is held rigidly — and if you are not there when you are called, the branch&rsquo;s normal no-show rules apply straight away.
            </Text>
          )}
        </View>

        {/* YOUR PLAN */}
        <View style={{ backgroundColor: D.ink, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18, marginTop: 12 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 10.5, letterSpacing: 0.6, color: 'rgba(255,255,255,.55)', marginBottom: 12 }}>
            YOUR PLAN
          </Text>
          {quotes.isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : !joinAt ? (
            <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 18 }}>
              There is not enough history for that slot yet, so a helper would be guessing at when to join. Pick another time.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {steps.map((s) => (
                <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.dot }} />
                  <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 13, color: 'rgba(255,255,255,.85)' }}>{s.label}</Text>
                  <Text style={{ fontFamily: font.extra, fontSize: 13, color: '#fff' }}>{clock(s.at)}</Text>
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
      <View style={{ position: 'absolute', left: 22, right: 22, bottom: 28 }}>
        {/* HOLD, not tap — the same gesture as joining a line, for the same
            reason. This commits you to a place in a real queue at a real time
            and the branch's no-show rules then apply to it, so it should take
            the same deliberate half-second that joining does. Two actions with
            the same consequence should not have different weights. */}
        <HoldButton
          label={joinAt ? `Hold to schedule for ${clock(joinAt)}` : 'Pick a time with history'}
          holdingLabel="Keep holding…"
          doneLabel="Scheduled"
          onComplete={schedule}
          disabled={!joinAt}
          busy={busy}
          resetSignal={resetTick}
        />
        {!!joinAt && (
          <Text style={{ textAlign: 'center', fontFamily: font.semibold, fontSize: 11.5, color: D.muted, marginTop: 10 }}>
            Cancel free until {clock(joinAt)} · the branch&rsquo;s no-show rules apply
          </Text>
        )}
      </View>
    </View>
  );
}
