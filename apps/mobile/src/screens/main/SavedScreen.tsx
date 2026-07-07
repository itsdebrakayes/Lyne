/**
 * SavedScreen — reference-driven layout:
 * dark header card ("Hey {name}! Let's find your favorite line." + search),
 * a two-column favorites grid alternating dark/light cards, and a
 * "Recent lines" section — the last three queues you joined, one tap to
 * jump back in.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, initials, inputReset, waitShort } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { TabBar } from '../../components/TabBar';
import { EmptyCard, ErrorCard, SkeletonRows } from '../../components/Feedback';

interface VisitRow {
  id: string;
  business_name: string;
  branch_name: string;
  service_name: string;
  visit_date: string;
  status: string;
}

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const firstName = (user?.full_name || '').split(/\s+/)[0] || 'there';

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

  const unsave = useMutation({
    mutationFn: (businessId: string) => api.delete(`/saved/${businessId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
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
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 64, paddingBottom: 148 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        {/* dark header card */}
        <View style={{ backgroundColor: colors.dark, borderRadius: 30, padding: 22, paddingBottom: 20, ...shadow.hero }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: 'rgba(255,255,255,.55)' }}>Hey {firstName}!</Text>
              <Text style={{ fontFamily: font.extra, fontSize: 22, lineHeight: 27, color: '#fff', letterSpacing: -0.5, marginTop: 4 }}>Let’s find your{'\n'}favorite line.</Text>
            </View>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.accent, fontFamily: font.extra, fontSize: 15 }}>{initials(user?.full_name || 'Q')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: 'rgba(255,255,255,.09)', borderRadius: 18, height: 48, paddingHorizontal: 16, marginTop: 18 }}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,.55)" />
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search your favorites"
              placeholderTextColor="rgba(255,255,255,.45)"
              style={[{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: '#fff' }, inputReset]}
            />
          </View>
        </View>

        {/* favorites */}
        <View style={t.sectionRow}>
          <Text style={t.section}>Favorites</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>Find more</Text></TouchableOpacity>
        </View>

        {isLoading && <SkeletonRows count={2} />}
        {!!error && !isLoading && (
          <ErrorCard title="Saved list unavailable" message="Your saved companies could not be loaded right now." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && shownSaved.length === 0 && (
          <EmptyCard
            icon="bookmark-outline"
            title={term ? `No favorites match “${filter.trim()}”` : 'Nothing saved yet'}
            message={term ? 'Try another name.' : 'Save a company from its branch page and it will live here for one-tap queueing.'}
          />
        )}

        {shownSaved.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8, paddingVertical: 4 }}>
            {shownSaved.map((company, index) => {
              const dark = index % 2 === 0;
              const best = bestBranch(company.id);
              const list = branchesByBusiness[company.id] || [];
              return (
                <TouchableOpacity
                  key={company.id}
                  activeOpacity={0.9}
                  onPress={() => openBranch(best)}
                  style={{
                    width: 230, borderRadius: 26, padding: 18, minHeight: 178,
                    backgroundColor: dark ? colors.dark : colors.surface,
                    borderWidth: dark ? 0 : 1, borderColor: colors.border,
                    ...(dark ? shadow.hero : shadow.card),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: dark ? '#fff' : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink }}>{initials(company.name)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => unsave.mutate(company.id)} disabled={unsave.isPending} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="bookmark" size={17} color={dark ? colors.accent : colors.ink} />
                    </TouchableOpacity>
                  </View>
                  <Text numberOfLines={2} style={{ fontFamily: font.extra, fontSize: 16, lineHeight: 21, color: dark ? '#fff' : colors.ink, letterSpacing: -0.3, marginTop: 15 }}>{company.name}</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 11.5, color: dark ? 'rgba(255,255,255,.5)' : colors.muted, marginTop: 5 }}>
                    {list.length} {list.length === 1 ? 'branch' : 'branches'}{best ? ` · ${waitShort(best.avg_wait_minutes)} wait` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 16 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.bold, fontSize: 11, color: dark ? 'rgba(255,255,255,.55)' : colors.muted }}>{best ? best.name : 'No live branch'}</Text>
                    <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: dark ? colors.accent : colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="arrow-forward" size={15} color={dark ? colors.accentInk : '#fff'} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* recent lines */}
        {recentLines.length > 0 && (
          <>
            <View style={t.sectionRow}>
              <Text style={t.section}>Recent lines</Text>
              <TouchableOpacity onPress={() => navigation.navigate('History')}><Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>View all</Text></TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              {recentLines.map(visit => (
                <TouchableOpacity
                  key={visit.id}
                  activeOpacity={0.85}
                  onPress={() => {
                    const branch = branches.find(b => b.name === visit.branch_name);
                    if (branch) navigation.navigate('Branch', { businessId: branch.business_id, branchId: branch.id, branchName: branch.name });
                    else navigation.navigate('History');
                  }}
                  style={t.listRow}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="repeat" size={17} color={colors.accentDeep} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>{visit.service_name}</Text>
                    <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>{visit.business_name} · {visit.branch_name}</Text>
                  </View>
                  <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.accentDeep }}>Rejoin →</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <TabBar active="Saved" />
    </View>
  );
}
