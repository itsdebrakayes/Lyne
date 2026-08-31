/**
 * SearchScreen — v5, built on the job-finder results layout from the reference
 * set: query field carrying mic + avatar, Filters / Sort dropdowns, agency
 * chips with a blue selection, a found-count, then result cards with a bookmark
 * in the corner and the wait where the salary used to be.
 *
 * Three states are preserved from the previous version:
 *   1. First use         → suggestions
 *   2. Idle with history → recent searches
 *   3. Searching         → chips + count + results
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, shadow, t, initials, inputReset, personInitials, waitShort, branchOpenInfo, hoursFromBranch, openTimeLabel, TAB_BAR_CLEARANCE } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { TabBar } from '../../components/TabBar';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import Icon from '../../components/Icon';

const RECENTS_KEY = 'lyne.recent-searches';
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


/**
 * A short tag for an organisation chip.
 *
 * The slug was uppercased straight through, which is fine for an agency whose
 * slug is already an acronym (TAJ, PICA, NHT) but rendered the credit union as
 * "COMMUNITY-FIRST" — a URL fragment shown to a customer. A slug is only a good
 * tag when it already reads like one.
 */
const orgTag = (slug?: string, name?: string) => {
  const sl = (slug || '').trim();
  if (sl && sl.length <= 5 && !sl.includes('-')) return sl.toUpperCase();
  return initials(name || '') || sl.toUpperCase().slice(0, 4);
};

/**
 * A chip label somebody can actually read.
 *
 * The filter row was a line of acronyms — KSA, FHC, CFC, PICA, TAJ, NHT, UTECH,
 * UWI — which is a row of eight things a person has to already know to use. A
 * few are common currency in Jamaica (TAJ, NHT, PICA); most are not, and "FHC"
 * or "CFC" tells a first-time user nothing at all about which one to tap.
 *
 * So the name leads, trimmed of the words that make every entry look alike.
 * "Community First Credit Union" is "Community First"; "Passport Office of
 * Jamaica (PICA)" is "Passport Office". Anything still too long to sit in a
 * chip falls back to the acronym, because a truncated name with an ellipsis is
 * no more readable than the initials were.
 */
const NOISE = /\s*\([^)]*\)\s*$|[,]?\s+(?:of Jamaica|Jamaica|Limited|Ltd\.?)$/i;
const GENERIC_TAIL = /\s+(?:Co-operative Credit Union|Credit Union|Administration|Trust|Authority)$/i;

/**
 * Where an institution's everyday name is not derivable from its legal one.
 *
 * No amount of trimming turns "Kingston & St Andrew Parish Court — Traffic
 * Division" into what a person in Kingston calls it, and stripping words off
 * "The University of the West Indies, Mona" only produces something worse than
 * the acronym everyone already uses. UWI and UTech ARE the common names here,
 * so they stay; the court and the passport office get the words people
 * actually say.
 *
 * Keyed on the business slug, which is stable, rather than the display name,
 * which is not.
 */
const COMMON_NAME: Record<string, string> = {
  'traffic-court': 'Traffic Court',
  'uwi-mona': 'UWI Mona',
  'utech': 'UTech',
  'pica': 'Passport Office',
};

