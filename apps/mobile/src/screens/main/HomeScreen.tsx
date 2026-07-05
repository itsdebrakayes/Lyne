import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, categoryTints, initials, statusFromWait, statusMeta, waitLabel, waitShort } from '../../lib/theme';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { TabBar } from '../../components/TabBar';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';

const QUICK: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; tint: keyof typeof categoryTints }> = [
  { label: 'Nearby', icon: 'location-outline', tint: 'blue' },
  { label: "Gov't", icon: 'business-outline', tint: 'green' },
  { label: 'Banks', icon: 'card-outline', tint: 'purple' },
  { label: 'Utilities', icon: 'flash-outline', tint: 'orange' },
  { label: 'Saved', icon: 'bookmark-outline', tint: 'pink' },
];

function Monogram({ label, size = 60, radius = 30, bg = colors.surface, fg = colors.ink, border = true }: { label: string; size?: number; radius?: number; bg?: string; fg?: string; border?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.extra, fontSize: size * 0.24, color: fg }}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const { data: branches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });

  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Array<{ id: string; is_read: boolean | number }>>('/notifications'),
    refetchInterval: 30_000,
  });
  const hasUnread = notifications.some(n => !n.is_read);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetch(), refetchNotifications()]);
    setRefreshing(false);
  }, [refetch, refetchNotifications]);

  // Branches with open queues rank first — a closed branch's stale low wait
  // must never beat a live line for the hero or the "near you" list.
  const sorted = useMemo(() => [...branches].sort((a, b) =>
    (Number(Number(b.open_queues) > 0) - Number(Number(a.open_queues) > 0))
    || Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes)
  ), [branches]);
  const shortest = sorted[0];
  const agencies = useMemo(() => {
    const seen = new Set<string>();
    return branches.filter(b => (seen.has(b.business_id) ? false : (seen.add(b.business_id), true))).slice(0, 8);
  }, [branches]);
  const liveNear = sorted.slice(0, 4);

  const openBranch = (b: BranchSummary) => navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });
  const openAgency = (b: BranchSummary) => navigation.navigate('Business', { businessId: b.business_id, businessName: b.business_name });

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={t.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')} style={t.iconBtn}>
            <Ionicons name="grid-outline" size={19} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 14 }}>Q</Text>
            </View>
            <Text style={{ fontFamily: font.extra, fontSize: 17, letterSpacing: 2, color: colors.ink }}>QME NOW</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={t.iconBtn}>
            <Ionicons name="notifications-outline" size={19} color={colors.ink} />
            {hasUnread && <View style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: '#fff' }} />}
          </TouchableOpacity>
        </View>

        {/* search */}
        <TouchableOpacity onPress={() => navigation.navigate('Search')} style={[t.search, { marginBottom: 20 }]}>
          <Ionicons name="search-outline" size={17} color={colors.muted} />
          <Text style={t.searchText}>Search agencies & branches</Text>
        </TouchableOpacity>

        {/* quick actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 }}>
          {QUICK.map(q => {
            const tint = categoryTints[q.tint];
            return (
              <TouchableOpacity key={q.label} onPress={() => navigation.navigate(q.label === 'Saved' ? 'Saved' : 'Search')} style={{ alignItems: 'center', gap: 8, width: 58 }}>
                <View style={{ width: 54, height: 54, borderRadius: 19, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={q.icon} size={21} color={tint.fg} />
                </View>
                <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.sub }}>{q.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* join hero */}
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!shortest}
          onPress={() => shortest && openBranch(shortest)}
          style={{ backgroundColor: colors.dark, borderRadius: 28, padding: 22, marginBottom: 24, ...shadow.hero }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 19, color: '#fff', letterSpacing: -0.4 }}>Tap to join a queue</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 1 }}>Live waits at every branch, in one tap</Text>
            </View>
            <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 19 }}>→</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,.1)', marginVertical: 20 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flexShrink: 0 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Shortest wait nearby</Text>
              <Text style={{ fontFamily: font.extra, fontSize: 30, color: '#fff', letterSpacing: -1, marginTop: 8 }}>{waitLabel(shortest?.avg_wait_minutes)}</Text>
            </View>
            {shortest && (
              <View style={{ flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 13, paddingVertical: 8, paddingHorizontal: 13, marginBottom: 2 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.light, flexShrink: 0 }} />
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.extra, fontSize: 12, color: '#fff' }}>{shortest.business_slug?.toUpperCase() || initials(shortest.business_name)} · {shortest.name}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* smart timing — plan your visit */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('Plan')} style={[t.card, { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 22, marginBottom: 24 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: '#eef8fb', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={19} color={colors.accentDeep} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>Plan your visit</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 1 }}>Best time for every service, at every branch</Text>
          </View>
          <View style={{ backgroundColor: colors.dark, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 8.5, color: colors.accent, letterSpacing: 0.8 }}>PREMIUM</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
        </TouchableOpacity>

        {isLoading && <SkeletonRows count={4} />}
        {!!error && !isLoading && (
          <ErrorCard
            title="Live data unavailable"
            message="We couldn't reach the queue service. Check your connection and try again."
            onRetry={() => refetch()}
          />
        )}

        {/* top agencies */}
        {agencies.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={t.section}>Top agencies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>See all</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 2 }} style={{ marginBottom: 24 }}>
              {agencies.map(a => (
                <TouchableOpacity key={a.business_id} onPress={() => openAgency(a)} style={{ alignItems: 'center', gap: 8, width: 62 }}>
                  <Monogram label={a.business_slug?.toUpperCase().slice(0, 4) || initials(a.business_name)} />
                  <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 10.5, color: colors.sub }}>{a.business_slug?.toUpperCase() || initials(a.business_name)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* live near you */}
        {liveNear.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={t.section}>Live near you</Text>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.light }} />
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>View all</Text></TouchableOpacity>
            </View>
            <View style={{ gap: 11 }}>
              {liveNear.map(b => {
                const wait = Math.round(Number(b.avg_wait_minutes || 0));
                const meta = statusMeta(statusFromWait(wait));
                return (
                  <TouchableOpacity key={b.id} activeOpacity={0.85} onPress={() => openBranch(b)} style={t.listRow}>
                    <Monogram label={initials(b.business_name)} size={48} radius={16} bg={colors.surfaceAlt} border={false} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{b.name}</Text>
                      <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted }}>{b.business_name} · {[b.city, b.parish].filter(Boolean)[0] || ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink }}>{waitShort(wait)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                        <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: colors.muted }}>{meta.label}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      <TabBar active="Home" />
    </View>
  );
}

export { Monogram };
