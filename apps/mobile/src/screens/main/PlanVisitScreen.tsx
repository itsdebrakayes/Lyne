/**
 * PlanVisitScreen — "Plan your visit" (Smart Timing).
 *
 * Best time to visit, per service, per branch — computed from the last 90
 * days of real visit history. Free tier sees the branch-level headline and a
 * locked preview; Lyne Premium unlocks the per-service planner. The trial
 * button flips the flag server-side so both states are real, not mocked.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, initials } from '../../lib/theme';
import { PREMIUM_TRIAL_ENABLED } from '../../lib/features';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';
import { PremiumBadge } from '../../components/PremiumBadge';
import BusyHeatmap, { HeatCell } from '../../components/BusyHeatmap';
import TodayForecast, { ForecastHour } from '../../components/TodayForecast';
import { D } from '../../lib/predictiveDesign';
import PremiumLock from '../../components/PremiumLock';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Plan'>;

interface BestSlot { dow: number; hour: number; visits: number; avg_wait: number; day_name: string; hour_label: string }
interface ForYouSlot {
  service_id: string; service_name: string;
  dow: number; day_name: string; hour: number; hour_label: string;
  avg_wait: number; visits: number; matches_your_hours: boolean;
}
interface ForYou {
  personalised: boolean;
  home_branch?: { branch_id: string; branch_name: string; business_id: string; visits: number } | null;
  top_services?: Array<{ service_id: string; service_name: string; visits: number }>;
  habits?: { total_visits: number; preferred_hours: number[]; travel_minutes: number | null };
  best?: ForYouSlot | null;
  worst?: ForYouSlot | null;
}

interface TodayPlan {
  dow: number;
  day_name: string;
  is_today?: boolean;
  best: BestSlot | null;
  hours: ForecastHour[];
}
interface WeekDay { dow: number; day_name: string; avg_wait: number | null; level: 0 | 1 | 2 | 3 }
interface ServicePlan {
  service_id: string;
  service_name: string;
  /** Day x hour cells from the API — see components/BusyHeatmap.tsx. */
  grid?: HeatCell[];
  best?: BestSlot | null;
  busiest?: BestSlot | null;
  quietest_day?: { dow: number; day_name: string; avg_wait: number } | null;
  week: WeekDay[];
}
interface BestTimes {
  window_days: number;
  branch_best?: BestSlot | null;
  /** Today's hourly shape — free, see the note in routes/predictions.js. */
  today?: TodayPlan | null;
  /** The server says so explicitly rather than leaving it to be inferred. */
  premium?: boolean;
  services: ServicePlan[];
}

/** "2 PM" given 14 — the end of the best-time window on the forecast card. */
const nextHourLabel = (hour: number) => {
  const h = (hour + 1) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
};

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEVEL_WORD: Record<number, string> = { 1: 'Quiet', 2: 'Busy', 3: 'Peak' };
const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;

