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
import PremiumLock from '../../components/PremiumLock';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Plan'>;

interface BestSlot { dow: number; hour: number; visits: number; avg_wait: number; day_name: string; hour_label: string }
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
interface BestTimes { window_days: number; branch_best?: BestSlot | null; services: ServicePlan[] }

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEVEL_WORD: Record<number, string> = { 1: 'Quiet', 2: 'Busy', 3: 'Peak' };
const hourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;

const LEVEL_DOT: Record<number, string> = { 0: colors.border, 1: colors.light, 2: colors.moderate, 3: colors.busy };
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function WeekStrip({ week, compact = false }: { week: WeekDay[]; compact?: boolean }) {
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
  const plan = bestTimes.data;

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

        <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.accentDeep, letterSpacing: 1.6 }}>SMART TIMING</Text>
        <Text style={[t.h1, { marginTop: 8, marginBottom: 22 }]}>Beat the line before{'\n'}you leave home.</Text>

        {/* branch chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} style={{ marginBottom: 22 }}>
          {branches.map(b => {
            const on = branch?.id === b.id;
            return (
              <TouchableOpacity key={b.id} onPress={() => setSelectedId(b.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: on ? colors.dark : colors.surface, borderWidth: 1, borderColor: on ? colors.dark : colors.border, borderRadius: 17, paddingVertical: 11, paddingHorizontal: 15 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 11, color: on ? colors.accent : colors.muted }}>{b.business_slug?.toUpperCase() || initials(b.business_name)}</Text>
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
            {/* branch headline — free for everyone */}
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
            {/* per-service planner */}
            <View style={t.sectionRow}>
              <Text style={t.section}>Best time by service</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted }}>{plan.services.length} services</Text>
            </View>

            {premium ? (
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
