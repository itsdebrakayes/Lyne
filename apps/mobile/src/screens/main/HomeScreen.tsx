import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, font, shadow, t, sp, type, initials, personInitials, statusFromWait, statusMeta, waitShort, waitPhrase, branchOpenInfo, openTimeLabel, hoursFromBranch, depthText, TAB_BAR_CLEARANCE, radius} from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { TabBar, useActiveTicket } from '../../components/TabBar';
import { Sheen } from '../../components/Glass';
import { ErrorCard, Section, SkeletonRows } from '../../components/Feedback';
import { Press } from '../../components/Press';
import { sessionDayLabel } from './SessionScreen';
import { homeLocationLabel, usePreferences } from '../../lib/preferences';
import Icon, { IconName } from '../../components/Icon';
import Appear from '../../components/Appear';

/**
 * Marketplace — v5.
 *
 * The old quick-action row (Open now / Agencies / Saved / Visits / Help) was
 * five peer shortcuts wearing the costume of a category picker. In the approved
 * design that row IS a category picker, so it now filters by sector — which the
 * data actually carries. Saved and Profile live in the tab bar, so nothing that
 * row used to reach has been lost.
 *
 * Sectors are derived from the businesses on screen rather than hardcoded from
 * sector_profiles: a demo that is all government agencies should not show five
 * dead filters, and a credit union onboarded next week should appear without a
 * code change.
 */

const SECTOR_ICON: Record<string, IconName> = {
  government_revenue: 'government',
  judiciary: 'government',
  financial_services: 'financial',
  microfinance: 'financial',
  university: 'education',
  diagnostics: 'health',
};

const SECTOR_LABEL: Record<string, string> = {
  government_revenue: 'Government',
  judiciary: 'Courts',
  financial_services: 'Financial',
  microfinance: 'Microfinance',
  university: 'Education',
  diagnostics: 'Health',
};

interface BusinessRow { id: string; name: string; sector?: string | null; slug?: string }

/**
 * Sector filter — parked, not deleted.
 *
 * The row only has content worth showing once at least a few sectors have
 * businesses in them. With just Government populated it rendered as a wide
 * white box holding two tiles and a lot of nothing. The code stays so it can
 * come back the day a credit union or a university is onboarded; flip this to
 * true then. Everything below is sized for the space it frees up.
 */
/* Below this many organisations, Home stops pretending to be a marketplace.

   "Shortest waits" above one lonely card, then "Agencies near you" above the
   same card again, is a screen announcing an emptiness it could have simply not
   announced. The launch state instead gives the one participating organisation
   real room and fills the rest with things that are true regardless of how many
   clients exist — how Lyne works, and that more are coming.

   Two, not one: the same problem exists with a pair. */
const SPARSE_MAX = 2;

