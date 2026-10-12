/**
 * SearchScreen — the "App Screens Refresh" Search (1b): a large title, one
 * query field, a single chip row (All, Open now, each agency), Recent in a
 * grouped card, and every branch as a row in one grouped list with its wait on
 * the right. Saving an agency moved off the result rows with the redesign; it
 * stays on the agency and branch screens.
 *
 * Three states are preserved from the previous version:
 *   1. First use         → suggestions
 *   2. Idle with history → recent searches
 *   3. Searching         → chips + count + results
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, t, initials, inputReset, waitShort, branchOpenInfo, hoursFromBranch, openTimeLabel, TAB_BAR_CLEARANCE } from '../../lib/theme';
import { MatchRank, rankMatch } from '../../lib/fuzzy';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { useContentColumn } from '../../lib/stage';
import { TabBar } from '../../components/TabBar';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import Icon from '../../components/Icon';

const RECENTS_KEY = 'lyne.recent-searches';
/* Generic kinds of visit, never an agency's name: these show on a fresh install
   and in the store screenshots, where naming a real organisation would imply a
   partnership we do not have. */
const SUGGESTIONS = ['Tax payments', 'Document collection', 'Member services', 'Clinic registration'];

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
  const column = useContentColumn();
  const topPad = useTopPad(10);
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
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

  useEffect(() => { loadRecents().then(setRecents); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
    /* Forgiving match, ranked. The old test was `.includes(term)` on four
       fields, which meant "halfway tree" found nothing (the branch is recorded
       as "Half Way Tree") and one mistyped letter in "Passport" found nothing
       either. rankMatch keeps exact hits ahead of near ones — see lib/fuzzy.ts.

       business_slug is in the searchable set so the acronyms people actually
       type — TAJ, PICA, NHT — reach the organisation whose full name never
       contains those letters in that order. */
    let ranked: Map<string, number> | null = null;
    if (term) {
      ranked = new Map();
      list = list.filter(b => {
        const rank = rankMatch(term, [b.name, b.business_name, b.city, b.parish, b.business_slug]);
        if (rank === MatchRank.None) return false;
        ranked!.set(b.id, rank);
        return true;
      });
    }
    if (bizFilter) list = list.filter(b => b.business_id === bizFilter);
    // "Open" means the same thing here as everywhere else: the branch is inside
    // its own opening hours AND has a live queue. Filtering on open_queues alone
    // called Half Way Tree open at 2am, directly contradicting the Home screen.
    if (openOnly) {
      const now = new Date();
      list = list.filter(b =>
        branchOpenInfo(now, hoursFromBranch(b)).state === 'open' && Number(b.open_queues) > 0);
    }
    return [...list].sort((a, b) => {
      /* While searching, match quality leads. Somebody who typed a branch name
         exactly should see it first, not below a fuzzy hit that happens to have
         a shorter queue. Within one rank the chosen sort decides, as before. */
      if (ranked) {
        const byRank = (ranked.get(a.id) ?? MatchRank.None) - (ranked.get(b.id) ?? MatchRank.None);
        if (byRank !== 0) return byRank;
      }
      return nearestFirst
        ? Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes)
        : (a.name || '').localeCompare(b.name || '');
    });
  }, [branches, term, bizFilter, openOnly, nearestFirst]);

  const openBranch = (b: BranchSummary) => {
    pushRecent(search).then(() => loadRecents().then(setRecents));
    navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });
  };

  const filtersActive = searching || !!bizFilter || openOnly;

  const clearRecents = async () => {
    setRecents([]);
    await AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
  };

  // One chip row: All, Open now, then each agency (App Screens Refresh 1b).
  const chips: Array<{ key: string; label: string; on: boolean; onPress: () => void }> = [
    { key: 'all', label: 'All', on: !bizFilter && !openOnly, onPress: () => { setBizFilter(null); setOpenOnly(false); } },
    { key: 'open', label: 'Open now', on: openOnly, onPress: () => setOpenOnly(v => !v) },
    ...businesses.map(b => ({ key: b.id, label: b.tag, on: bizFilter === b.id, onPress: () => setBizFilter(bizFilter === b.id ? null : b.id) })),
  ];

  const sep = { borderBottomWidth: 1, borderBottomColor: colors.borderSoft } as const;

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: TAB_BAR_CLEARANCE + lift, ...column }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 32, letterSpacing: -0.8, lineHeight: 35, color: colors.ink }}>Search</Text>

        {/* query field */}
        <View style={{ height: 52, marginTop: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 8 }}>
          <Icon name="search" size={18} color={colors.muted} />
          {/* The hint is drawn as our own Text, not the native placeholder: iOS
              release builds spread the native placeholder's letters across the
              field ("A g e n c y ,  b r a n c h"). */}
          <View style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
            {!search && (
              <Text pointerEvents="none" numberOfLines={1} style={{ position: 'absolute', left: 0, right: 0, fontFamily: font.medium, fontSize: 15, color: colors.muted }}>
                Agency, branch or service
              </Text>
            )}
            <TextInput
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              accessibilityLabel="Search agencies, branches or services"
              onSubmitEditing={() => pushRecent(search).then(() => loadRecents().then(setRecents))}
              style={[{ height: '100%', fontFamily: font.medium, fontSize: 15, color: colors.ink }, inputReset]}
            />
          </View>
          {searching && (
            <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search"
              style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color={colors.sub} />
            </TouchableOpacity>
          )}
        </View>

        {/* chips */}
        {businesses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {chips.map(c => (
              <TouchableOpacity key={c.key} onPress={c.onPress} accessibilityRole="button" accessibilityState={{ selected: c.on }}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', backgroundColor: c.on ? colors.dark : colors.surface, borderWidth: 1, borderColor: c.on ? colors.dark : colors.border }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: c.on ? '#fff' : colors.ink }}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* recent searches (or suggestions on first use) */}
        {!filtersActive && branches.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 17, color: colors.ink }}>{recents.length ? 'Recent' : 'Try one of these'}</Text>
              {recents.length > 0 && (
                <TouchableOpacity onPress={clearRecents} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.accent }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ marginTop: 8, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft }}>
              {(recents.length ? recents.slice(0, 4) : SUGGESTIONS).map((item, i, arr) => (
                <TouchableOpacity key={item} onPress={() => setSearch(item)} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 }}>
                  <Icon name={recents.length ? 'clock' : 'search'} size={16} color={colors.muted} />
                  <View style={[{ flex: 1, height: 48, justifyContent: 'center', paddingRight: 16 }, i < arr.length - 1 ? sep : null]}>
                    <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 15, color: colors.ink }}>{item}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {isLoading && <View style={{ marginTop: 24 }}><SkeletonRows count={4} /></View>}
        {!!error && !isLoading && (
          <View style={{ marginTop: 24 }}>
            <ErrorCard title="Search unavailable" message="We couldn't reach the queue service. Check your connection and try again." onRetry={() => refetch()} />
          </View>
        )}

        {/* results heading + sort */}
        {!isLoading && !error && results.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 17, color: colors.ink }}>
              {filtersActive ? `${results.length} branch${results.length === 1 ? '' : 'es'} found` : 'Every agency on Lyne'}
            </Text>
            <TouchableOpacity onPress={() => setNearestFirst(v => !v)} accessibilityRole="button" accessibilityLabel={`Sorted by ${nearestFirst ? 'shortest wait' : 'name'}. Tap to change.`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.sub }}>{nearestFirst ? 'Shortest wait' : 'A–Z'}</Text>
              <Icon name="chevronDown" size={12} color={colors.sub} />
            </TouchableOpacity>
          </View>
        )}

        {/* results */}
        {!isLoading && !error && results.length > 0 && (
          <View style={{ marginTop: 12, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft }}>
            {results.map((b, i) => {
              const wait = Math.round(Number(b.avg_wait_minutes || 0));
              const hours = hoursFromBranch(b);
              const info = branchOpenInfo(new Date(), hours);
              const isOpen = info.state === 'open';
              const agency = (b.business_name || '').replace(/\s*\([^)]*\)\s*$/, '');
              return (
                <TouchableOpacity key={b.id} activeOpacity={0.85} onPress={() => openBranch(b)} accessibilityRole="button"
                  accessibilityLabel={`${b.name}, ${agency}. ${isOpen ? `${waitShort(wait)} wait, ${Number(b.total_waiting || 0)} in line` : info.detail}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: font.semibold, fontSize: 12, color: '#fff' }}>{orgTag(b.business_slug, b.business_name)}</Text>
                  </View>
                  <View style={[{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingRight: 16 }, i < results.length - 1 ? sep : null]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 15, color: colors.ink }}>{b.name}</Text>
                      <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>
                        {agency} · {isOpen ? info.detail : `Opens ${openTimeLabel(hours)}`}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: font.semibold, fontSize: 15, color: isOpen ? colors.accent : colors.muted, fontVariant: ['tabular-nums'] }}>{isOpen ? waitShort(wait) : 'Closed'}</Text>
                      {isOpen && <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 2 }}>{Number(b.total_waiting || 0)} in line</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* no matches */}
        {!isLoading && !error && filtersActive && results.length === 0 && branches.length > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 34 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 }}>No branches match</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21, maxWidth: 280 }}>
              {searching ? `Nothing here for “${search.trim()}”. Check the spelling, or browse every agency instead.` : 'No branches match these filters.'}
            </Text>
            <TouchableOpacity onPress={() => { setSearch(''); setBizFilter(null); setOpenOnly(false); }}
              style={{ backgroundColor: colors.dark, borderRadius: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 22, marginTop: 20 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#fff' }}>Browse all agencies</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Nothing on Lyne at all: the same words Home uses, because it is the same fact. */}
        {!isLoading && !error && branches.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 22, color: colors.ink, letterSpacing: -0.5 }}>No agencies yet</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 21, maxWidth: 300 }}>
              When an agency joins Lyne, its branches and live wait times appear here, and you can search them by name, town or service.
            </Text>
          </View>
        )}
      </ScrollView>
      <TabBar active="Search" />
    </View>
  );
}
