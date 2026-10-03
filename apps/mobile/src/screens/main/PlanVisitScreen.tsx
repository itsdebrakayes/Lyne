/**
 * PlanVisitScreen — screen 01 of the Predictive Insights design.
 *
 * Ported literally from the design file, and it ENDS WHERE THE DESIGN ENDS:
 * header, SMART TIMING, the headline, the branch chips, the dark forecast
 * card, and the two "For you" rows. Nothing after that.
 *
 * It used to carry a second screen's worth of UI below those rows — a "Best
 * time by service" list with its own cards, green pills, week strips and
 * collapsible heatmaps, built on the app's generic theme tokens rather than
 * the design's. The result read as two different screens stapled together,
 * which is exactly the complaint. That depth is not gone; it moved to the
 * screens the design gives it: the heatmap is screen 02 (BusyTimesScreen,
 * which has its own service picker) and the day view is screen 03
 * (WeekPlannerScreen). "See heatmap →" and the rows are the way in.
 *
 * This screen is FREE, end to end. The paywall is on screen 02, over the
 * heatmap, which is the thing the subscription actually buys.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, initials } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';
import { PremiumBadge } from '../../components/PremiumBadge';
import TodayForecast, { ForecastHour } from '../../components/TodayForecast';
import { D } from '../../lib/predictiveDesign';
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
  /** Day x hour cells. Rendered on BusyTimesScreen, not here — screen 01 of
      the design ends at the two recommendation rows. Kept on the type because
      its presence is one of the signals that a payload is the premium one. */
  grid?: unknown[];
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


export default function PlanVisitScreen() {
  const topPad = useTopPad(18);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user } = useAuth();
  /* Entitlement comes from the server record and nothing else. This used to be
     `|| preview`, where `preview` was a device-local toggle anybody could flip
     in Settings — it unlocked the paid planner for free, and an App Store
     reviewer would have found it in the first minute. */
  const premium = Boolean(Number(user?.is_premium || 0));

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

  /* The badge the design puts in the header. TWO sources, because either one
     alone gets it wrong: the user record can lag (a trial started on another
     screen flips the server before this client refetches its profile), and the
     payload alone would hide the badge while the response is still in flight.
     Whichever says premium is enough — this only drives a badge.

     Caught by walking the live app against the design: the heatmap had
     unlocked, so the customer WAS premium, and this header still showed
     nothing where the design shows PREMIUM. */
  const showPremiumBadge = premium || Boolean(plan?.premium);

  /* No trial button on this screen any more, and no locked panel. Screen 01 of
     the design is free end to end — the forecast and the two recommendations
     are the thing that demonstrates the product, and a paywall in front of
     that sells nothing. The lock lives on screen 02, over the heatmap, which
     is what the subscription actually buys. */

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 56 }} showsVerticalScrollIndicator={false}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          {/* Labelled, like the back button on every other screen in this
              flow. An unlabelled icon button is announced as just "button". */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={t.iconBtn}
          >
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Plan your visit</Text>
          <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
            {showPremiumBadge && <PremiumBadge size="sm" />}
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
                nothing to read. The day-level answer lives on screens 02 and
                03, which is where the design puts it.

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

            {/* A branch with no served history yet has nothing to recommend
                from. That is a real state on day one of a pilot, and saying so
                beats rendering an empty "For you" card over nothing. */}
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
            </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