function orgLabel(name?: string, slug?: string): string {
  const key = (slug || '').trim().toLowerCase();
  if (COMMON_NAME[key]) return COMMON_NAME[key];

  /* Repeatedly, not once: "Passport Office of Jamaica (PICA)" has to lose both
     the bracket and the "of Jamaica" to become readable, and a single
     non-global replace only takes the first. */
  let cleaned = (name || '').trim();
  for (let i = 0; i < 3; i += 1) {
    const next = cleaned.replace(NOISE, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  const short = cleaned.replace(GENERIC_TAIL, '').trim();
  const best = short.length >= 4 ? short : cleaned;
  if (!best) return orgTag(slug, name);
  return best.length <= 20 ? best : orgTag(slug, name);
}

export default function SearchScreen() {
  const topPad = useTopPad(10);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  const [bizFilter, setBizFilter] = useState<string | null>(route.params?.businessId ?? null);
  const [openOnly, setOpenOnly] = useState(Boolean(route.params?.openNow));
  const [nearestFirst, setNearestFirst] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { data: branches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });
  const { data: saved = [] } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });

  useEffect(() => { loadRecents().then(setRecents); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Optimistic bookmark, same rule as the branch screen: it fills instantly and
  // rolls back only if the request actually fails.
  const toggleSave = useMutation({
    mutationFn: (input: { businessId: string; isSaved: boolean; name: string }) =>
      (input.isSaved ? api.delete(`/saved/${input.businessId}`) : api.post(`/saved/${input.businessId}`, {})),
    onMutate: async ({ businessId, isSaved, name }) => {
      await queryClient.cancelQueries({ queryKey: ['saved-businesses'] });
      const previous = queryClient.getQueryData<SavedBusiness[]>(['saved-businesses']) || [];
      queryClient.setQueryData<SavedBusiness[]>(['saved-businesses'], isSaved
        ? previous.filter(b => b.id !== businessId)
        : [...previous, { id: businessId, name, slug: '', saved_at: new Date().toISOString() }]);
      return { previous };
    },
    onError: (_e, _v, context) => { if (context?.previous) queryClient.setQueryData(['saved-businesses'], context.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  const businesses = useMemo(() => {
    const seen = new Map<string, string>();
    branches.forEach(b => {
      if (!seen.has(b.business_id)) seen.set(b.business_id, orgLabel(b.business_name, b.business_slug));
    });
    return Array.from(seen.entries()).map(([id, tag]) => ({ id, tag }));
  }, [branches]);

  const term = search.trim().toLowerCase();
  const searching = term.length > 0;

  const results = useMemo(() => {
    let list = branches;
    if (term) list = list.filter(b => [b.name, b.business_name, b.city, b.parish].some(v => v?.toLowerCase().includes(term)));
    if (bizFilter) list = list.filter(b => b.business_id === bizFilter);
    // "Open" means the same thing here as everywhere else: the branch is inside
    // its own opening hours AND has a live queue. Filtering on open_queues alone
    // called Half Way Tree open at 2am, directly contradicting the Home screen.
    if (openOnly) {
      const now = new Date();
      list = list.filter(b =>
        branchOpenInfo(now, hoursFromBranch(b)).state === 'open' && Number(b.open_queues) > 0);
    }
    return [...list].sort((a, b) => (nearestFirst
      ? Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes)
      : (a.name || '').localeCompare(b.name || '')));
  }, [branches, term, bizFilter, openOnly, nearestFirst]);

  const openBranch = (b: BranchSummary) => {
    pushRecent(search).then(() => loadRecents().then(setRecents));
    navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });
  };

  const filtersActive = searching || !!bizFilter || openOnly;

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* query field */}
        <View style={{ height: 56, borderRadius: 18, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 16, paddingRight: 8, marginTop: 10, ...shadow.card }}>
          <Icon name="search" size={20} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search agencies & branches"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            onSubmitEditing={() => pushRecent(search).then(() => loadRecents().then(setRecents))}
            style={[{ flex: 1, fontFamily: font.bold, fontSize: 14.5, color: colors.ink }, inputReset]}
          />
          {searching ? (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"
              style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={colors.sub} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accentInk }}>{personInitials(user?.full_name || 'Q')}</Text>
            </View>
          )}
        </View>

        {/* filters / sort */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <TouchableOpacity onPress={() => setOpenOnly(v => !v)} accessibilityRole="button"
            accessibilityLabel={openOnly ? 'Showing open branches only. Tap to show all.' : 'Showing all branches. Tap to show open only.'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Icon name="filter" size={17} color={openOnly ? colors.accent : colors.ink} />
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: openOnly ? colors.accent : colors.ink }}>{openOnly ? 'Open now' : 'Filters'}</Text>
            <Icon name="chevronDown" size={12} color={openOnly ? colors.accent : colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNearestFirst(v => !v)} accessibilityRole="button" accessibilityLabel="Change sort order"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink }}>{nearestFirst ? 'Shortest wait' : 'A–Z'}</Text>
            <Icon name="chevronDown" size={12} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* agency chips */}
        {businesses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingVertical: 2 }} style={{ marginTop: 16 }}>
            {businesses.map(b => {
              const on = bizFilter === b.id;
              return (
                <TouchableOpacity key={b.id} onPress={() => setBizFilter(on ? null : b.id)} accessibilityRole="button"
                  style={{ borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: on ? colors.accent : colors.surface, ...shadow.card }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: on ? colors.accentInk : colors.muted }}>{b.tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* idle: suggestions or recents */}
        {!filtersActive && (
          <View style={{ marginTop: 20 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, letterSpacing: -0.3, marginBottom: 12 }}>
              {recents.length ? 'Recent searches' : 'Try one of these'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {(recents.length ? recents : SUGGESTIONS).map(item => (
                <TouchableOpacity key={item} onPress={() => setSearch(item)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 15, ...shadow.card }}>
                  <Icon name={recents.length ? 'clock' : 'search'} size={15} color={colors.muted} />
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.ink }}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {isLoading && <SkeletonRows count={4} />}
        {!!error && !isLoading && (
          <ErrorCard title="Search unavailable" message="We couldn't reach the queue service. Check your connection and try again." onRetry={() => refetch()} />
        )}

        {/* Idle used to end here, leaving two thirds of the screen empty below a
            row of suggestion pills — a search screen that asks you to type
            before it will show you anything, when the whole list is already
            loaded and worth browsing. The results below now render whether or
            not a filter is on; this heading names which of the two you are
            looking at. */}
        {!isLoading && !error && !filtersActive && results.length > 0 && (
          <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, letterSpacing: -0.3, marginTop: 26, marginBottom: 12 }}>
            Every agency on Lyne
          </Text>
        )}

        {/* found count */}
        {!isLoading && !error && filtersActive && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, letterSpacing: -0.3 }}>
              {results.length} branch{results.length === 1 ? '' : 'es'} found
            </Text>
            {(bizFilter || openOnly) && (
              <TouchableOpacity onPress={() => { setBizFilter(null); setOpenOnly(false); }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.accent }}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* no matches */}
        {!isLoading && !error && filtersActive && results.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 34 }}>
            <View style={{ width: 132, height: 132, borderRadius: 44, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 26, ...shadow.card }}>
              <Icon name="search" size={58} color={colors.faint} />
            </View>
            <Text style={{ fontFamily: font.extra, fontSize: 24, color: colors.ink, letterSpacing: -0.8 }}>No branches match</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 280 }}>
              {searching ? `Nothing here for “${search.trim()}”. Check the spelling, or browse every agency instead.` : 'No branches match these filters.'}
            </Text>
            <TouchableOpacity onPress={() => { setSearch(''); setBizFilter(null); setOpenOnly(false); }}
              style={{ backgroundColor: colors.accent, borderRadius: 17, paddingVertical: 16, paddingHorizontal: 26, marginTop: 24 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Browse all agencies</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* results */}
        {!isLoading && !error && results.map(b => {
          const wait = Math.round(Number(b.avg_wait_minutes || 0));
          const hours = hoursFromBranch(b);
          const info = branchOpenInfo(new Date(), hours);
          const isOpen = info.state === 'open';
          const isSaved = saved.some(s => s.id === b.business_id);
          return (
            <TouchableOpacity key={b.id} activeOpacity={0.9} onPress={() => openBranch(b)}
              style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 16, marginBottom: 12, ...shadow.card }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 12, color: '#fff' }}>{orgTag(b.business_slug, b.business_name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>
                      {(b.business_name || '').replace(/\s*\([^)]*\)\s*$/, '')}
                    </Text>
                    <Icon name="check" size={14} color={colors.accent} />
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 16.5, color: colors.ink, letterSpacing: -0.5, marginTop: 3 }}>{b.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => toggleSave.mutate({ businessId: b.business_id, isSaved, name: b.business_name })}
                  accessibilityRole="button" accessibilityLabel={isSaved ? `Remove ${b.business_name} from saved` : `Save ${b.business_name}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name={isSaved ? 'bookmarkFilled' : 'bookmark'} size={21} color={isSaved ? colors.accent : colors.chevron} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                {[b.city, `${Number(b.open_queues || 0)} open`, isOpen ? info.detail : `Opens ${openTimeLabel(hours)}`]
                  .filter(Boolean).map((chip, i) => (
                    <Text key={i} style={{ fontFamily: font.bold, fontSize: 11.5, color: colors.muted, backgroundColor: colors.surfaceAlt, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 11 }}>{chip}</Text>
                  ))}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.muted }}>
                  {isOpen ? <><Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink }}>{waitShort(wait)}</Text> · {Number(b.total_waiting || 0)} in line</> : 'Closed right now'}
                </Text>
                <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.infoSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accent }}>{isOpen ? 'Join' : 'View'}</Text>
                  <Icon name="arrowUpRight" size={15} color={colors.accent} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TabBar active="Search" />
    </View>
  );
}
