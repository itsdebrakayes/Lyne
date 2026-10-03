/**
 * WeekPlannerScreen — screen 03 of the Predictive Insights design.
 *
 * Pick a day, see the whole of it: an hour-by-hour column with the peak block
 * and the quiet window drawn over it, and a bar at the bottom naming the one
 * slot worth aiming for and when to leave home for it.
 *
 * This is the calendar view the heatmap earns. The grid on screen 02 answers
 * "which hours are bad" across six days at once, which is a lot of information
 * and no decision; this takes one day and turns it into a plan.
 *
 * Ported from the design file. The two coloured blocks are absolutely
 * positioned over the hour rows at the design's 56px row pitch, which is what
 * makes them read as spans of time rather than as cards in a list.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { font } from '../../lib/theme';
import { D, RAMP, waitLevel, hourText } from '../../lib/predictiveDesign';
import { PREMIUM_TRIAL_ENABLED } from '../../lib/features';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';
import PremiumLock from '../../components/PremiumLock';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'WeekPlanner'>;

interface Cell { dow: number; hour: number; visits: number; avg_wait: number }
interface ServicePlan { service_id: string; service_name: string; grid?: Cell[] }
interface BestTimes { window_days: number; premium?: boolean; services: ServicePlan[] }

/** The design's row pitch. The blocks are placed against it, so it is one value. */
const ROW_H = 56;
/** Mon–Sat, as the design's strip has it. Sunday is not an agency day here. */
const STRIP_DOWS = [1, 2, 3, 4, 5, 6];

