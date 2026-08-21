import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, initials, statusFromWait, statusMeta, branchOpenInfo, hoursFromBranch, remoteJoinInfo } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness, ServiceSummary } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';
import BestTimeCard from '../../components/BestTimeCard';
import { ErrorCard, SkeletonCard } from '../../components/Feedback';
import Icon from '../../components/Icon';

type Params = RouteProp<RootStackParamList, 'Branch'>;
const TRAVEL_DEFAULT_MIN = 10;

/**
 * "Let's get you in line" — v5.
 *
 * Both the branch AND the service are editable here. The old flow reached this
 * screen with a branch already fixed by the previous screen, so someone who had
 * picked the wrong one had to back all the way out to change it. Since v5 drops
 * the standalone branch step, this screen owns both choices: each field is a
 * button that opens its own picker, and switching branch re-queries the
 * services for it rather than carrying the old branch's list across.
 */

/** A field that reads like a filled form row and behaves like a button. */
function PickerField({ label, value, hint, onPress }: { label: string; value: string; hint?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Tap to change.`}
      style={{ backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.muted, width: 74 }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 23, color: colors.ink, letterSpacing: -0.8 }}>{value}</Text>
        {!!hint && <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 3 }}>{hint}</Text>}
      </View>
      <Icon name="chevronDown" size={18} color={colors.chevron} />
    </TouchableOpacity>
  );
}

/** Bottom sheet used by both pickers, so branch and service feel identical. */
function PickerSheet<T extends { id: string }>({
  open, title, items, selectedId, onSelect, onClose, renderRow,
}: {
  open: boolean; title: string; items: T[]; selectedId?: string;
  onSelect: (item: T) => void; onClose: () => void;
  renderRow: (item: T, selected: boolean) => React.ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(6,12,20,.55)' }} />
      <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10, paddingBottom: 34, maxHeight: '72%' }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.chevron, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 12 }}>
          <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.6 }}>{title}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={17} color={colors.sub} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 8, gap: 9 }}>
          {items.map(item => {
            const selected = item.id === selectedId;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => { onSelect(item); onClose(); }}
                style={{
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12,
                }}
              >
                {renderRow(item, selected)}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function BranchScreen() {
  const topPad = useTopPad(14);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const queryClient = useQueryClient();
  const { businessId, branchName } = route.params;

  // Branch is now local state, not a fixed route param, so it can be swapped
  // in place without unwinding the stack.
  const [branchId, setBranchId] = useState(route.params.branchId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [branchPicker, setBranchPicker] = useState(false);
  const [servicePicker, setServicePicker] = useState(false);

  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false), refetchInterval: 30_000 });
  const branchesQuery = useQuery({
    queryKey: ['business-branches', businessId],
    queryFn: () => api.get<BranchSummary[]>(`/branches?business_id=${businessId}`, false),
  });
  const servicesQuery = useQuery({
    queryKey: ['branch-services', businessId, branchId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?business_id=${businessId}&branch_id=${branchId}`, false),
    refetchInterval: 20_000,
  });
  const { data: saved = [] } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });

  const branch = branchQuery.data;
  const branches = branchesQuery.data || [];
  const services = servicesQuery.data || [];
  const { refreshing, onRefresh } = useRefresh(branchQuery.refetch, servicesQuery.refetch);

  /* Until the person picks, show the service they can be seen for soonest.
     The list arrives alphabetically, and at Constant Spring that put Child
     Passport Application (58 min) in front of someone who tapped in from a
     card advertising the shortest wait nearby. */
  const quickest = useMemo(() => {
    if (!services.length) return undefined;
    return [...services].sort((a, b) =>
      Number(a.estimated_wait_minutes ?? Infinity) - Number(b.estimated_wait_minutes ?? Infinity))[0];
  }, [services]);
  const selected = useMemo(
    () => services.find(s => s.id === selectedId) || quickest,
    [services, selectedId, quickest]);
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
  const openInfo = useMemo(() => branchOpenInfo(now, hoursFromBranch(branch)), [now, branch]);

  // Second tap opens the queue map rather than joining outright. Joining is the
  // commitment; seeing the line you are about to stand in is the step before it,
  // and the map carries its own Join button.
  const seeLine = (s?: ServiceSummary) => {
    if (!s || !joinState.allowed) return;
    navigation.navigate('QueueMap', { businessId, branchId, serviceId: s.id, serviceName: s.name });
  };

  // Shortest wait first: the list is a shopping list, and the number people are
  // shopping on is the wait.
  const lines = useMemo(() => [...services].sort((a, b) => svcWait(a) - svcWait(b)), [services]);

  const arriveLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 48 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>

        {/* heading row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8, paddingBottom: 26 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={21} color="#fff" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 32, color: '#fff', letterSpacing: -1.2, lineHeight: 35 }}>
            Let&apos;s get you{'\n'}in line
          </Text>
          <TouchableOpacity onPress={() => toggleSave.mutate()} disabled={toggleSave.isPending}
            accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this agency'}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={isSaved ? 'bookmarkFilled' : 'bookmark'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* branch → service, both editable */}
        <PickerField
          label="Branch"
          value={branch?.name || branchName || 'Choose a branch'}
          // openInfo.detail already reads "Open until 11:59 pm", so prefixing it
          // with "open" produced "Kingston · open · open until 11:59 pm".
          hint={[branch?.city, openInfo.detail].filter(Boolean).join(' · ')}
          onPress={() => setBranchPicker(true)}
        />
        <View style={{ height: 12 }}>
          <View style={{ position: 'absolute', right: 20, top: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 5, borderColor: colors.dark, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <Icon name="arrowDown" size={22} color={colors.ink} />
          </View>
        </View>
        <PickerField
          label="Service"
          value={selected?.name || 'Choose a service'}
          hint={services.length ? `${services.length} available today` : undefined}
          onPress={() => setServicePicker(true)}
        />

        {/* arriving */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
          <View style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: 'rgba(255,255,255,.75)' }}>Arriving</Text>
            <Text style={{ fontFamily: font.extra, fontSize: 14, color: '#fff', marginTop: 2 }}>Now · {arriveLabel}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Plan', { businessId, branchId })}
            accessibilityRole="button" accessibilityLabel="Plan a later visit"
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,.3)', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 9 }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,.4)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,.65)', fontFamily: font.extra, fontSize: 14, lineHeight: 16 }}>+</Text>
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: 'rgba(255,255,255,.65)' }}>Later</Text>
          </TouchableOpacity>
        </View>

        {/* open lines */}
        <Text style={{ fontFamily: font.extra, fontSize: 19, color: '#fff', letterSpacing: -0.5, marginTop: 24, marginBottom: 13 }}>Open lines</Text>

        {servicesQuery.isLoading && <SkeletonCard height={150} />}
        {!!servicesQuery.error && !servicesQuery.isLoading && (
          <ErrorCard title="Services unavailable" message="This branch's live services could not be loaded." onRetry={() => servicesQuery.refetch()} />
        )}
        {!servicesQuery.isLoading && !servicesQuery.error && services.length === 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 24, alignItems: 'center' }}>
            <Icon name="clock" size={28} color={colors.muted} />
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, marginTop: 12 }}>No open lines right now</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              This branch has nothing running at the moment. Try another branch, or plan a visit for when it&apos;s quiet.
            </Text>
          </View>
        )}

        {lines.map(s => {
          const on = s.id === selected?.id;
          const wait = svcWait(s);
          return (
            <TouchableOpacity
              key={s.id}
              activeOpacity={0.9}
              onPress={() => (on ? seeLine(s) : setSelectedId(s.id))}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${Number(s.waiting_count || 0)} in line, about ${wait} minutes`}
              style={{ backgroundColor: on ? colors.accent : colors.surface, borderRadius: 22, paddingVertical: 17, paddingHorizontal: 19, marginBottom: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5, color: on ? 'rgba(255,255,255,.72)' : colors.muted }}>
                    {joinState.allowed ? (on ? 'TAP AGAIN TO SEE THE LINE' : 'JOIN NOW') : joinState.label.toUpperCase()}
                  </Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 22, letterSpacing: -0.8, marginTop: 3, color: on ? '#fff' : colors.ink }}>{s.name}</Text>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: on ? '#fff' : colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 11, color: on ? colors.accent : '#fff' }}>{initials(branch?.business_name)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: on ? 'rgba(255,255,255,.22)' : colors.border }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? 'rgba(255,255,255,.82)' : colors.muted }}>
                  {Number(s.waiting_count || 0)} in line{s.active_counters != null ? ` · ${Number(s.active_counters)} counters` : ''}
                </Text>
                <Text style={{ fontFamily: font.extra, fontSize: 22, letterSpacing: -0.8, color: on ? '#fff' : colors.ink }}>
                  {joinState.allowed ? `${wait} min` : '—'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* when to leave — only meaningful while the branch can actually be
            joined. Closed, it becomes advice to set off for a locked door. */}
        {!!selected && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 19, padding: 15, marginTop: 4 }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={17} color={colors.accent} />
            </View>
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.75)', lineHeight: 17 }}>
              {joinState.allowed
                ? <>Leave in <Text style={{ fontFamily: font.extra, color: '#fff' }}>~{leaveIn(selected)} min</Text> to reach the front on time. We&apos;ll remind you once you join.</>
                : joinState.detail}
            </Text>
          </View>
        )}

        {/* premium best-time recommendation (live model output) */}
        <BestTimeCard businessId={businessId} branchId={branchId} onPlan={() => navigation.navigate('Plan', { businessId, branchId })} />
      </ScrollView>

      {/* ── pickers ─────────────────────────────────────────────────── */}
      <PickerSheet
        open={branchPicker}
        title="Change branch"
        items={branches}
        selectedId={branchId}
        onClose={() => setBranchPicker(false)}
        onSelect={(b) => {
          if (b.id === branchId) return;
          // Clear the service too: the old selection belongs to the old branch,
          // and carrying it across would show a service this branch may not run.
          setBranchId(b.id);
          setSelectedId(null);
          navigation.setParams({ branchId: b.id, branchName: b.name });
        }}
        renderRow={(b, on) => (
          <>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: on ? 'rgba(255,255,255,.2)' : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pin" size={18} color={on ? '#fff' : colors.muted} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: on ? '#fff' : colors.ink, letterSpacing: -0.3 }}>{b.name}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: on ? 'rgba(255,255,255,.75)' : colors.muted, marginTop: 3 }}>
                {[b.city, `${Number(b.open_queues || 0)} open`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: on ? '#fff' : colors.ink }}>{Math.round(Number(b.avg_wait_minutes || 0))}m</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: on ? 'rgba(255,255,255,.75)' : colors.muted }}>WAIT</Text>
            </View>
          </>
        )}
      />

      <PickerSheet
        open={servicePicker}
        title="Change service"
        items={lines}
        selectedId={selected?.id}
        onClose={() => setServicePicker(false)}
        onSelect={(s) => setSelectedId(s.id)}
        renderRow={(s, on) => {
          const meta = statusMeta(statusFromWait(svcWait(s)));
          return (
            <>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? '#fff' : meta.dot }} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.extra, fontSize: 15, color: on ? '#fff' : colors.ink, letterSpacing: -0.3 }}>{s.name}</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? 'rgba(255,255,255,.85)' : colors.muted }}>
                {Number(s.waiting_count || 0)} in line · {svcWait(s)}m
              </Text>
            </>
          );
        }}
      />
    </View>
  );
}