const LEVEL_DOT: Record<number, string> = { 0: colors.border, 1: colors.light, 2: colors.moderate, 3: colors.busy };
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function WeekStrip({ week, compact = false }: { week?: WeekDay[]; compact?: boolean }) {
  /* Optional, and empty renders nothing. `week` only exists on the premium
     payload, and there is a real window where the user record says premium
     while the cached response is still the free one — the moment a trial
     starts. `week.map` threw there and took the whole screen white. */
  if (!week?.length) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: compact ? 0 : 12 }}>
      {week.map(day => (
        <View key={day.dow} style={{ alignItems: 'center', gap: 5, flex: 1 }}>
          <View style={{ width: compact ? 10 : 13, height: compact ? 10 : 13, borderRadius: 7, backgroundColor: LEVEL_DOT[day.level] }} />
          <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: colors.muted }}>{DAY_SHORT[day.dow]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PlanVisitScreen() {
  const topPad = useTopPad(18);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user, refreshProfile } = useAuth();
  /* Entitlement comes from the server record and nothing else. This used to be
     `|| preview`, where `preview` was a device-local toggle anybody could flip
     in Settings — it unlocked the paid planner for free, and an App Store
     reviewer would have found it in the first minute. */
  const premium = Boolean(Number(user?.is_premium || 0));
  const [trialBusy, setTrialBusy] = useState(false);
  const [openHeatmap, setOpenHeatmap] = useState<string | null>(null);
  const [pickedCell, setPickedCell] = useState<HeatCell | null>(null);
  const [trialError, setTrialError] = useState('');

  const { data: branches = [] } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(route.params?.branchId || null);
  const branch = useMemo(
    () => branches.find(b => b.id === selectedId) || branches.find(b => Number(b.open_queues) > 0) || branches[0],
    [branches, selectedId],
  );

  const bestTimes = useQuery({
    /* user.id in the key: without it, signing in reuses the cached anonymous
       response and the planner stays locked until the cache expires. */
    queryKey: ['best-times', branch?.business_id, branch?.id, user?.id ?? 'anon'],
    /* AUTHENTICATED, where it used to pass `false` to suppress the token. The
       endpoint decides entitlement from the caller now, so an anonymous request
       gets the free response — which would have left a paying customer looking
       at the locked panel. The endpoint still answers without a token; it
       simply answers less. */
    queryFn: () => api.get<BestTimes>(`/predictions/best-times?business_id=${branch!.business_id}&branch_id=${branch!.id}`),
    enabled: Boolean(branch),
    staleTime: 1000 * 60 * 15,
  });
  /* THEIR habits, not the branch's. /for-you reads the person's own finished
     visits — where they actually go, what they actually do there, the hours
     they turn up in, and the travel time measured from the Line Helpers they
     have scheduled — and recommends against that. It 402s for a free account
     and says so plainly when it has not seen enough visits yet, so the
     branch-level rows below stay the fallback rather than the pretence. */
  const forYou = useQuery({
    queryKey: ['for-you', user?.id ?? 'anon'],
    queryFn: () => api.get<ForYou>('/predictions/for-you'),
    enabled: Boolean(user?.id && premium),
    staleTime: 1000 * 60 * 30,
    retry: false,
  });
  const mine = forYou.data?.personalised ? forYou.data : null;

  const plan = bestTimes.data;
  /* What the RESPONSE IN HAND is, which is not always what the user record
     says. `premium` above drives the badge and the trial button; this drives
     the layout. */
  const planIsPremium = Boolean(plan?.premium ?? plan?.services?.some((s) => s.week || s.grid));

  const startTrial = async () => {
    try {
      setTrialBusy(true);
      setTrialError('');
      await api.post('/auth/start-trial', {});
      await refreshProfile();
    } catch (caught: unknown) {
      setTrialError(caught instanceof Error ? caught.message : 'Could not start your trial.');
    } finally {
      setTrialBusy(false);
    }
  };


  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Plan your visit</Text>
          <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
            {premium && <PremiumBadge size="sm" />}
          </View>
        </View>

        <Text style={{ fontFamily: font.extra, fontSize: 11, color: D.eyebrow, letterSpacing: 1.6 }}>SMART TIMING</Text>
        {/* 30/1.12/-0.9 and no hard line break — the design lets it wrap, which
            is what keeps it from breaking in the wrong place on a small phone.
            The tail is 500 weight in `sub`, not the same weight as the lead. */}
        <Text style={{ fontSize: 30, lineHeight: 33.6, letterSpacing: -0.9, marginTop: 8, marginBottom: 20 }}>
          <Text style={{ fontFamily: font.extra, color: D.ink }}>Beat the line </Text>
          <Text style={{ fontFamily: font.medium, color: D.sub }}>before you leave home.</Text>
        </Text>

        {/* branch chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 20 }}>
          {branches.map(b => {
            const on = branch?.id === b.id;
            return (
              <TouchableOpacity key={b.id} onPress={() => setSelectedId(b.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: on ? colors.dark : colors.surface, borderWidth: 1, borderColor: on ? colors.dark : colors.border, borderRadius: 17, paddingVertical: 11, paddingHorizontal: 15 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 11, color: on ? D.onDarkAccent : D.muted }}>{b.business_slug?.toUpperCase() || initials(b.business_name)}</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: on ? '#fff' : colors.ink }}>{b.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {bestTimes.isLoading && <SkeletonRows count={4} />}
        {!!bestTimes.error && !bestTimes.isLoading && (
          <ErrorCard title="Timing data unavailable" message="Best-time recommendations could not be loaded for this branch." onRetry={() => bestTimes.refetch()} />
        )}

        {plan && (
          <>
            {/* TODAY, HOUR BY HOUR — screen 01 of the Predictive Insights
                design, and free for everyone.

                What was here answered "which DAY is quietest at this branch",
                which is a planning question. The one almost everybody opening
                this screen actually has is "when should I go today", and a row
                of bars with NOW and BEST on it answers that at a glance with
                nothing to read. The day-level answer is still below, per
                service, where it belongs.

                Falls back to the old headline when the branch has no history
                for today's weekday — a Sunday at a branch that never opens on
                Sunday is a real case, not a failure. */}
            {plan.today?.hours?.length ? (
              <TodayForecast
                dayName={plan.today.day_name}
                isToday={plan.today.is_today !== false}
                bestLabel={plan.today.best
                  ? `${plan.today.best.hour_label} – ${nextHourLabel(plan.today.best.hour)}`
                  : undefined}
                bestWait={plan.today.best?.avg_wait}
                hours={plan.today.hours}
              />
            ) : (
              <View style={{ backgroundColor: colors.dark, borderRadius: 26, padding: 20, ...shadow.hero }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="time-outline" size={21} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: 'rgba(255,255,255,.5)', letterSpacing: 0.6 }}>BEST TIME AT {branch?.name?.toUpperCase() || 'THIS BRANCH'}</Text>
                    {plan.branch_best ? (
                      <Text style={{ fontFamily: font.extra, fontSize: 19, color: '#fff', marginTop: 3 }}>{plan.branch_best.day_name}s · {plan.branch_best.hour_label}</Text>
                    ) : (
                      <Text style={{ fontFamily: font.extra, fontSize: 16, color: '#fff', marginTop: 3 }}>Not enough visits yet</Text>
                    )}
                  </View>
                  {plan.branch_best && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 22, color: colors.accent }}>{Math.round(plan.branch_best.avg_wait)}<Text style={{ fontSize: 12 }}>m</Text></Text>
                      <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: 'rgba(255,255,255,.5)', marginTop: 3 }}>typical wait</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.45)', marginTop: 14 }}>From the last {plan.window_days} days of real visits · updates continuously</Text>
              </View>
            )}

            {/* A branch with no served history yet has nothing to forecast from.
                That is a real state on day one of a pilot, and saying so beats
                rendering an empty "Best time by service" heading over nothing. */}
            {plan.services.length === 0 ? (
              <EmptyState
                icon="clock"
                title="Not enough visits yet"
                body="Smart Timing needs a few days of real visits at this branch before it can tell you when it's quiet. Check back shortly."
                actionLabel="See live waits instead"
                onAction={() => navigation.goBack()}
              />
            ) : (
            <>
            {/* ── FOR YOU ──
                The design's recommendation rows, which this screen did not
                have. The forecast above answers "when today"; these answer
                "what should I actually do this week" — one slot to aim for and
                one to avoid, picked across every service at the branch.

                They are derived, not decorative: the first is the lowest
                well-evidenced best-time of any service here, the second the
                highest busiest-time. The second needs `busiest`, which is a
                premium field, so a free customer sees the row they can act on
                and not the one they cannot. */}
            {(() => {
              /* PERSONAL FIRST. When /for-you knows this person's habits its
                 rows replace the branch-level ones entirely — they are about
                 the service they actually use at the branch they actually go
                 to, and they carry the reason. The branch rows remain the
                 fallback for a new customer, which is the honest thing to show
                 somebody we have not learned anything about yet. */
              const personalAim = mine?.best ?? null;
              const personalAvoid = mine?.worst ?? null;

              const withBest = plan.services.filter((x) => x.best);
              if (!withBest.length && !personalAim) return null;
              const aim = [...withBest].sort((a, b) => a.best!.avg_wait - b.best!.avg_wait)[0];
              const withBusy = plan.services.filter((x) => x.busiest);
              const avoid = withBusy.length
                ? [...withBusy].sort((a, b) => b.busiest!.avg_wait - a.busiest!.avg_wait)[0]
                : null;

              const Row = ({
                chip, chipBg, chipInk, title, sub, onPress, last,
              }: {
                chip: string; chipBg: string; chipInk: string;
                title: string; sub: string; onPress: () => void; last?: boolean;
              }) => (
                <TouchableOpacity
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}. ${sub}`}
                  style={{
                    flexDirection: 'row', gap: 12, alignItems: 'center',
                    paddingVertical: 14, paddingHorizontal: 16,
                    borderBottomWidth: last ? 0 : 1, borderBottomColor: D.lineSoft,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 12, backgroundColor: chipBg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 12, color: chipInk }}>{chip}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 13.5, color: D.ink }}>{title}</Text>
                    <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: D.muted, marginTop: 2 }}>{sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={chipInk} />
                </TouchableOpacity>
              );

              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 17, color: D.ink }}>For you</Text>
                      {/* Says WHY these are the rows — "for you" is a claim, and
                          a claim with its basis attached is the difference
                          between a recommendation and a horoscope. */}
                      {mine?.habits && (
                        <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: D.muted, marginTop: 2 }}>
                          From your {mine.habits.total_visits} visit{mine.habits.total_visits === 1 ? '' : 's'}
                          {mine.home_branch ? ` to ${mine.home_branch.branch_name}` : ''}
                          {mine.habits.travel_minutes ? ` · ${mine.habits.travel_minutes} min away` : ''}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => branch && navigation.navigate('BusyTimes', {
                        businessId: branch.business_id, branchId: branch.id, branchName: branch.name,
                        serviceId: aim.service_id,
                      })}
                      accessibilityRole="button"
                    >
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: D.accent }}>See heatmap →</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ backgroundColor: D.surface, borderRadius: 22, borderWidth: 1, borderColor: D.lineSoft, overflow: 'hidden' }}>
                    {personalAim ? (
                      <Row
                        chip={personalAim.day_name.slice(0, 2)}
                        chipBg={D.coolBg} chipInk={D.coolInk}
                        title={`${personalAim.service_name}: ${personalAim.day_name}, ${personalAim.hour_label.replace(':00', '')}`}
                        sub={personalAim.matches_your_hours
                          ? `~${Math.round(personalAim.avg_wait)} min — and it is when you usually go`
                          : `~${Math.round(personalAim.avg_wait)} min, your quietest option`}
                        onPress={() => mine?.home_branch && navigation.navigate('LineHelper', {
                          businessId: mine.home_branch.business_id,
                          branchId: mine.home_branch.branch_id,
                          branchName: mine.home_branch.branch_name,
                          serviceId: personalAim.service_id,
                          serviceName: personalAim.service_name,
                          targetDow: personalAim.dow,
                          targetHour: personalAim.hour,
                        })}
                        last={!personalAvoid}
                      />
                    ) : (
                      <Row
                        chip={aim.best!.day_name.slice(0, 2)}
                        chipBg={D.coolBg} chipInk={D.coolInk}
                        title={`${aim.service_name}: ${aim.best!.day_name}, ${aim.best!.hour_label.replace(':00', '')}`}
                        sub={`~${Math.round(aim.best!.avg_wait)} min, quietest slot this week`}
                        onPress={() => branch && navigation.navigate('WeekPlanner', {
                          businessId: branch.business_id, branchId: branch.id, branchName: branch.name,
                          serviceId: aim.service_id,
                        })}
                        last={!avoid}
                      />
                    )}
                    {personalAvoid ? (
                      <Row
                        chip={personalAvoid.day_name.slice(0, 2)}
                        chipBg={D.warmBg} chipInk={D.warmInk}
                        title={`Skip ${personalAvoid.day_name} ${personalAvoid.hour_label.replace(':00', '')}`}
                        sub={`${personalAvoid.service_name} averages ${Math.round(personalAvoid.avg_wait)} min then`}
                        onPress={() => mine?.home_branch && navigation.navigate('BusyTimes', {
                          businessId: mine.home_branch.business_id,
                          branchId: mine.home_branch.branch_id,
                          branchName: mine.home_branch.branch_name,
                          serviceId: personalAvoid.service_id,
                        })}
                        last
                      />
                    ) : avoid ? (
                      <Row
                        chip={avoid.busiest!.day_name.slice(0, 2)}
                        chipBg={D.warmBg} chipInk={D.warmInk}
                        title={`Skip ${avoid.busiest!.day_name} ${avoid.busiest!.hour_label.replace(':00', '')}`}
                        sub={`Averages ${Math.round(avoid.busiest!.avg_wait)} min, the week's peak`}
                        onPress={() => branch && navigation.navigate('BusyTimes', {
                          businessId: branch.business_id, branchId: branch.id, branchName: branch.name,
                          serviceId: avoid.service_id,
                        })}
                        last
                      />
                    ) : null}
                  </View>
                </>
              );
            })()}

            {/* per-service planner */}
            <View style={[t.sectionRow, { marginTop: 22 }]}>
              <Text style={t.section}>Best time by service</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted }}>{plan.services.length} services</Text>
            </View>

            {/* `planIsPremium`, not `premium`. The user record and the cached
                response can disagree for a moment — starting a trial flips the
                record immediately while the refetch is still in flight — and
                rendering the premium layout against a free payload is what
                blanked this screen. The server states what the payload IS, so
                the layout follows that and converges when the refetch lands. */}
            {planIsPremium ? (
              <View style={{ gap: 14 }}>
                {plan.services.map(service => (
                  <View key={service.service_id} style={[t.card, { padding: 18, borderRadius: 24 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{service.service_name}</Text>
                      {service.best && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSoft, borderRadius: 13, paddingVertical: 6, paddingHorizontal: 11 }}>
                          <Ionicons name="time" size={12} color="#1f9d5f" />
                          <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.successInk }}>{service.best.day_name.slice(0, 3)} · {service.best.hour_label}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
                      {service.best && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted }}>~{Math.round(service.best.avg_wait)}m at the best time</Text>}
                      {service.busiest && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.busy }}>Avoid {service.busiest.day_name.slice(0, 3)} {service.busiest.hour_label}</Text>}
                    </View>
                    <WeekStrip week={service.week} />

                    {/* The heatmap is opt-in per service. Sixty-three cells is
                        a lot of screen, and seven services expanded at once
                        turns a plan into a scroll. The week strip above already
                        answers "which day"; this answers "which hour", which is
                        a question you only ask once you have picked the day. */}
                    {!!service.grid?.length && (
                      <>
                        <TouchableOpacity
                          onPress={() => setOpenHeatmap(openHeatmap === service.service_id ? null : service.service_id)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: openHeatmap === service.service_id }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14 }}
                        >
                          <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.accent }}>
                            {openHeatmap === service.service_id ? 'Hide heatmap' : 'See heatmap'}
                          </Text>
                          <Ionicons
                            name={openHeatmap === service.service_id ? 'chevron-up' : 'chevron-forward'}
                            size={13}
                            color={colors.accent}
                          />
                        </TouchableOpacity>

                        {openHeatmap === service.service_id && (
                          <View style={{ marginTop: 14 }}>
                            <BusyHeatmap grid={service.grid} onSelect={setPickedCell} />
                            {pickedCell && (
                              <View style={{ marginTop: 14, backgroundColor: colors.surfaceAlt, borderRadius: 16, padding: 14 }}>
                                <Text style={{ fontFamily: font.semibold, fontSize: 11, color: colors.muted, letterSpacing: 0.6 }}>
                                  {DAY_FULL[pickedCell.dow].toUpperCase()}S · {hourLabel(pickedCell.hour)}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                                  <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>
                                    {LEVEL_WORD[pickedCell.level]}
                                  </Text>
                                  <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accent }}>
                                    ~{Math.round(pickedCell.avg_wait)}m
                                  </Text>
                                </View>
                                {/* The sample size is shown because it is the
                                    difference between a finding and a guess —
                                    and the reader is entitled to judge it. */}
                                <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginTop: 3 }}>
                                  Based on {pickedCell.visits} visits
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    )}
                    <TouchableOpacity
                      onPress={() => branch && navigation.navigate('JoinQueue', { businessId: branch.business_id, branchId: branch.id, serviceId: service.service_id, serviceName: service.service_name })}
                      style={{ marginTop: 14, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 11, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink }}>Join this line now →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              /* FREE TIER, tiered the way the design tiers it.

                 The service and its best time are NOT behind the paywall. The
                 locked panel in Predictive Insights covers the heatmap, and
                 everything above it stays readable — so a free customer gets a
                 real answer ("Friday 1 PM, about 1 minute") and what they pay
                 for is the depth behind it.

                 The first version of this blurred the whole list, which hid the
                 one thing the screen is named after. A paywall that withholds
                 the headline does not sell the product, it hides it. */
              <View style={{ gap: 14 }}>
                {plan.services.map(service => (
                  <View key={service.service_id} style={[t.card, { padding: 18, borderRadius: 24 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{service.service_name}</Text>
                      {service.best && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSoft, borderRadius: 13, paddingVertical: 6, paddingHorizontal: 11 }}>
                          <Ionicons name="time" size={12} color={colors.successInk} />
                          <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.successInk }}>{service.best.day_name.slice(0, 3)} · {service.best.hour_label}</Text>
                        </View>
                      )}
                    </View>
                    {service.best && (
                      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginTop: 10 }}>
                        ~{Math.round(service.best.avg_wait)}m at the best time
                      </Text>
                    )}

                    {/* The depth — the seven-day strip and the hour grid — is
                        what the subscription buys, so this is where the frost
                        goes. Rendered at the real height so the card does not
                        change shape when somebody subscribes. */}
                    <View style={{ marginTop: 14 }}>
                      <PremiumLock
                        locked
                        radius={16}
                        headline="See every hour of every day"
                        error={trialError}
                        trialBusy={trialBusy}
                        onStartTrial={PREMIUM_TRIAL_ENABLED ? startTrial : undefined}
                        unavailableNote={PREMIUM_TRIAL_ENABLED ? undefined
                          : 'Premium arrives with the first App Store release.'}
                      >
                        <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 10 }}>
                          {[0, 1, 2, 3, 4, 5, 6].map(i => (
                            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                              <View style={{ width: '100%', height: 38, borderRadius: 9, backgroundColor: i % 3 === 0 ? colors.border : colors.borderSoft }} />
                              <View style={{ width: 16, height: 7, borderRadius: 4, backgroundColor: colors.borderSoft }} />
                            </View>
                          ))}
                        </View>
                      </PremiumLock>
                    </View>

                    <TouchableOpacity
                      onPress={() => branch && navigation.navigate('JoinQueue', { businessId: branch.business_id, branchId: branch.id, serviceId: service.service_id, serviceName: service.service_name })}
                      style={{ marginTop: 14, backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 11, alignItems: 'center' }}
                    >
                      <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink }}>Join this line now →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