const SHOW_SECTOR_FILTER = false;

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
  const topPad = useTopPad(18);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [sector, setSector] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(true);
  const firstName = (user?.full_name || '').split(/\s+/)[0] || 'there';
  const ticket = useActiveTicket();
  const { prefs } = usePreferences();

  const { data: branches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mobile-branches'],
    queryFn: () => api.get<BranchSummary[]>('/branches', false),
    refetchInterval: 30_000,
  });
  /* These two used to be destructured for their data alone, so a failure in
     either was completely silent: the agency names quietly went missing from
     the cards, and the bell showed "0 unread" whether there were none or the
     request had failed. Silence is the worst of the four states — the screen
     looks correct and is wrong. */
  /* Sittings you have to hold a place at in advance.
     Deliberately conditional: this returns nothing on almost every day, and on
     those days the card does not exist at all. A permanent "Sessions" entry
     pointing at an empty list is a door to nowhere — the feature should appear
     when there is something to register for and be invisible otherwise.
     Failures are swallowed for the same reason: a sitting nobody can see is
     the normal state, so a broken fetch must not put an error on a Home screen
     that is otherwise fine. */
  const { data: openSessions = [] } = useQuery({
    queryKey: ['public-sessions'],
    queryFn: () => api.get<Array<{
      id: string; name: string; session_date: string; starts_at: string;
      places_remaining: number; business_name?: string | null; location_name?: string | null;
    }>>('/sessions/public'),
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const sitting = openSessions[0];

  const { data: businesses = [], isError: businessesFailed } = useQuery({
    queryKey: ['mobile-businesses'],
    queryFn: () => api.get<BusinessRow[]>('/businesses', false),
  });
  const {
    data: notifications = [],
    refetch: refetchNotifications,
    isError: notificationsFailed,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Array<{ id: string; is_read: boolean | number }>>('/notifications'),
    refetchInterval: 30_000,
  });
  /* null, not 0, when we could not ask. The badge renders nothing at all rather
     than asserting an all-clear it has no basis for. */
  const unread = notificationsFailed ? null : notifications.filter(n => !n.is_read).length;

  /* "Good morning" at 9pm is the kind of small lie that makes an app feel
     unattended. Computed per render, not per session. */
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([refetch(), refetchNotifications()]);
    setRefreshing(false);
  }, [refetch, refetchNotifications]);

  const sectorOf = useMemo(() => {
    const map = new Map<string, string>();
    businesses.forEach(b => { if (b.sector) map.set(b.id, b.sector); });
    return map;
  }, [businesses]);

  // Only offer a sector chip when something is actually filed under it.
  const sectors = useMemo(() => {
    const present = new Set<string>();
    branches.forEach(b => { const s = sectorOf.get(b.business_id); if (s) present.add(s); });
    return Array.from(present);
  }, [branches, sectorOf]);

  // Branches that are actually OPEN now (by their own hours) rank first — a
  // closed branch's stale low wait must never beat a live line.
  const sorted = useMemo(() => {
    const now = new Date();
    const openRank = (b: BranchSummary) => (branchOpenInfo(now, hoursFromBranch(b)).state === 'open' ? 1 : 0);
    return [...branches]
      .filter(b => !sector || sectorOf.get(b.business_id) === sector)
      .filter(b => !openOnly || branchOpenInfo(now, hoursFromBranch(b)).state === 'open')
      .sort((a, b) => (openRank(b) - openRank(a)) || Number(a.avg_wait_minutes) - Number(b.avg_wait_minutes));
  }, [branches, sector, sectorOf, openOnly]);

  // One row per agency, carrying that agency's best branch — the marketplace
  // browses agencies, and five rows of the same agency's branches is a list
  // that repeats itself instead of showing choice.
  const agencyRows = useMemo(() => {
    const byBusiness = new Map<string, { best: BranchSummary; count: number }>();
    sorted.forEach(b => {
      const hit = byBusiness.get(b.business_id);
      if (!hit) byBusiness.set(b.business_id, { best: b, count: 1 });
      else hit.count += 1;
    });
    return Array.from(byBusiness.values());
  }, [sorted]);

  const openBranch = (b: BranchSummary) => navigation.navigate('Branch', { businessId: b.business_id, branchId: b.id, branchName: b.name });

  const ahead = ticket ? Math.max(0, (ticket.waiting_position ?? ticket.position ?? 1) - 1) : 0;

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* greeting + location */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 52 }}>
          {/* Visually 38, but hitSlop keeps the real target at 44 — the header
              is furniture, not the point of the screen, and it was competing
              with the headline underneath it. */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Your account"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            style={{ borderRadius: 19, ...shadow.depth }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Sheen radius={19} />
              <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 13.5, ...depthText }}>{personInitials(user?.full_name || 'L')}</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            {/* The greeting moved into the headline below — saying "Hello, X"
                here and "Good morning, X" twenty pixels lower said the same
                thing twice and made neither land. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="pin" size={13} color={colors.muted} />
              {/* The town they told us in setup, not a hardcoded capital. This is the
                  first place an onboarding answer has to show up — if it does not,
                  the questions were theatre. */}
              <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 13, color: colors.muted, letterSpacing: -0.2 }}>{homeLocationLabel(prefs)}</Text>
              <Icon name="chevronDown" size={11} color={colors.muted} />
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} accessibilityRole="button" accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ''}`}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name="bell" size={21} color={colors.ink} />
            {/* null means we could not ask — draw no badge rather than an
                all-clear we have no basis for. */}
            {unread !== null && unread > 0 && (
              <View style={{ position: 'absolute', top: -1, right: -1, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: colors.busy, borderWidth: 2.5, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 10, color: '#fff' }}>{unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* live ticket — the reminder tile from the reference, doing real work */}
        {!!ticket && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Ticket', { ticketId: ticket.id })}
            style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, ...shadow.card }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={23} color={colors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>
                {ticket.status === 'called' ? "It's your turn" : "You're in line"}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 3 }}>
                {ticket.branch_name || 'Your branch'} · {ahead} ahead
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ backgroundColor: colors.dark, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 8, minWidth: 32, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>{Math.max(0, Number(ticket.estimated_wait_minutes || 0))}</Text>
              </View>
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.muted }}>min</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* The opening. Plain type on the canvas — no card, no border, nothing
            around it. This is the one place on Home that should be loud, and it
            is loud by being large rather than by being a coloured box. */}
        {/* Two lines at the same size, differing only in colour, gave the eye
            nothing to rank — so neither read as the point. The greeting is
            context and steps down to it; the question is the screen's actual
            prompt and keeps the display size. The gap between them is what
            makes them two thoughts instead of one paragraph. */}
        <View style={{ marginTop: ticket ? 24 : 20 }}>
          <Text style={{ ...type.callout, fontSize: 15, color: colors.muted }}>
            {greeting}, {firstName}.
          </Text>
          <Text style={{ ...type.displayLg, color: colors.ink, marginTop: 10 }}>
            What do you need{'\n'}to get done?
          </Text>
        </View>

        {/* search */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Search')}
          style={{ height: 56, borderRadius: 18, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 16, paddingRight: 8, marginTop: 22, ...shadow.card }}>
          <Icon name="search" size={20} color={colors.muted} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14.5, color: colors.muted }}>Search agencies &amp; branches</Text>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sliders" size={20} color={colors.accentInk} />
          </View>
        </TouchableOpacity>

        {/* Sector filter. space-between only once the row is full: with two
            sectors it threw one tile against each edge and read as a layout
            bug rather than a short list. */}
        {SHOW_SECTOR_FILTER && sectors.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 18, paddingHorizontal: 12, flexDirection: 'row', justifyContent: sectors.length >= 4 ? 'space-between' : 'flex-start', gap: sectors.length >= 4 ? 0 : 8, marginTop: 16, ...shadow.card }}>
            {[null, ...sectors].slice(0, 5).map(s => {
              const on = sector === s;
              const label = s === null ? 'All' : (SECTOR_LABEL[s] || s.replace(/_/g, ' '));
              const icon: IconName = s === null ? 'grid' : (SECTOR_ICON[s] || 'grid');
              return (
                <TouchableOpacity key={s ?? 'all'} onPress={() => setSector(s)} accessibilityRole="button" accessibilityLabel={`Filter by ${label}`}
                  style={{ alignItems: 'center', gap: 9, width: 64 }}>
                  <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: on ? colors.accent : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={icon} size={26} color={on ? colors.accentInk : colors.muted} />
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 11, color: on ? colors.accent : colors.muted }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* open now / all + sort */}
        {/* Chips, not two elevated cards. A filter is a control, not a
            surface — giving it its own shadow put it at the same visual weight
            as the branches it filters. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
          {([['Open now', true], ['All', false]] as const).map(([label, val]) => {
            const on = openOnly === val;
            return (
              <TouchableOpacity key={label} onPress={() => setOpenOnly(val)}
                accessibilityRole="button" accessibilityLabel={`${label}${on ? ', selected' : ''}`}
                /* accent/accentInk, not ink/onDark. In dark mode colors.ink is
                   #eef2f8 and colors.onDark is #ffffff — white on near-white,
                   so the selected chip vanished. The accent pair is the one
                   that flips correctly with the theme: dark blue with white
                   ink in light, light blue with near-black ink in dark. */
                style={{ minHeight: 44, justifyContent: 'center', backgroundColor: on ? colors.accent : 'transparent', borderWidth: 1, borderColor: on ? colors.accent : colors.border, borderRadius: 999, paddingHorizontal: 16 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? colors.accentInk : colors.sub }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
          <Text style={{ marginLeft: 'auto', fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>Shortest first</Text>
        </View>

        {/* The page-wide skeleton and error card used to sit here, and between
            them they blanked everything below on a single query's failure. Each
            region reports for itself now. */}
        {businessesFailed && !error ? (
          <View style={{ marginTop: 18 }}>
            <ErrorCard
              compact
              title="Some agency details are missing"
              message="Waits and opening times below are live; the agency names and logos are not. Pull down to refresh."
            />
          </View>
        ) : null}

        {/* Featured — the job finder's "Recommended" rail: a horizontal run of
            cards with the first one filled in the accent, so the shortest wait
            nearby is the thing your eye lands on rather than a row in a list. */}
        {/* ── the launch state ───────────────────────────────────────────
            One or two organisations, given the room a marketplace rail would
            have wasted on white space. */}
        {!isLoading && !error && agencyRows.length > 0 && agencyRows.length <= SPARSE_MAX && (
          <View style={{ marginTop: 30 }}>
            <Text style={{ ...type.overline, color: colors.muted }}>Available on Lyne</Text>

            {agencyRows.map(({ best, count }) => {
              const wait = Math.round(Number(best.avg_wait_minutes || 0));
              const hours = hoursFromBranch(best);
              const info = branchOpenInfo(new Date(), hours);
              const isOpen = info.state === 'open';
              return (
                <TouchableOpacity
                  key={best.business_id}
                  activeOpacity={0.9}
                  onPress={() => openBranch(best)}
                  accessibilityRole="button"
                  accessibilityLabel={`${best.business_name}, ${count} branch${count === 1 ? '' : 'es'}, ${isOpen ? `shortest wait ${wait} minutes` : 'closed'}`}
                  style={{ marginTop: 16 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                    <Monogram label={best.business_slug?.toUpperCase().slice(0, 4) || initials(best.business_name)} size={54} radius={18} bg={colors.dark} fg="#fff" border={false} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ ...type.title, color: colors.ink }}>
                        {(best.business_name || '').replace(/\s*\([^)]*\)\s*$/, '')}
                      </Text>
                      <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 4 }}>
                        {count} branch{count === 1 ? '' : 'es'}{best.city ? ` · ${best.city}` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Only claims a live wait when the branch is actually open —
                      a closed branch's stale number is the screen lying. */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOpen ? colors.light : colors.faint }} />
                    {isOpen ? (
                      <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.sub }}>
                        Open now · shortest wait right now{' '}
                        <Text style={{ fontFamily: font.extra, color: colors.ink }}>{waitShort(wait)}</Text>
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.sub }}>{info.detail}</Text>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accent }}>Explore</Text>
                    <Icon name="arrowUpRight" size={15} color={colors.accent} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Branded content rather than blank space. True on day one and
                true at fifty clients, so it never has to be taken down. */}
            <View style={{ marginTop: 34, paddingTop: 26, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ ...type.title, color: colors.ink }}>Skip the wait.</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 21 }}>
                Find the fastest time to get in and out.
              </Text>

              <View style={{ marginTop: 22, gap: 16 }}>
                {[
                  ['search', 'Find it', 'Search a service, place or agency.'],
                  ['users', 'Take your place', 'Join the line before you leave home.'],
                  ['clock', 'Arrive when it\'s time', 'Watch it move, and walk in on your turn.'],
                ].map(([icon, title, body]) => (
                  <View key={title} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={icon as IconName} size={17} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink, letterSpacing: -0.3 }}>{title}</Text>
                      <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 }}>{body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.faint, marginTop: 30 }}>
              More places are coming to Lyne.
            </Text>
          </View>
        )}

        {/* Only rendered when a sitting is actually open. */}
        {sitting ? (
          <Press
            role="button" haptic
            label={`Register for ${sitting.name}`}
            onPress={() => navigation.navigate('Session', { sessionId: sitting.id })}
            style={{
              marginTop: 26, borderRadius: radius.xl, padding: 18,
              backgroundColor: colors.dark, gap: 10, ...shadow.hero,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} />
              <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.7, color: 'rgba(255,255,255,.66)' }}>
                REGISTRATION OPEN
              </Text>
            </View>
            <Text style={{ fontFamily: font.extra, fontSize: 18, lineHeight: 24, color: '#fff', letterSpacing: -0.3 }}>
              {sitting.name}
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,.72)' }}>
              {sessionDayLabel(sitting.session_date)} · {sitting.places_remaining} places left
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.accent }}>Hold a place</Text>
              <Icon name="arrowRight" size={15} color={colors.accent} />
            </View>
          </Press>
        ) : null}

        {/* The heading and its "See all" render straight away and stay put; only
            what sits under them changes. A slow or failed rail leaves a labelled
            frame with a retry in it rather than a hole in the page. */}
        {(isLoading || !!error || agencyRows.length > SPARSE_MAX) && (
          <Section
            title="Shortest waits"
            action={{ label: 'See all', onPress: () => navigation.navigate('Search') }}
            loading={isLoading}
            error={error}
            onRetry={() => refetch()}
            skeleton={<SkeletonRows count={2} />}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 13, paddingRight: 4, paddingVertical: 2 }}>
              {agencyRows.slice(0, 5).map(({ best, count }, i) => {
                const wait = Math.round(Number(best.avg_wait_minutes || 0));
                const featured = i === 0;
                return (
                  <TouchableOpacity key={best.business_id} activeOpacity={0.9} onPress={() => openBranch(best)}
                    style={{ width: 252, borderRadius: 24, padding: 17, backgroundColor: featured ? colors.accent : colors.surface, ...shadow.card }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: featured ? '#fff' : colors.dark, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 12, color: featured ? colors.accent : '#fff' }}>
                          {best.business_slug?.toUpperCase().slice(0, 4) || initials(best.business_name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 13.5, color: featured ? '#fff' : colors.ink, letterSpacing: -0.3 }}>
                          {(best.business_name || '').replace(/\s*\([^)]*\)\s*$/, '')}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.medium, fontSize: 11.5, color: featured ? 'rgba(255,255,255,.78)' : colors.muted }}>
                            {best.city || 'Jamaica'}
                          </Text>
                          <Icon name="check" size={13} color={featured ? '#fff' : colors.accent} knockout={featured ? colors.accent : '#fff'} />
                          <Text style={{ fontFamily: font.bold, fontSize: 11, color: featured ? 'rgba(255,255,255,.78)' : colors.muted }}>Verified</Text>
                        </View>
                      </View>
                    </View>

                    <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 18, color: featured ? '#fff' : colors.ink, letterSpacing: -0.5, marginTop: 15 }}>{best.name}</Text>
                    <Text style={{ fontFamily: font.bold, fontSize: 13, color: featured ? 'rgba(255,255,255,.82)' : colors.muted, marginTop: 5 }}>
                      {waitPhrase(wait)} · {count} branch{count === 1 ? '' : 'es'}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: featured ? 'rgba(255,255,255,.78)' : colors.muted }}>
                        {Number(best.total_waiting || 0)} in line now
                      </Text>
                      <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: featured ? '#fff' : colors.infoSoft }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accent }}>Join</Text>
                        <Icon name="arrowUpRight" size={14} color={colors.accent} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Section>
        )}

        {/* the full list — only once there is a list worth heading */}
        {agencyRows.length > SPARSE_MAX && (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 14 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>Agencies near you</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Search')}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.accent }}>See all ›</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !error && agencyRows.length === 0 && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 26, alignItems: 'center', ...shadow.card }}>
            <Icon name="search" size={30} color={colors.faint} />
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, marginTop: 12 }}>Nothing open here yet</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
              {openOnly ? 'Every branch in this filter is closed right now. Switch to All to see them anyway.' : 'No agencies match this filter.'}
            </Text>
            {openOnly && (
              <TouchableOpacity onPress={() => setOpenOnly(false)} style={{ backgroundColor: colors.accent, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 22, marginTop: 16 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.accentInk }}>Show all branches</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {agencyRows.length > SPARSE_MAX && agencyRows.map(({ best, count }, rowIndex) => {
          const wait = Math.round(Number(best.avg_wait_minutes || 0));
          const meta = statusMeta(statusFromWait(wait));
          const hours = hoursFromBranch(best);
          const info = branchOpenInfo(new Date(), hours);
          const isOpen = info.state === 'open';
          return (
            <Appear key={best.business_id} index={rowIndex}>
            <TouchableOpacity activeOpacity={0.88} onPress={() => openBranch(best)}
              style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 11, ...shadow.card }}>
              <Monogram label={best.business_slug?.toUpperCase().slice(0, 4) || initials(best.business_name)} size={52} radius={17} bg={colors.dark} fg="#fff" border={false} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.extra, fontSize: 15.5, color: colors.ink, letterSpacing: -0.4 }}>
                    {(best.business_name || '').replace(/\s*\([^)]*\)\s*$/, '')}
                  </Text>
                  <Icon name="check" size={15} color={colors.accent} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted }}>
                    {count} branch{count === 1 ? '' : 'es'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isOpen ? colors.light : colors.faint }} />
                    <Text style={{ fontFamily: font.extra, fontSize: 11, color: isOpen ? colors.light : colors.muted }}>{isOpen ? 'Open' : 'Closed'}</Text>
                  </View>
                </View>
              </View>
              {isOpen ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 19, color: meta.dot === colors.busy ? colors.ink : colors.ink, letterSpacing: -0.5 }}>{waitShort(wait)}</Text>
                  <Text style={{ fontFamily: font.extra, fontSize: 10, color: colors.muted, letterSpacing: 0.4 }}>SHORTEST</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 11, paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>Opens {openTimeLabel(hours)}</Text>
                </View>
              )}
            </TouchableOpacity>
            </Appear>
          );
        })}

        {/* Premium, demoted on purpose.

            It was a 20pt-padded accent-deep card with a 74pt icon, sitting
            above the actual content — so the first strong thing on Home was an
            advertisement, and the screen read as promotional before it read as
            useful. One row now, below the content it was outranking. The value
            is real; the placement was the problem. */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Plan')}
          accessibilityRole="button"
          accessibilityLabel="Lyne Premium — find the quietest time to go"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Icon name="clock" size={20} color={colors.accent} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>Find the fastest time to go</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>Lyne Premium · free for 14 days</Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.chevron} />
        </TouchableOpacity>
      </ScrollView>
      <TabBar active="Home" showTicketPill={false} />
    </View>
  );
}

export { Monogram };
