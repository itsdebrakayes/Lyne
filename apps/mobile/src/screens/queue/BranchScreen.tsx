import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials, statusFromWait, statusMeta, branchOpenInfo, hoursFromBranch, remoteJoinInfo } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness, ServiceSummary } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';
import BestTimeCard from '../../components/BestTimeCard';
import { ErrorCard, SkeletonCard } from '../../components/Feedback';

type Params = RouteProp<RootStackParamList, 'Branch'>;
const TRAVEL_DEFAULT_MIN = 10;

function ServiceStat({ value, unit, label, accent }: { value: React.ReactNode; unit?: string; label: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: font.extra, fontSize: 22, color: accent ? colors.accentDeep : colors.ink }}>{value}{unit ? <Text style={{ fontSize: 12 }}>{unit}</Text> : null}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted, marginTop: 6 }}>{label}</Text>
    </View>
  );
}

export default function BranchScreen() {
  const topPad = useTopPad(18);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const queryClient = useQueryClient();
  const { businessId, branchId, branchName } = route.params;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false), refetchInterval: 30_000 });
  const servicesQuery = useQuery({
    queryKey: ['branch-services', businessId, branchId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?business_id=${businessId}&branch_id=${branchId}`, false),
    refetchInterval: 20_000,
  });
  const { data: saved = [] } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });

  const branch = branchQuery.data;
  const services = servicesQuery.data || [];
  const { refreshing, onRefresh } = useRefresh(branchQuery.refetch, servicesQuery.refetch);
  const selected = useMemo(() => services.find(s => s.id === selectedId) || services[0], [services, selectedId]);
  const others = services.filter(s => s.id !== selected?.id);
  const isSaved = saved.some(b => b.id === businessId);

  // Optimistic toggle — the bookmark fills instantly (like a like button) and
  // rolls back only if the request actually fails.
  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? api.delete(`/saved/${businessId}`) : api.post(`/saved/${businessId}`, {})),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['saved-businesses'] });
      const previous = queryClient.getQueryData<SavedBusiness[]>(['saved-businesses']) || [];
      queryClient.setQueryData<SavedBusiness[]>(['saved-businesses'], isSaved
        ? previous.filter(b => b.id !== businessId)
        : [...previous, { id: businessId, name: branch?.business_name || 'Saved company', slug: '', saved_at: new Date().toISOString() }]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['saved-businesses'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  // The wait we show is the SAME counter-aware projection the Join screen shows
  // (people ahead ÷ open counters × per-person time), so the two screens can
  // never contradict each other one tap apart. `estimated_wait_minutes` is set
  // for branch-scoped requests, which this screen always is; if it is ever
  // absent we fall back to the historical average, then the base estimate, so
  // the screen never advertises a bare "0-minute" wait from missing data.
  // The API returns decimals as strings, so "0.0000" must be compared
  // numerically — a bare || would treat it as truthy and skip the fallback.
  const svcWait = (s: ServiceSummary) => {
    if (s.estimated_wait_minutes != null) return Math.round(Number(s.estimated_wait_minutes));
    const live = Number(s.avg_wait_minutes || 0);
    return Math.round(live > 0 ? live : Number(s.base_avg_time_minutes || 0));
  };
  const leaveIn = (s: ServiceSummary) => Math.max(0, svcWait(s) - TRAVEL_DEFAULT_MIN);

  // Tick so the screen opens itself when the branch does, without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // The header already says Open / About to open / Closed — the join CTA must
  // agree with it. Offering "Join this queue" under a "Closed" header sends the
  // customer to a dead end and makes the branch state look decorative.
  const joinState = useMemo(() => remoteJoinInfo(now, hoursFromBranch(branch)), [now, branch]);

  const join = (s?: ServiceSummary) => {
    if (!s || !joinState.allowed) return;
    navigation.navigate('JoinQueue', { businessId, branchId, serviceId: s.id, serviceName: s.name });
  };

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 48 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>Now</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <Ionicons name="location" size={11} color={colors.ink} />
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{branch?.name || branchName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => toggleSave.mutate()} disabled={toggleSave.isPending} style={t.iconBtn}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* business heading */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink }}>{initials(branch?.business_name)}</Text>
          </View>
          {(() => {
            const open = branchOpenInfo(new Date(), hoursFromBranch(branch));
            const live = open.state === 'open' && Number(branch?.open_queues) > 0;
            const dot = open.state === 'open' ? colors.light : open.state === 'about_to_open' ? colors.accent : colors.faint;
            const label = open.state === 'open'
              ? (live ? 'Live queue · open now' : `Open · ${open.detail.toLowerCase()}`)
              : open.state === 'about_to_open' ? open.detail : `Closed · ${open.detail.toLowerCase()}`;
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>{label}</Text>
              </View>
            );
          })()}
        </View>
        <Text style={[t.h1, { marginBottom: 24 }]}>{branch?.business_name || 'Agency'}</Text>

        {servicesQuery.isLoading && <SkeletonCard height={230} />}
        {!!servicesQuery.error && !servicesQuery.isLoading && (
          <ErrorCard
            title="Services unavailable"
            message="This branch's live services could not be loaded."
            onRetry={() => servicesQuery.refetch()}
          />
        )}
        {!servicesQuery.isLoading && !servicesQuery.error && services.length === 0 && (
          <View style={[t.cardLg, { padding: 22, alignItems: 'center' }]}>
            <Ionicons name="time-outline" size={28} color={colors.muted} />
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginTop: 12 }}>No open services right now</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 6 }}>This branch has no live queues at the moment. Check back a little later.</Text>
          </View>
        )}

        {selected && (
          <>
            {/* service picker card */}
            <View style={[t.cardLg, { padding: 18 }]}>
              <TouchableOpacity onPress={() => setPickerOpen(o => !o)} style={{ backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>Choose your service</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 16.5, color: colors.ink, marginTop: 3 }}>{selected.name}</Text>
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#fff" />
                </View>
              </TouchableOpacity>

              {pickerOpen && (
                <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 6, gap: 3 }}>
                  {/* Quick switcher: name + traffic dot only — the numbers live
                      on the selected card and the comparison cards below. */}
                  {services.map(s => {
                    const on = s.id === selected.id;
                    const meta = statusMeta(statusFromWait(svcWait(s)));
                    return (
                      <TouchableOpacity key={s.id} onPress={() => { setSelectedId(s.id); setPickerOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 11, borderRadius: 11, backgroundColor: on ? colors.surfaceAlt : 'transparent' }}>
                        <Text style={{ fontFamily: on ? font.extra : font.bold, fontSize: 14, color: colors.ink }}>{s.name}</Text>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.dot }} />
                      </TouchableOpacity>
                    );
                  })}
                  {/* Key for the dots */}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingTop: 9, paddingBottom: 4, paddingHorizontal: 11, borderTopWidth: 1, borderTopColor: colors.borderSoft, marginTop: 3 }}>
                    {([['Light', colors.light], ['Busy', colors.moderate], ['High traffic', colors.busy]] as const).map(([label, dot]) => (
                      <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
                        <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: colors.muted }}>{label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', marginVertical: 22, marginBottom: 8 }}>
                <ServiceStat value={joinState.allowed ? Number(selected.waiting_count || 0) : '—'} label="in line" />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <ServiceStat value={joinState.allowed ? `~${svcWait(selected)}` : '—'} unit={joinState.allowed ? 'm' : undefined} label="est. wait" />
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <ServiceStat value={joinState.allowed ? leaveIn(selected) : '—'} unit={joinState.allowed ? 'm' : undefined} label="leave in" accent />
              </View>

              <TouchableOpacity
                onPress={() => join(selected)}
                disabled={!joinState.allowed}
                style={{ backgroundColor: colors.dark, borderRadius: 19, height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 9, marginTop: 16, opacity: joinState.allowed ? 1 : 0.45 }}
              >
                <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: '#fff' }}>
                  {joinState.allowed ? `Join this queue · ~${svcWait(selected)}m` : joinState.label}
                </Text>
                {joinState.allowed && (
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 17 }}>→</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* When to leave — only meaningful while the branch can actually be
                joined. Closed, it becomes advice to set off for a locked door. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: '#dbeef4', borderRadius: 19, padding: 15, paddingHorizontal: 16, marginTop: 16 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={joinState.allowed ? 'time-outline' : 'information-circle-outline'} size={17} color={colors.accentDeep} />
              </View>
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.infoInk, lineHeight: 17 }}>
                {joinState.allowed
                  ? <>Leave in <Text style={{ fontFamily: font.extra }}>~{leaveIn(selected)} min</Text> to reach the front on time — we&apos;ll remind you once you join.</>
                  : joinState.detail}
              </Text>
            </View>

            {/* premium best-time recommendation (live model output) */}
            <BestTimeCard businessId={businessId} branchId={branchId} onPlan={() => navigation.navigate('Plan', { businessId, branchId })} />

            {/* other services */}
            {others.length > 0 && (
              <>
                <View style={t.sectionRow}>
                  <Text style={t.section}>Other services</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted }}>{others.length} available</Text>
                </View>
                <View style={{ gap: 14 }}>
                  {/* finance-goal card style: icon tile + name + chevron, then a
                      busyness meter with the numbers on either end. */}
                  {others.map(s => {
                    const wait = svcWait(s);
                    const meta = statusMeta(statusFromWait(wait));
                    const busyRatio = Math.max(0.06, Math.min(1, wait / 60));
                    return (
                      <TouchableOpacity key={s.id} activeOpacity={0.88} onPress={() => setSelectedId(s.id)} style={[t.card, { padding: 17, borderRadius: 24 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="documents-outline" size={19} color={colors.accentDeep} />
                          </View>
                          <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.bold, fontSize: 16.5, color: colors.ink, letterSpacing: -0.3 }}>{s.name}</Text>
                          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="chevron-forward" size={15} color={colors.sub} />
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18 }}>
                          <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: colors.ink }}>{Number(s.waiting_count || 0)} <Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.muted }}>in line</Text></Text>
                          <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: colors.ink }}>~{wait}<Text style={{ fontSize: 13, fontFamily: font.bold, color: colors.muted }}>m wait</Text></Text>
                        </View>
                        <View style={{ height: 7, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: 11 }}>
                          <View style={{ width: `${Math.round(busyRatio * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: meta.dot }} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                            <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>{meta.label}</Text>
                          </View>
                          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.faint }}>Tap to select</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
