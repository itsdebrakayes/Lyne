/**
 * SearchScreen — three states, reference-driven:
 *
 *  1. First use            → centered "Need anything?" prompt + suggestions
 *  2. Idle with history    → recent-search tiles (stored on device)
 *  3. Searching            → removable filter chips + result count +
 *                            alternating light/dark result cards
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, t, initials, inputReset, statusFromWait, statusMeta, waitShort } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { TabBar } from '../../components/TabBar';
import { EmptyCard, ErrorCard, SkeletonRows } from '../../components/Feedback';

const RECENTS_KEY = 'qme.recent-searches';
const SUGGESTIONS = ['Passport renewal', 'TRN registration', 'Tax payments', 'NHT benefits'];

async function loadRecents(): Promise<string[]> {
  try { return JSON.parse((await AsyncStorage.getItem(RECENTS_KEY)) || '[]'); } catch { return []; }
}
async function pushRecent(term: string) {
  const cleaned = term.trim();
  if (cleaned.length < 2) return;
  const existing = await loadRecents();
  const next = [cleaned, ...existing.filter(item => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
}

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const [bizFilter, setBizFilter] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: branches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });

  useEffect(() => { loadRecents().then(setRecents); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const businesses = useMemo(() => {
    const seen = new Map<string, string>();
    branches.forEach(b => { if (!seen.has(b.business_id)) seen.set(b.business_id, b.business_slug?.toUpperCase() || initials(b.business_name)); });
    return Array.from(seen.entries()).map(([id, tag]) => ({ id, tag }));
  }, [branches]);

  const term = search.trim().toLowerCase();
  const searching = term.length > 0;

  const results = useMemo(() => {
    let list = branches;
    if (term) list = list.filter(b => [b.name, b.business_name, b.city, b.parish].some(v => v?.toLowerCase().includes(term)));
    if (bizFilter) list = list.filter(b => b.business_id === bizFilter);
    if (openOnly) list = list.filter(b => Number(b.open_queues) > 0);
    return list;
  }, [branches, term, bizFilter, openOnly]);

  const openBranch = (b: BranchSummary) => {
    pushRecent(search).then(() => loadRecents().then(setRecents));
    navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });
  };

  const filtersActive = searching || bizFilter || openOnly;

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={t.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        {/* search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <View style={[t.search, { flex: 1, height: 50 }]}>
            <Ionicons name="search-outline" size={17} color={searching ? colors.ink : colors.muted} />
            <TextInput
              autoFocus={false}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => pushRecent(search).then(() => loadRecents().then(setRecents))}
              returnKeyType="search"
              style={[{ flex: 1, fontFamily: font.semibold, fontSize: 14.5, color: colors.ink }, inputReset]}
              placeholder="Search agencies & branches"
              placeholderTextColor={colors.muted}
            />
            {searching && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={17} color={colors.faint} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!filtersActive ? (
          /* ── Idle states ── */
          <View>
            {recents.length === 0 ? (
              /* first use — the "Need anything?" moment */
              <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 28 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 28, color: colors.ink, letterSpacing: -0.8 }}>Need anything?</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 10, maxWidth: 290 }}>
                  Search any agency, branch, or service — and see the live wait before you go.
                </Text>
              </View>
            ) : (
              <>
                <View style={[t.sectionRow, { marginTop: 8 }]}>
                  <Text style={t.section}>Recent searches</Text>
                  <TouchableOpacity onPress={() => { AsyncStorage.removeItem(RECENTS_KEY).catch(() => {}); setRecents([]); }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {recents.map(item => (
                    <TouchableOpacity key={item} onPress={() => setSearch(item)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 15 }}>
                      <Ionicons name="time-outline" size={14} color={colors.muted} />
                      <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.ink }}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* suggestions — always available when idle */}
            <View style={[t.sectionRow, recents.length === 0 && { marginTop: 4 }]}>
              <Text style={recents.length === 0 ? { fontFamily: font.extra, fontSize: 12, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' } : t.section}>
                {recents.length === 0 ? 'Try searching for' : 'Popular right now'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: recents.length === 0 ? 'center' : 'flex-start' }}>
              {SUGGESTIONS.map(item => (
                <TouchableOpacity key={item} onPress={() => setSearch(item.split(' ')[0])} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 15 }}>
                  <Ionicons name="sparkles-outline" size={13} color={colors.accentDeep} />
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.sub }}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* ── Results state ── */
          <View>
            {/* filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 4 }} style={{ marginBottom: 18 }}>
              {businesses.map(biz => {
                const on = bizFilter === biz.id;
                return (
                  <TouchableOpacity key={biz.id} onPress={() => setBizFilter(on ? null : biz.id)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: on ? colors.dark : colors.surface, borderWidth: 1, borderColor: on ? colors.dark : colors.border, borderRadius: 15, paddingVertical: 9, paddingHorizontal: 14 }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 12, color: on ? '#fff' : colors.ink }}>{biz.tag}</Text>
                    {on && <Ionicons name="close" size={13} color="rgba(255,255,255,.7)" />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity onPress={() => setOpenOnly(o => !o)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: openOnly ? colors.dark : colors.surface, borderWidth: 1, borderColor: openOnly ? colors.dark : colors.border, borderRadius: 15, paddingVertical: 9, paddingHorizontal: 14 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light }} />
                <Text style={{ fontFamily: font.extra, fontSize: 12, color: openOnly ? '#fff' : colors.ink }}>Open now</Text>
                {openOnly && <Ionicons name="close" size={13} color="rgba(255,255,255,.7)" />}
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={t.section}>Search results</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted }}>{results.length} {results.length === 1 ? 'branch' : 'branches'} found</Text>
            </View>

            {isLoading && <SkeletonRows count={5} />}
            {!!error && !isLoading && (
              <ErrorCard title="Search is offline" message="Live branch data could not be loaded. Pull down or tap to retry." onRetry={() => refetch()} />
            )}
            {!isLoading && !error && results.length === 0 && (
              <EmptyCard icon="search-outline" title={`No matches for “${search.trim() || 'these filters'}”`} message="Try a different agency, branch, or parish name — or clear a filter." />
            )}

            <View style={{ gap: 14 }}>
              {results.map((b, index) => {
                const wait = Math.round(Number(b.avg_wait_minutes || 0));
                const meta = statusMeta(statusFromWait(wait));
                const dark = index === 0;
                const ink = dark ? '#fff' : colors.ink;
                const muted = dark ? 'rgba(255,255,255,.55)' : colors.muted;
                return (
                  <TouchableOpacity
                    key={b.id}
                    activeOpacity={0.9}
                    onPress={() => openBranch(b)}
                    style={{ backgroundColor: dark ? colors.dark : colors.surface, borderWidth: dark ? 0 : 1, borderColor: colors.border, borderRadius: 24, padding: 18 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: dark ? '#fff' : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.ink }}>{initials(b.business_name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 13.5, color: ink }}>{b.business_name}</Text>
                        <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 11.5, color: muted }}>{[b.city, b.parish].filter(Boolean).join(', ') || 'Location'}</Text>
                      </View>
                      <Ionicons name="bookmark-outline" size={17} color={dark ? 'rgba(255,255,255,.5)' : colors.chevron} />
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 20, color: ink, letterSpacing: -0.4, marginTop: 15 }}>{b.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <View style={{ backgroundColor: dark ? colors.accent : colors.dark, borderRadius: 11, paddingVertical: 5, paddingHorizontal: 11 }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 11, color: dark ? colors.accentInk : '#fff' }}>{waitShort(wait)} wait</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: dark ? 'rgba(255,255,255,.1)' : colors.surfaceAlt, borderRadius: 11, paddingVertical: 5, paddingHorizontal: 11 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                        <Text style={{ fontFamily: font.extra, fontSize: 11, color: dark ? '#fff' : colors.sub }}>{meta.label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: muted }}>{Number(b.total_waiting || 0)} in line</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
      <TabBar active="Search" />
    </View>
  );
}
