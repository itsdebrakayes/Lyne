import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, shadow, t, companyGradients, initials, statusFromWait, statusMeta, waitShort } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness } from '../../lib/mobileData';
import { TabBar } from '../../components/TabBar';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data: saved = [], isLoading, error, refetch } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });
  const { data: branches = [], refetch: refetchBranches } = useQuery({ queryKey: ['mobile-branches'], queryFn: () => api.get<BranchSummary[]>('/branches', false), refetchInterval: 30_000 });

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

  const savedIds = new Set(saved.map(s => s.id));
  const exploreBusinesses = useMemo(() => {
    const seen = new Set<string>();
    return branches.filter(b => !savedIds.has(b.business_id) && (seen.has(b.business_id) ? false : (seen.add(b.business_id), true))).slice(0, 6);
  }, [branches, saved]);

  const unsave = useMutation({
    mutationFn: (businessId: string) => api.delete(`/saved/${businessId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  const bestBranch = (businessId: string) => {
    const list = branchesByBusiness[businessId] || [];
    return [...list].sort((a, b) => Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes))[0];
  };
  const openBranch = (b: BranchSummary) => navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={t.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted }}>Your saved companies</Text>
        <Text style={[t.h2, { marginTop: 5 }]}>Welcome to your{'\n'}favorite companies</Text>

        {isLoading && <View style={{ marginTop: 22 }}><SkeletonRows count={3} /></View>}
        {!!error && !isLoading && (
          <View style={{ marginTop: 20 }}>
            <ErrorCard title="Saved list unavailable" message="Your saved companies could not be loaded right now." onRetry={() => refetch()} />
          </View>
        )}

        {!isLoading && !error && saved.length === 0 && (
          <View style={[t.cardLg, { padding: 22, alignItems: 'center', marginTop: 22 }]}>
            <Ionicons name="bookmark-outline" size={30} color={colors.muted} />
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginTop: 12 }}>Nothing saved yet</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 6 }}>Save a company from its branch page to keep it here for quick queueing.</Text>
            <TouchableOpacity style={[t.primaryBtn, { marginTop: 16, alignSelf: 'stretch' }]} onPress={() => navigation.navigate('Search')}><Text style={t.primaryBtnText}>Explore companies</Text></TouchableOpacity>
          </View>
        )}

        {/* favorite company cards */}
        {saved.length > 0 && (
          <>
            <Text style={[t.section, { marginTop: 22, marginBottom: 14 }]}>Your favorites</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8, paddingBottom: 6 }} style={{ marginBottom: 24 }}>
              {saved.map((company, index) => {
                const grad = companyGradients[index % companyGradients.length];
                const list = branchesByBusiness[company.id] || [];
                const best = bestBranch(company.id);
                return (
                  <LinearGradient key={company.id} colors={grad.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 280, borderRadius: 28, padding: 20, ...shadow.hero, shadowColor: grad.colors[0] }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{initials(company.name)}</Text>
                      </View>
                      <TouchableOpacity onPress={() => unsave.mutate(company.id)} disabled={unsave.isPending} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="bookmark" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <Text numberOfLines={2} style={{ fontFamily: font.extra, fontSize: 20, color: '#fff', letterSpacing: -0.4, lineHeight: 24, marginTop: 15 }}>{company.name}</Text>
                    {!!company.description && <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 6 }}>{company.description}</Text>}

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 18 }}>
                      <View style={{ flexDirection: 'row' }}>
                        {list.slice(0, 3).map((br, i) => (
                          <View key={br.id} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.22)', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: i === 0 ? 0 : -8 }}>
                            <Text style={{ fontFamily: font.extra, fontSize: 10, color: '#fff' }}>{initials(br.name)}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.8)' }}>{list.length} {list.length === 1 ? 'branch' : 'branches'}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 9 }}>
                      <TouchableOpacity onPress={() => best && openBranch(best)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.16)', borderRadius: 15, padding: 9, paddingHorizontal: 14 }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 10, color: 'rgba(255,255,255,.75)' }}>Nearest branch</Text>
                        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 13.5, color: '#fff' }}>{best ? `${best.name} · ${waitShort(best.avg_wait_minutes)}` : 'No live branch'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => best && openBranch(best)} style={{ width: 52, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink, lineHeight: 20 }}>→</Text>
                        <Text style={{ fontFamily: font.extra, fontSize: 9, color: colors.ink }}>Join</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* explore more */}
        {exploreBusinesses.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={t.section}>Explore more companies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>See all</Text></TouchableOpacity>
            </View>
            <View style={{ gap: 11 }}>
              {exploreBusinesses.map(b => {
                const wait = Math.round(Number(b.avg_wait_minutes || 0));
                const meta = statusMeta(statusFromWait(wait));
                return (
                  <TouchableOpacity key={b.business_id} activeOpacity={0.85} onPress={() => openBranch(b)} style={t.listRow}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{initials(b.business_name)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{b.business_name}</Text>
                      <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted }}>{[b.city, b.parish].filter(Boolean).join(', ') || 'Location'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceAlt, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 11 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                      <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.ink }}>{waitShort(wait)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      <TabBar active="Saved" />
    </View>
  );
}
