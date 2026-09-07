import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, shadow, initials, statusFromWait, statusMeta, branchOpenInfo, hoursFromBranch, remoteJoinInfo } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness, ServiceSummary } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ErrorCard, SkeletonCard } from '../../components/Feedback';
import Icon from '../../components/Icon';
import { Press } from '../../components/Press';

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 150 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>

        {/* heading row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 22, color: colors.ink, letterSpacing: -0.6 }}>
            Choose your line
          </Text>
          <TouchableOpacity onPress={() => toggleSave.mutate()} disabled={toggleSave.isPending}
            accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this agency'}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name={isSaved ? 'bookmarkFilled' : 'bookmark'} size={19} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Branch only. The service used to be a second dropdown ABOVE a list of
            the same services, so the one decision on this screen was offered
            twice in two shapes, and choosing in the sheet left the list looking
            unchosen. The list is the choice now; the branch is the context. */}
        <PickerField
          label="Branch"
          value={branch?.name || branchName || 'Choose a branch'}
          hint={[branch?.city, openInfo.detail].filter(Boolean).join(' · ')}
          onPress={() => setBranchPicker(true)}
        />

        {/* arriving */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <View style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 15 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: 'rgba(255,255,255,.75)' }}>ARRIVING</Text>
            <Text style={{ fontFamily: font.extra, fontSize: 14, color: '#fff', marginTop: 2 }}>Now · {arriveLabel}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Plan', { businessId, branchId })}
            accessibilityRole="button" accessibilityLabel="Plan a later visit"
            style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Icon name="clock" size={16} color={colors.muted} />
            <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.muted }}>Later</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontFamily: font.extra, fontSize: 17, color: colors.ink, letterSpacing: -0.4, marginTop: 26, marginBottom: 12 }}>
          {services.length ? `${services.length} lines open` : 'Lines'}
        </Text>

        {servicesQuery.isLoading && <SkeletonCard height={120} />}
        {!!servicesQuery.error && !servicesQuery.isLoading && (
          <ErrorCard title="Services unavailable" message="This branch's live services could not be loaded." onRetry={() => servicesQuery.refetch()} />
        )}
        {!servicesQuery.isLoading && !servicesQuery.error && services.length === 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 24, alignItems: 'center', ...shadow.card }}>
            <Icon name="clock" size={28} color={colors.muted} />
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, marginTop: 12 }}>No open lines right now</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              This branch has nothing running at the moment. Try another branch, or plan a visit for when it&apos;s quiet.
            </Text>
          </View>
        )}

        {/* One tap selects. The old card needed a second tap on an
            already-selected row to advance, which is a rule you can only learn
            by accident — the action lives in the bar at the bottom now, where
            it is always visible and always says what it will do. */}
        <View style={{ gap: 12 }}>
          {lines.map((s, i) => {
            const on = s.id === selected?.id;
            const wait = svcWait(s);
            const fastest = i === 0 && lines.length > 1 && joinState.allowed;
            return (
              <TouchableOpacity
                key={s.id}
                activeOpacity={0.9}
                onPress={() => setSelectedId(s.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${s.name}, ${Number(s.waiting_count || 0)} in line, about ${wait} minutes`}
                style={{
                  backgroundColor: colors.surface, borderRadius: 22,
                  paddingVertical: 22, paddingHorizontal: 18,
                  borderWidth: on ? 2 : 1, borderColor: on ? colors.accent : colors.borderSoft,
                  ...shadow.card,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {/* The chosen row says so with a mark, not only a border —
                      a 2pt edge is easy to miss on a bright screen outdoors. */}
                  <View style={{
                    width: 26, height: 26, borderRadius: 13,
                    borderWidth: on ? 0 : 1.5, borderColor: colors.border,
                    backgroundColor: on ? colors.accent : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on && <Icon name="check" size={15} color={colors.accentInk} />}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.4 }}>
                        {s.name}
                      </Text>
                      {fastest && (
                        <View style={{ backgroundColor: colors.dark, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ fontFamily: font.extra, fontSize: 9.5, color: '#fff', letterSpacing: 0.4 }}>FASTEST</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, marginTop: 5 }}>
                      {Number(s.waiting_count || 0)} in line
                      {s.active_counters != null ? ` · ${Number(s.active_counters)} ${Number(s.active_counters) === 1 ? 'counter' : 'counters'} open` : ''}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 26, color: colors.ink, letterSpacing: -0.9 }}>
                      {joinState.allowed ? `${wait}` : '—'}
                    </Text>
                    <Text style={{ fontFamily: font.semibold, fontSize: 11, color: colors.muted, letterSpacing: 0.4, marginTop: 1 }}>
                      {joinState.allowed ? 'MIN' : ''}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* when to leave — only meaningful while the branch can actually be
            joined. Closed, it becomes advice to set off for a locked door. */}
        {!!selected && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 19, padding: 15, marginTop: 16, ...shadow.card }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={17} color={colors.accent} />
            </View>
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.sub, lineHeight: 17 }}>
              {joinState.allowed
                ? <>Leave in <Text style={{ fontFamily: font.extra, color: colors.ink }}>~{leaveIn(selected)} min</Text> to reach the front on time. We&apos;ll remind you once you join.</>
                : joinState.detail}
            </Text>
          </View>
        )}

      </ScrollView>

      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30,
        backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => seeLine(selected)}
          disabled={!selected || !joinState.allowed}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={
            !selected ? 'Choose a line first'
              : !joinState.allowed ? `Cannot join — ${joinState.label}`
              : `See the line for ${selected.name}, about ${svcWait(selected)} minutes`
          }
          accessibilityState={{ disabled: !selected || !joinState.allowed }}
        >
          <LinearGradient
            colors={selected && joinState.allowed
              ? [colors.accentDeep, colors.dark]
              : [colors.surfaceAlt, colors.surfaceAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              minHeight: 78, borderRadius: 24, paddingLeft: 24, paddingRight: 16,
              ...(selected && joinState.allowed ? shadow.hero : null),
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{
                fontFamily: font.extra, fontSize: 19, letterSpacing: -0.4,
                color: selected && joinState.allowed ? '#fff' : colors.muted,
              }}>
                {!selected ? 'Choose a line' : !joinState.allowed ? joinState.label : 'See the line'}
              </Text>
              <Text numberOfLines={1} style={{
                fontFamily: font.semibold, fontSize: 13, marginTop: 3,
                color: selected && joinState.allowed ? 'rgba(255,255,255,.66)' : colors.muted,
              }}>
                {/* Never a dead button with no explanation: the sub-line says
                    why, in the same place it would otherwise say the wait. */}
                {!selected ? 'Pick one above to continue'
                  : !joinState.allowed ? joinState.detail
                  : `${selected.name} · about ${svcWait(selected)} min`}
              </Text>
            </View>
            <View style={{
              width: 50, height: 50, borderRadius: 25,
              backgroundColor: selected && joinState.allowed ? '#fff' : colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="arrowRight" size={21} color={selected && joinState.allowed ? colors.dark : colors.muted} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