export default function WeekPlannerScreen() {
  const topPad = useTopPad(8);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user, refreshProfile } = useAuth();
  /* Two sources, and they can disagree for a moment. The user record flips the
     instant a trial starts; the cached response is still the free one until the
     refetch lands. Whichever says premium is enough to unlock — the record
     because entitlement is real, the payload because the data is already here.
     Reading only the record left the panel frosted over data it had; reading
     only the payload would leave it frosted until the network answered. */
  const entitled = Boolean(Number(user?.is_premium || 0));
  const { businessId, branchId, branchName } = route.params ?? ({} as any);

  const [serviceId, setServiceId] = useState<string | null>(route.params?.serviceId ?? null);
  /* Which week the strip is showing. The design draws a ▾ beside the date, and
     the day itself is already chosen by the strip below — so the one dimension
     left for that control is the week. It also makes the label honest: it used
     to read "Next week" as a hardcoded string no matter which dates were under
     it. The forecast does not change (the model is per-weekday over 90 days);
     the DATES do, which is what you need to actually plan the trip. */
  const [weekOffset, setWeekOffset] = useState(0);
  const [dow, setDow] = useState<number>(() => {
    const today = new Date().getDay();
    return STRIP_DOWS.includes(today) ? today : 1;
  });
  /* Having opened on a day the branch does not run — a traffic court on a
     Saturday — the screen showed its empty state as the FIRST thing, which
     reads as a broken screen rather than a closed day. Moves once, to the day
     with the most evidence behind it, and only when the chosen day has none. */
  const movedRef = React.useRef(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState('');

  const q = useQuery({
    queryKey: ['best-times', businessId, branchId, user?.id ?? 'anon'],
    queryFn: () => api.get<BestTimes>(`/predictions/best-times?business_id=${businessId}&branch_id=${branchId}`),
    enabled: Boolean(businessId && branchId),
    staleTime: 1000 * 60 * 15,
  });

  /* The banner's second line in the design reads "Leave home 25 min before to
     arrive on time". 25 is a number in a mock; writing it in would be inventing
     a figure and presenting it as this person's travel time, which is the same
     mistake as the fabricated branch stats. So it is read from their own
     habits — the travel time measured from the Line Helpers they have actually
     scheduled — and the line only claims it when it is real.

     Same queryKey and staleTime as PlanVisitScreen, so arriving here from that
     screen is a cache hit and not a second request. */
  const habits = useQuery({
    queryKey: ['for-you', user?.id ?? 'anon'],
    queryFn: () => api.get<{ personalised: boolean; habits?: { travel_minutes: number | null } }>('/predictions/for-you'),
    enabled: Boolean(user?.id && entitled),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  const travelMinutes = habits.data?.habits?.travel_minutes ?? null;

  const premium = entitled || Boolean(q.data?.premium);
  const services = q.data?.services ?? [];
  const service = useMemo(
    () => services.find((s) => s.service_id === serviceId) || services[0] || null,
    [services, serviceId],
  );
  const grid = service?.grid ?? [];

  /** The chosen day's hours, in order. */
  const dayHours = useMemo(
    () => grid.filter((c) => c.dow === dow).sort((a, b) => a.hour - b.hour),
    [grid, dow],
  );

  /**
   * The peak and quiet SPANS, found as the worst and best RUN of consecutive
   * hours rather than as single cells.
   *
   * A single worst hour is not a thing anybody can act on — "avoid 10am" leaves
   * you wondering about 11. The design draws blocks covering two hours each,
   * and two hours is also the honest unit: a queue does not get busy for sixty
   * minutes and then stop.
   */
  const spans = useMemo(() => {
    if (dayHours.length < 2) return { peak: null as null | { from: number; to: number; wait: number }, quiet: null as null | { from: number; to: number; wait: number } };
    let worst = { i: 0, avg: -1 };
    let best = { i: 0, avg: Number.POSITIVE_INFINITY };
    for (let i = 0; i < dayHours.length - 1; i += 1) {
      const avg = (dayHours[i].avg_wait + dayHours[i + 1].avg_wait) / 2;
      if (avg > worst.avg) worst = { i, avg };
      if (avg < best.avg) best = { i, avg };
    }
    const span = (x: { i: number; avg: number }) => ({
      from: dayHours[x.i].hour,
      to: dayHours[x.i + 1].hour + 1,
      wait: Math.round(x.avg),
    });
    return { peak: span(worst), quiet: span(best) };
  }, [dayHours]);

  /**
   * The dates on the strip, anchored to ONE week so they are contiguous.
   *
   * Computing each square as "the next occurrence of that weekday" looked right
   * and was not: on a Saturday it put Saturday at today's date and Monday to
   * Friday in the following week, so the strip read Mon 5 · Tue 6 · Wed 7 ·
   * Thu 8 · Fri 9 · Sat 3. Six days that are not a week.
   *
   * The design's strip is next week — 5 to 10 October — which is also the
   * useful answer: this screen is for planning a visit, and most of the current
   * week is already behind you by the time you look at it. So it anchors on the
   * Monday of next week and counts forward.
   */
  const weekStart = useMemo(() => {
    const now = new Date();
    const x = new Date(now);
    /* Days until the NEXT Monday; a Monday today means the Monday after. */
    const untilMonday = ((1 - now.getDay() + 7) % 7) || 7;
    x.setDate(now.getDate() + untilMonday);
    x.setHours(0, 0, 0, 0);
    return x;
  }, []);

  const dateFor = (d: number) => {
    const x = new Date(weekStart);
    /* STRIP_DOWS is Mon(1)…Sat(6), and weekStart is that Monday. */
    x.setDate(weekStart.getDate() + (d - 1) + weekOffset * 7);
    return x;
  };
  const chosenDate = dateFor(dow);

  const startTrial = async () => {
    try {
      setTrialBusy(true); setTrialError('');
      await api.post('/auth/start-trial', {});
      await refreshProfile();
      await q.refetch();
    } catch (e: any) {
      setTrialError(e?.message || 'That did not work. Try again in a moment.');
    } finally { setTrialBusy(false); }
  };

  React.useEffect(() => {
    if (movedRef.current || !grid.length || dayHours.length) return;
    const visitsByDow = new Map<number, number>();
    grid.forEach((c) => visitsByDow.set(c.dow, (visitsByDow.get(c.dow) || 0) + c.visits));
    const busiest = [...visitsByDow.entries()]
      .filter(([d]) => STRIP_DOWS.includes(d))
      .sort((a, b) => b[1] - a[1])[0];
    if (busiest) { movedRef.current = true; setDow(busiest[0]); }
  }, [grid, dayHours.length]);

  const rowIndexOf = (hour: number) => dayHours.findIndex((h) => h.hour === hour);

  return (
    <View style={{ flex: 1, backgroundColor: D.surface }}>
      {/* ── the light header block ── */}
      <View style={{ backgroundColor: D.bg, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: D.line, paddingTop: topPad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingBottom: 18 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button" accessibilityLabel="Go back"
            style={{
              width: 44, height: 44, borderRadius: 22, backgroundColor: D.surface,
              borderWidth: 1, borderColor: D.line, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={D.ink} />
          </TouchableOpacity>
          {/* The design's header line, and its ▾ does something: it moves the
              strip a week on and back. A chevron that opens nothing is the
              thing this app keeps being caught on. */}
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => (w === 0 ? 1 : 0))}
            accessibilityRole="button"
            accessibilityLabel={`${weekOffset === 0 ? 'This' : 'Next'} week. ${chosenDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}. Tap to show ${weekOffset === 0 ? 'next' : 'this'} week.`}
            style={{ flex: 1 }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: D.muted }}>
              {weekOffset === 0 ? 'This week' : 'Next week'} · {branchName || 'this branch'}
            </Text>
            <Text style={{ fontSize: 17, marginTop: 1 }}>
              <Text style={{ fontFamily: font.extra, color: D.ink }}>
                {chosenDate.getDate()} {chosenDate.toLocaleDateString([], { month: 'short' })}
              </Text>
              <Text style={{ fontFamily: font.medium, color: D.muted }}>
                {' '}{chosenDate.toLocaleDateString([], { weekday: 'long' })}
              </Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: D.muted }}>
                {' '}▾
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* the six-day strip */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 14 }}>
          {STRIP_DOWS.map((d) => {
            const on = d === dow;
            const dayCells = grid.filter((c) => c.dow === d);
            const best = dayCells.length ? Math.min(...dayCells.map((c) => c.avg_wait)) : null;
            const date = dateFor(d);
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDow(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${date.toLocaleDateString([], { weekday: 'long' })} ${date.getDate()}`}
                style={{ flex: 1, alignItems: 'center', gap: 8 }}
              >
                <Text style={{
                  fontFamily: on ? font.extra : font.semibold,
                  fontSize: 12.5, color: on ? D.ink : D.muted,
                }}>
                  {date.toLocaleDateString([], { weekday: 'short' })}
                </Text>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? D.ink : 'transparent',
                }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 15, color: on ? '#fff' : D.sub }}>
                    {date.getDate()}
                  </Text>
                </View>
                {/* The dot is the day's quietest hour on the ramp — the strip's
                    whole job is letting you pick a day without opening it. */}
                <View style={{
                  width: 7, height: 7, borderRadius: 4,
                  backgroundColor: best === null ? D.line : RAMP[waitLevel(best)],
                }} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {q.isLoading ? (
          <View style={{ padding: 22 }}><SkeletonRows count={6} /></View>
        ) : q.error ? (
          <View style={{ padding: 22 }}>
            <ErrorCard title="Week unavailable"
              message="This branch's pattern could not be loaded."
              onRetry={() => q.refetch()} />
          </View>
        ) : !premium ? (
          <View style={{ padding: 22 }}>
            <PremiumLock
              locked
              radius={20}
              headline="Plan any day of the week"
              error={trialError}
              trialBusy={trialBusy}
              onStartTrial={PREMIUM_TRIAL_ENABLED ? startTrial : undefined}
              unavailableNote={PREMIUM_TRIAL_ENABLED ? undefined : 'Premium arrives with the first App Store release.'}
            >
              <View>
                {Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} style={{ flexDirection: 'row', height: ROW_H, borderTopWidth: 1, borderTopColor: D.lineSoft, alignItems: 'flex-start' }}>
                    <View style={{ width: 58, paddingTop: 8, alignItems: 'center' }}>
                      <View style={{ width: 18, height: 13, borderRadius: 4, backgroundColor: D.lineSoft }} />
                    </View>
                    <View style={{ flex: 1, paddingTop: 10, alignItems: 'flex-end', paddingRight: 18 }}>
                      <View style={{ width: 34, height: 9, borderRadius: 4, backgroundColor: D.lineSoft }} />
                    </View>
                  </View>
                ))}
              </View>
            </PremiumLock>
          </View>
        ) : !dayHours.length ? (
          <View style={{ padding: 22 }}>
            <EmptyState icon="clock" title="No pattern for that day"
              body="This branch has no recorded visits for that weekday yet. Pick another day."
              actionLabel="Back to busy times" onAction={() => navigation.goBack()} />
          </View>
        ) : (
          <View style={{ position: 'relative', paddingRight: 18, marginTop: 8 }}>
            {dayHours.map((h) => (
              <View key={h.hour} style={{ flexDirection: 'row', height: ROW_H, borderTopWidth: 1, borderTopColor: D.lineSoft }}>
                <View style={{ width: 58, paddingTop: 8, alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: D.sub }}>
                    {h.hour > 12 ? h.hour - 12 : h.hour}
                  </Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: D.faint }}>
                    {h.hour >= 12 ? 'PM' : 'AM'}
                  </Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end', paddingTop: 8 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: D.faint }}>
                    ~{Math.round(h.avg_wait)}m
                  </Text>
                </View>
              </View>
            ))}

            {/* Peak — drawn over the rows it covers, at the row pitch. */}
            {spans.peak && rowIndexOf(spans.peak.from) >= 0 && (
              <View
                accessibilityRole="summary"
                accessibilityLabel={`Peak hours, ${hourText(spans.peak.from)} to ${hourText(spans.peak.to)}, up to ${spans.peak.wait} minutes`}
                style={{
                  position: 'absolute', left: 62, right: 58,
                  top: rowIndexOf(spans.peak.from) * ROW_H + 4,
                  height: ROW_H * 2 - 8, borderRadius: 18, backgroundColor: D.warmBg,
                  paddingVertical: 13, paddingHorizontal: 15, justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ fontFamily: font.extra, fontSize: 15, color: D.ink }}>Peak hours</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: D.warmInk, marginTop: 2 }}>
                    Avoid · up to {spans.peak.wait} min wait
                  </Text>
                </View>
                <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: D.muted }}>
                  {hourText(spans.peak.from)} – {hourText(spans.peak.to)}
                </Text>
              </View>
            )}

            {/* Quiet — the one with the action on it. */}
            {spans.quiet && rowIndexOf(spans.quiet.from) >= 0 && (
              <View
                accessibilityRole="summary"
                accessibilityLabel={`Quiet window, ${hourText(spans.quiet.from)} to ${hourText(spans.quiet.to)}, about ${spans.quiet.wait} minutes`}
                style={{
                  position: 'absolute', left: 62, right: 58,
                  top: rowIndexOf(spans.quiet.from) * ROW_H + 4,
                  height: ROW_H * 2 - 8, borderRadius: 18, backgroundColor: D.coolBg,
                  paddingVertical: 13, paddingHorizontal: 15, justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 15, color: D.ink }}>Quiet window</Text>
                    <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: D.coolInk, marginTop: 2 }}>
                      Best of the day · ~{spans.quiet.wait} min
                    </Text>
                  </View>
                  <View style={{
                    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: D.accent,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="checkmark" size={14} color={D.accent} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: D.sub }}>
                    {hourText(spans.quiet.from)} – {hourText(spans.quiet.to)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('LineHelper', {
                      businessId, branchId, branchName,
                      serviceId: service?.service_id, serviceName: service?.service_name,
                      targetDow: dow, targetHour: spans.quiet!.from,
                    })}
                    accessibilityRole="button"
                    style={{ backgroundColor: D.accent, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9 }}
                  >
                    <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: '#fff' }}>Hold my place</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* the bottom banner */}
      {premium && spans.quiet && (
        <TouchableOpacity
          onPress={() => navigation.navigate('LineHelper', {
            businessId, branchId, branchName,
            serviceId: service?.service_id, serviceName: service?.service_name,
            targetDow: dow, targetHour: spans.quiet!.from,
          })}
          accessibilityRole="button"
          style={{
            position: 'absolute', left: 16, right: 16, bottom: 22,
            backgroundColor: D.ink, borderRadius: 21,
            paddingVertical: 13, paddingHorizontal: 17,
            flexDirection: 'row', alignItems: 'center', gap: 12,
            shadowColor: D.ink, shadowOpacity: 0.5, shadowRadius: 30,
            shadowOffset: { width: 0, height: 14 }, elevation: 10,
          }}
        >
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: D.good }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 13, color: '#fff' }}>
              {chosenDate.toLocaleDateString([], { weekday: 'long' })} {hourText(spans.quiet.from)} is your best bet · ~{spans.quiet.wait} min
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,.55)' }}>
              {travelMinutes
                ? `Leave home ${travelMinutes} min before to arrive on time`
                : 'Tap to have Lyne hold your place'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={D.onDarkAccent} />
        </TouchableOpacity>
      )}
    </View>
  );
}
