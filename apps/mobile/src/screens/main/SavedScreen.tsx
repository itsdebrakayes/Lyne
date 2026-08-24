/**
 * SavedScreen — v5.
 *
 * Your shortlist, in the marketplace's own card language so a saved agency and
 * a browsed agency read as the same object. Each row carries the live wait at
 * that agency's best branch, because a bookmark that doesn't tell you anything
 * current is just a name.
 *
 * Below it, "Recent lines" — the last three queues joined, one tap to go back.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, shadow, t, initials, inputReset, waitShort, branchOpenInfo, hoursFromBranch, openTimeLabel, TAB_BAR_CLEARANCE } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness } from '../../lib/mobileData';
import { TabBar } from '../../components/TabBar';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import Icon from '../../components/Icon';

interface VisitRow {
  id: string;
  business_name: string;
  branch_name: string;
  service_name: string;
  visit_date: string;
  status: string;
}

export default function SavedScreen() {
  const topPad = useTopPad(14);
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: saved = [], isLoading, error, refetch } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });
  const { data: branches = [], refetch: refetchBranches } = useQuery({ queryKey: ['mobile-branches'], queryFn: () => api.get<BranchSummary[]>('/branches', false), refetchInterval: 30_000 });
  const { data: history = [] } = useQuery({ queryKey: ['visit-history'], queryFn: () => api.get<VisitRow[]>('/history') });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetch(), refetchBranches()]);
    setRefreshing(false);
  }, [refetch, refetchBranches]);

  const branchesByBusiness = useMemo(() => {
    const map: Record<string, BranchSummary[]> = {};
    for (const b of branches) (map[b.business_id] ||= []).push(b);
    return map;
  }, [branches]);

  const term = filter.trim().toLowerCase();
  const shownSaved = useMemo(
    () => (term ? saved.filter(s => s.name.toLowerCase().includes(term)) : saved),
    [saved, term],
  );

  const recentLines = useMemo(() => {
    const seen = new Set<string>();
    const rows: VisitRow[] = [];
    for (const visit of history) {
      const key = `${visit.branch_name}·${visit.service_name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(visit);
      if (rows.length === 3) break;
    }
    return rows;
  }, [history]);

  // Optimistic unsave: the row leaves immediately and comes back if the request
  // fails, rather than sitting there looking like the tap missed.
  const unsave = useMutation({
    mutationFn: (businessId: string) => api.delete(`/saved/${businessId}`),
    onMutate: async (businessId: string) => {
      await queryClient.cancelQueries({ queryKey: ['saved-businesses'] });
      const previous = queryClient.getQueryData<SavedBusiness[]>(['saved-businesses']) || [];
      queryClient.setQueryData<SavedBusiness[]>(['saved-businesses'], previous.filter(b => b.id !== businessId));
      return { previous };
    },
    onError: (_e, _v, context) => { if (context?.previous) queryClient.setQueryData(['saved-businesses'], context.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  const bestBranch = (businessId: string) => {
    const list = branchesByBusiness[businessId] || [];
    return [...list].sort((a, b) =>
      (Number(Number(b.open_queues) > 0) - Number(Number(a.open_queues) > 0))
      || Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes))[0];
  };
  const openBranch = (b?: BranchSummary) => b && navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: font.extra, fontSize: 28, color: colors.ink, letterSpacing: -1 }}>Saved</Text>
          {saved.length > 0 && (
            <Text style={{ marginLeft: 'auto', fontFamily: font.bold, fontSize: 13, color: colors.muted }}>
              {saved.length} {saved.length === 1 ? 'agency' : 'agencies'}
            </Text>
          )}
        </View>

        {saved.length > 2 && (
          <View style={{ height: 52, borderRadius: 18, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, marginBottom: 16, ...shadow.card }}>
            <Icon name="search" size={19} color={colors.muted} />
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search your saved agencies"
              placeholderTextColor={colors.muted}
              style={[{ flex: 1, fontFamily: font.bold, fontSize: 14, color: colors.ink }, inputReset]}
            />
          </View>
        )}

        {isLoading && <SkeletonRows count={3} />}
        {!!error && !isLoading && (
          <ErrorCard title="Saved list unavailable" message="We couldn't load your saved agencies. Check your connection and try again." onRetry={() => refetch()} />
        )}

        {/* empty */}
        {!isLoading && !error && saved.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{ width: 132, height: 132, borderRadius: 44, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 26, ...shadow.card }}>
              <Icon name="bookmark" size={58} color={colors.faint} />
            </View>
            <Text style={{ fontFamily: font.extra, fontSize: 24, color: colors.ink, letterSpacing: -0.8 }}>Nothing saved yet</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 290 }}>
              Save the agencies you use and they&apos;ll be one tap away — with their wait already loaded.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search')}
              style={{ backgroundColor: colors.accent, borderRadius: 17, paddingVertical: 16, paddingHorizontal: 26, marginTop: 24 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Explore agencies</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* nothing matched the filter, but the list isn't empty */}
        {!isLoading && saved.length > 0 && shownSaved.length === 0 && (
          <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, textAlign: 'center', paddingVertical: 30 }}>
            None of your saved agencies match “{filter.trim()}”.
          </Text>
        )}

        {/* saved agencies */}
        {shownSaved.map(s => {
          const branch = bestBranch(s.id);
          const wait = Math.round(Number(branch?.avg_wait_minutes || 0));
          const hours = branch ? hoursFromBranch(branch) : undefined;
          const info = branchOpenInfo(new Date(), hours);
          const isOpen = !!branch && info.state === 'open';
          return (
            <TouchableOpacity key={s.id} activeOpacity={0.88} onPress={() => openBranch(branch)}
              style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 11, ...shadow.card }}>
              <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 13, color: '#fff' }}>{s.slug?.toUpperCase().slice(0, 4) || initials(s.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15.5, color: colors.ink, letterSpacing: -0.4 }}>
                  {(s.name || '').replace(/\s*\([^)]*\)\s*$/, '')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOpen ? colors.light : colors.faint }} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.medium, fontSize: 12, color: colors.muted }}>
                    {branch ? `${branch.name}${isOpen ? '' : ` · opens ${openTimeLabel(hours)}`}` : 'No live branches'}
                  </Text>
                </View>
              </View>
              {isOpen && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.5 }}>{waitShort(wait)}</Text>
                  <Text style={{ fontFamily: font.extra, fontSize: 10, color: colors.muted, letterSpacing: 0.4 }}>SHORTEST</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => unsave.mutate(s.id)}
                accessibilityRole="button" accessibilityLabel={`Remove ${s.name} from saved`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="bookmarkFilled" size={21} color={colors.accent} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* recent lines */}
        {recentLines.length > 0 && (
          <>
            <View style={[t.sectionRow, { marginTop: 24 }]}>
              <Text style={t.section}>Recent lines</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.accent }}>View all</Text>
              </TouchableOpacity>
            </View>
            {recentLines.map(visit => (
              <TouchableOpacity
                key={visit.id}
                activeOpacity={0.88}
                onPress={() => {
                  const branch = branches.find(b => b.name === visit.branch_name);
                  if (branch) navigation.navigate('Branch', { businessId: branch.business_id, branchId: branch.id, branchName: branch.name });
                  else navigation.navigate('History');
                }}
                style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 10, ...shadow.card }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="clock" size={20} color={colors.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink, letterSpacing: -0.3 }}>{visit.service_name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 3 }}>{visit.branch_name}</Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.chevron} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
      <TabBar active="Saved" />
    </View>
  );
}
