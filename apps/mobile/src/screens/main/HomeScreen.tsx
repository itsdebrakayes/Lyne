import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, sp, radius, type, initials, personInitials, statusFromWait, statusMeta, waitLabel, waitShort, branchOpenInfo, openTimeLabel, hoursFromBranch, depthText, activeScheme } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { TabBar } from '../../components/TabBar';
import { GlassView, Sheen } from '../../components/Glass';
import { Press } from '../../components/Press';
import { PremiumBadge } from '../../components/PremiumBadge';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

/* Quick actions, each going somewhere DIFFERENT and real.
   These were Nearby / Gov't / Banks / Utilities / Saved — but there is no
   category on a business, so four of the five dropped you on the same
   unfiltered search, and two of them advertised bank and utility queues that
   this product does not serve. Every row below is backed by something the
   system actually knows. */
const QUICK: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  to: string;
  params?: Record<string, unknown>;
  /** True for the one action whose colour carries STATE rather than decoration. */
  stateful?: boolean;
}> = [
  { label: 'Open now', icon: 'flash-outline',     to: 'Search', params: { openNow: true }, stateful: true },
  { label: 'Agencies', icon: 'business-outline',  to: 'Search' },
  { label: 'Saved',    icon: 'bookmark-outline',  to: 'Saved' },
  { label: 'Visits',   icon: 'time-outline',      to: 'History' },
  { label: 'Help',     icon: 'help-circle-outline', to: 'Help' },
];

