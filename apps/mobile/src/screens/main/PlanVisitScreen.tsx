/**
 * PlanVisitScreen — "Plan your visit" (Smart Timing).
 *
 * Best time to visit, per service, per branch — computed from the last 90
 * days of real visit history. Free tier sees the branch-level headline and a
 * locked preview; QMe Premium unlocks the per-service planner. The trial
 * button flips the flag server-side so both states are real, not mocked.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, initials } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Plan'>;

interface BestSlot { dow: number; hour: number; visits: number; avg_wait: number; day_name: string; hour_label: string }
interface WeekDay { dow: number; day_name: string; avg_wait: number | null; level: 0 | 1 | 2 | 3 }
interface ServicePlan {
  service_id: string;
  service_name: string;
  best?: BestSlot | null;
  busiest?: BestSlot | null;
  quietest_day?: { dow: number; day_name: string; avg_wait: number } | null;
  week: WeekDay[];
}
interface BestTimes { window_days: number; branch_best?: BestSlot | null; services: ServicePlan[] }

const LEVEL_DOT: Record<number, string> = { 0: '#e4e7eb', 1: colors.light, 2: colors.moderate, 3: colors.busy };
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function WeekStrip({ week, compact = false }: { week: WeekDay[]; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: compact ? 0 : 12 }}>
      {week.map(day => (
        <View key={day.dow} style={{ alignItems: 'center', gap: 5, flex: 1 }}>
          <View style={{ width: compact ? 10 : 13, height: compact ? 10 : 13, borderRadius: 7, backgroundColor: LEVEL_DOT[day.level] }} />
          <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: colors.muted }}>{DAY_SHORT[day.dow]}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PlanVisitScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user, refreshProfile } = useAuth();
  const premium = Boolean(Number(user?.is_premium || 0));
  const [trialBusy, setTrialBusy] = useState(false);
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
    queryKey: ['best-times', branch?.business_id, branch?.id],
    queryFn: () => api.get<BestTimes>(`/predictions/best-times?business_id=${branch!.business_id}&branch_id=${branch!.id}`, false),
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Plan your visit</Text>
          <View style={{ width: 44, alignItems: 'flex-end' }}>
            {premium && (
              <View style={{ backgroundColor: colors.dark, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 8.5, color: colors.accent, letterSpacing: 0.8 }}>PREMIUM</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.accentDeep, letterSpacing: 1.6 }}>SMART TIMING</Text>
        <Text style={[t.h1, { marginTop: 6, marginBottom: 16 }]}>Beat the line before{'\n'}you leave home.</Text>

        {/* branch chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 4 }} style={{ marginBottom: 18 }}>
          {branches.map(b => {
            const on = branch?.id === b.id;
            return (
              <TouchableOpacity key={b.id} onPress={() => setSelectedId(b.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: on ? colors.dark : colors.surface, borderWidth: 1, borderColor: on ? colors.dark : colors.border, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13 }}>
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
                  <Ionicons name="sparkles" size={20} color={colors.accent} />
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
                    <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: 'rgba(255,255,255,.5)' }}>typical wait</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: 'rgba(255,255,255,.45)', marginTop: 14 }}>From the last {plan.window_days} days of real visits · updates continuously</Text>
            </View>

            {/* per-service planner */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 13 }}>
              <Text style={t.section}>Best time by service</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted }}>{plan.services.length} services</Text>
            </View>

            {premium ? (
              <View style={{ gap: 12 }}>
                {plan.services.map(service => (
                  <View key={service.service_id} style={[t.card, { padding: 16, borderRadius: 22 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{service.service_name}</Text>
                      {service.best && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e6f7ee', borderRadius: 13, paddingVertical: 6, paddingHorizontal: 11 }}>
                          <Ionicons name="time" size={12} color="#1f9d5f" />
                          <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: '#166b41' }}>{service.best.day_name.slice(0, 3)} · {service.best.hour_label}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
                      {service.best && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted }}>~{Math.round(service.best.avg_wait)}m at the best time</Text>}
                      {service.busiest && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.busy }}>Avoid {service.busiest.day_name.slice(0, 3)} {service.busiest.hour_label}</Text>}
                    </View>
                    <WeekStrip week={service.week} />
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
              <>
                {/* locked preview */}
                <View style={[t.card, { borderRadius: 22, overflow: 'hidden' }]}>
                  {plan.services.slice(0, 4).map((service, index) => (
                    <View key={service.service_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderBottomWidth: index === Math.min(plan.services.length, 4) - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}>
                      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="lock-closed" size={14} color={colors.muted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>{service.service_name}</Text>
                        <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.faint, letterSpacing: 2 }}>••••••· ••:•• ••</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[0, 1, 2].map(i => <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#e4e7eb' }} />)}
                      </View>
                    </View>
                  ))}
                </View>

                {/* upsell */}
                <View style={{ backgroundColor: colors.dark, borderRadius: 26, padding: 22, marginTop: 16, ...shadow.hero }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="sparkles" size={15} color={colors.accent} />
                    <Text style={{ fontFamily: font.extra, fontSize: 10.5, color: colors.accent, letterSpacing: 1.6 }}>QME PREMIUM</Text>
                  </View>
                  <Text style={{ fontFamily: font.extra, fontSize: 21, color: '#fff', letterSpacing: -0.4, marginTop: 10, lineHeight: 26 }}>Know the quietest hour{'\n'}for every service.</Text>
                  {[
                    'Best time for each service, at every branch',
                    'Weekly quiet-day strips from real visit data',
                    'Departure reminders tuned to your travel time',
                  ].map(line => (
                    <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 }}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.light} />
                      <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.75)' }}>{line}</Text>
                    </View>
                  ))}
                  {!!trialError && <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#ff9d9d', marginTop: 12 }}>{trialError}</Text>}
                  <TouchableOpacity disabled={trialBusy} onPress={startTrial} activeOpacity={0.9} style={{ marginTop: 18, backgroundColor: colors.accent, borderRadius: 16, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {trialBusy ? <ActivityIndicator color={colors.accentInk} /> : (
                      <>
                        <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.accentInk }}>Start 14-day free trial</Text>
                        <Ionicons name="arrow-forward" size={15} color={colors.accentInk} />
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: 'rgba(255,255,255,.4)', textAlign: 'center', marginTop: 10 }}>No card needed · cancel anytime</Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