function Monogram({ label, size = 60, radius = 30, bg = colors.surface, fg = colors.ink, border = true }: { label: string; size?: number; radius?: number; bg?: string; fg?: string; border?: boolean }) {
  const onColor = fg === '#fff' || fg === '#ffffff' || fg === colors.onDark;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, ...shadow.depth }}>
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Sheen radius={radius} strength={0.75} />
        <Text style={{ fontFamily: font.extra, fontSize: size * 0.24, color: fg, ...(onColor ? depthText : null) }}>{label}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const topPad = useTopPad(24);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const firstName = (user?.full_name || '').split(/\s+/)[0] || 'there';
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

  // Branches that are actually OPEN now (by their own hours) rank first — a
  // closed branch's stale low wait must never beat a live line for the hero or
  // the "near you" list.
  const sorted = useMemo(() => {
    const now = new Date();
    const openRank = (b: BranchSummary) => (branchOpenInfo(now, hoursFromBranch(b)).state === 'open' ? 1 : 0);
    return [...branches].sort((a, b) =>
      (openRank(b) - openRank(a)) || Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes));
  }, [branches]);
  const shortest = sorted[0];
  // Hero reflects the best branch's state (sorted open-first). Each row below
  // computes its own state, so branches on different hours read correctly.
  const open = branchOpenInfo(new Date(), shortest ? hoursFromBranch(shortest) : undefined);
  const isOpen = open.state === 'open';
  const soon = open.state === 'about_to_open';
  const closed = open.state === 'closed';
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
        contentContainerStyle={[t.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        {/* greeting header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.85} style={{ borderRadius: 23, ...shadow.depth }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Sheen radius={23} />
              <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 16, ...depthText }}>{personInitials(user?.full_name || 'Q')}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...type.callout, color: colors.sub }}>{timeGreeting()}</Text>
            <Text numberOfLines={1} style={{ ...type.section, color: colors.ink, marginTop: 1 }}>{firstName}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={t.iconBtn}>
            <Ionicons name="notifications-outline" size={19} color={colors.ink} />
            {hasUnread && <View style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: '#fff' }} />}
          </TouchableOpacity>
        </View>

        {/* search */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Search')} style={{ marginBottom: 28 }}>
          <GlassView radius={26} intensity={45} style={{ height: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, ...shadow.card }}>
            <Ionicons name="search-outline" size={17} color={colors.muted} />
            <Text style={t.searchText}>Search agencies & branches</Text>
          </GlassView>
        </TouchableOpacity>

        {/* join hero */}
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={!shortest}
          onPress={() => shortest && openBranch(shortest)}
          style={{ backgroundColor: colors.dark, borderRadius: 30, padding: closed ? 20 : 24, marginBottom: 18, ...shadow.hero }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.section, color: '#fff' }}>
                {isOpen ? 'Tap to join a queue' : soon ? 'Be first in line' : 'Queues are closed'}
              </Text>
              {!closed && (
                <Text style={{ ...type.callout, color: 'rgba(255,255,255,.55)', marginTop: sp.xs }}>
                  {isOpen ? 'Live waits at every branch, in one tap' : 'Doors open soon — line up before the rush'}
                </Text>
              )}
            </View>
            <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: isOpen ? colors.accent : 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={isOpen ? 'arrow-forward' : soon ? 'flash' : 'lock-closed'} size={18} color={isOpen ? colors.accentInk : soon ? colors.accent : 'rgba(255,255,255,.6)'} />
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,.1)', marginVertical: closed ? 15 : 22 }} />
          {isOpen ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flexShrink: 0 }}>
                <Text style={{ ...type.overline, color: 'rgba(255,255,255,.5)' }}>Shortest wait nearby</Text>
                <Text style={{ ...type.numeralSm, color: '#fff', marginTop: sp.s }}>{waitLabel(shortest?.avg_wait_minutes)}</Text>
              </View>
              {shortest && (
                <View style={{ flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 13, paddingVertical: 9, paddingHorizontal: 13, marginBottom: 2 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.light, flexShrink: 0 }} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.bold, fontSize: 12.5, color: '#fff' }}>{shortest.business_slug?.toUpperCase() || initials(shortest.business_name)} · {shortest.name}</Text>
                </View>
              )}
            </View>
          ) : soon ? (
            <View>
              <Text style={{ ...type.overline, color: colors.accent }}>About to open</Text>
              <Text style={{ fontFamily: font.extra, fontSize: 20, color: '#fff', letterSpacing: -0.4, marginTop: 7 }}>{open.detail}</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 18, color: '#fff', letterSpacing: -0.3 }}>Closed now</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{open.detail}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Quick actions.

            These were five pastel hues — blue, green, purple, orange, pink —
            from a generic category palette, sitting above the primary action.
            Five colours imply five categories; these are five peer shortcuts,
            so the colour was decoration pretending to be meaning, and it was
            the least on-brand thing on the screen.

            One accent now, and it is reserved for the single tile whose colour
            says something true: "Open now" lights up only when something
            actually is. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: sp.xxl, marginBottom: sp.xxl }}>
          {QUICK.map(q => {
            const live = q.stateful && isOpen;
            return (
              <Press
                key={q.label}
                label={q.label}
                onPress={() => navigation.navigate(q.to as never, q.params as never)}
                style={{ alignItems: 'center', gap: sp.s, width: 62 }}
              >
                <View style={{
                  width: 56, height: 56, borderRadius: radius.l,
                  backgroundColor: live ? colors.infoSoft : colors.surface,
                  borderWidth: 1, borderColor: live ? 'transparent' : colors.border,
                  alignItems: 'center', justifyContent: 'center', ...shadow.card,
                }}>
                  <Ionicons name={q.icon} size={21} color={live ? colors.accentDeep : colors.sub} />
                </View>
                <Text numberOfLines={1} style={{ ...type.caption, color: colors.sub }}>{q.label}</Text>
              </Press>
            );
          })}
        </View>

        {/* smart timing — plan your visit */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('Plan')} style={{ marginBottom: 8 }}>
          <GlassView radius={24} intensity={40} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, paddingHorizontal: 18, ...shadow.card }}>
            <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={19} color={colors.accentDeep} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ ...type.cardTitle, color: colors.ink }}>Plan your visit</Text>
              <Text numberOfLines={1} style={{ ...type.callout, color: colors.muted, marginTop: sp.xs }}>Best time for every service</Text>
            </View>
            <PremiumBadge size="sm" />
            <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
          </GlassView>
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
            <View style={t.sectionRow}>
              <Text style={t.section}>Top agencies</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ ...type.callout, color: colors.accentDeep }}>See all</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 2 }} style={{ marginBottom: 4 }}>
              {agencies.map(a => (
                <TouchableOpacity key={a.business_id} onPress={() => openAgency(a)} style={{ alignItems: 'center', gap: 9, width: 78 }}>
                  <Monogram label={a.business_slug?.toUpperCase().slice(0, 4) || initials(a.business_name)} />
                  {/* the NAME, not the acronym again — the circle above already
                      says TAJ, and "TAJ / TAJ" tells nobody what TAJ is */}
                  <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 11.5, lineHeight: 14, textAlign: 'center', color: colors.sub }}>
                    {(a.business_name || '').replace(/\s*\([^)]*\)\s*$/, '') || a.business_slug?.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* live near you */}
        {liveNear.length > 0 && (
          <>
            <View style={t.sectionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={t.section}>{isOpen ? 'Live near you' : 'Near you'}</Text>
                {isOpen && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.light }} />}
                {soon && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} />}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}><Text style={{ ...type.callout, color: colors.accentDeep }}>View all</Text></TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              {liveNear.map(b => {
                const wait = Math.round(Number(b.avg_wait_minutes || 0));
                const meta = statusMeta(statusFromWait(wait));
                const loc = [b.city, b.parish].filter(Boolean)[0] || b.business_name;
                const bHours = hoursFromBranch(b);
                const bInfo = branchOpenInfo(new Date(), bHours);
                const bOpen = bInfo.state === 'open';
                const bSoon = bInfo.state === 'about_to_open';
                const dotColor = bOpen ? meta.dot : bSoon ? colors.accent : colors.faint;
                const statusLine = bOpen ? `${meta.label} · ${loc}` : bSoon ? `About to open · ${loc}` : `Closed · ${loc}`;
                return (
                  <TouchableOpacity key={b.id} activeOpacity={0.85} onPress={() => openBranch(b)} style={[t.listRow, { paddingVertical: 16, paddingRight: 18, gap: 15, ...shadow.card }]}>
                    <Monogram label={initials(b.business_name)} size={46} radius={15} bg={colors.surfaceAlt} border={false} />
                    <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                      <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 16.5, color: colors.ink, letterSpacing: -0.3 }}>{b.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.medium, fontSize: 13.5, color: colors.muted }}>{statusLine}</Text>
                      </View>
                    </View>
                    {bOpen ? (
                      <Text style={{ fontFamily: font.extra, fontSize: 16.5, color: colors.ink }}>{waitShort(wait)}</Text>
                    ) : (
                      <View style={{ backgroundColor: bSoon ? colors.infoSoft : colors.surfaceAlt, borderRadius: 11, paddingVertical: 6, paddingHorizontal: 10 }}>
                        <Text style={{ fontFamily: font.bold, fontSize: 12, color: bSoon ? colors.accentDeep : colors.muted }}>Opens {openTimeLabel(bHours)}</Text>
                      </View>
                    )}
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
