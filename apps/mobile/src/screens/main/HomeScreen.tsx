import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, font, shadow, t, sp, type, initials, personInitials, statusFromWait, statusMeta, waitShort, waitPhrase, branchOpenInfo, isBranchOpen, openTimeLabel, hoursFromBranch, depthText, TAB_BAR_CLEARANCE, radius} from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { BranchSummary, orgAcronym, shortBranchName } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { TabBar, useActiveTicket } from '../../components/TabBar';
import { Sheen } from '../../components/Glass';
import { ErrorCard, Section, SkeletonRows } from '../../components/Feedback';
import { Press } from '../../components/Press';
import { homeLocationLabel, usePreferences } from '../../lib/preferences';
import { useDevicePlace } from '../../lib/deviceLocation';
import Icon, { IconName } from '../../components/Icon';
import Appear from '../../components/Appear';
import HomeHero from '../../components/HomeHero';
import { BranchCard, ProofRow, Rail, RailHead, TileGrid, type BadgeKind } from '../../components/HomeSections';

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
  const devicePlace = useDevicePlace();
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

  /* The agencies this person actually uses.
     A marketplace that opens on whichever agency happens to be quietest is
     ignoring the strongest signal it has: somebody who saved the Tax Office is
     far more likely to be opening this app for the Tax Office than for a credit
     union they have never visited. Failure is silent — an unsaved list is the
     normal state for a new account, and it must not put an error on Home. */
  const { data: savedAgencies = [] } = useQuery({
    queryKey: ['saved-businesses'],
    queryFn: () => api.get<Array<{ id: string }>>('/saved'),
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const savedIds = useMemo(
    () => new Set(savedAgencies.map((b) => String(b.id))),
    [savedAgencies],
  );

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
    /* Saved first, and within each group the order the sort above already
       established — open before closed, then shortest wait. Wait time still
       decides the rest of the list; this only says the places you have chosen
       come before the places you have not. */
    return Array.from(byBusiness.values()).sort(
      (a, b) => Number(savedIds.has(String(b.best.business_id)))
              - Number(savedIds.has(String(a.best.business_id))),
    );
  }, [sorted, savedIds]);

  /* Agency tiles. Built from the businesses actually on screen, so an agency
     onboarded next week appears without a code change, and a demo that is all
     government offices does not show five dead categories.

     Built from `branches` rather than `sorted`, because `sorted` carries the
     open-now filter and this row is a directory, not a join list. Tapping a
     tile opens the agency page — hours, branches, phone numbers — which is
     exactly what somebody wants at seven in the evening. Filtering it left the
     row half empty after closing time and hid four agencies that still had
     something to say. Open agencies still come first, so the tile you can act
     on now is the one nearest the thumb. */
  const tiles = useMemo(() => {
    const now = new Date();
    const seen = new Map<string, { id: string; label: string; acronym: string; open: boolean }>();
    branches
      .filter(b => !sector || sectorOf.get(b.business_id) === sector)
      .forEach(b => {
        const open = branchOpenInfo(now, hoursFromBranch(b)).state === 'open';
        const hit = seen.get(b.business_id);
        if (!hit) {
          seen.set(b.business_id, {
            id: b.business_id,
            label: b.business_name,
            acronym: orgAcronym(b.business_id, b.business_name),
            open,
          });
        } else if (open) {
          hit.open = true;
        }
      });
    const list = Array.from(seen.values())
      .sort((a, b) => Number(b.open) - Number(a.open))
      .slice(0, 8);
    return list.map(x => ({
      ...x,
      onPress: () => navigation.navigate('Business', { businessId: x.id, businessName: x.label }),
    }));
  }, [branches, sector, sectorOf, navigation]);

  /* The badges, and the rule behind each one.

     Every badge is a fact about the numbers on the card, decided here once so
     no two cards can claim the same superlative. A card with nothing true to
     say carries no badge at all — that is the honest outcome, and it is better
     than reaching for a fourth label to fill the slot. "Closest to you" is
     absent until the app actually knows where the phone is; it is the one the
     reference implies and the one we cannot yet earn. */
  const recommended = useMemo(() => {
    const rows = agencyRows.map(r => r.best);
    if (!rows.length) return [];

    const open = rows.filter(b => isBranchOpen(b));
    const pool = open.length ? open : rows;

    const waitOf = (b: BranchSummary) => Math.round(Number(b.avg_wait_minutes || 0));
    const aheadOf = (b: BranchSummary) => Number(b.total_waiting || 0);

    const shortest = pool.reduce((a, b) => (waitOf(b) < waitOf(a) ? b : a), pool[0]);
    const busiest = pool.reduce((a, b) => (aheadOf(b) > aheadOf(a) ? b : a), pool[0]);
    const empty = pool.find(b => aheadOf(b) === 0 && isBranchOpen(b));

    const badgeFor = (b: BranchSummary): BadgeKind => {
      if (empty && b.id === empty.id) return 'no_queue';
      if (b.id === shortest.id && waitOf(shortest) > 0) return 'shortest';
      if (b.id === busiest.id && aheadOf(busiest) > 0 && busiest.id !== shortest.id) return 'busiest';
      return null;
    };

    return rows.map(branch => ({ branch, badge: badgeFor(branch) }));
  }, [agencyRows]);

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
              {/* The phone if it will say without being asked, otherwise the town
                  they told us in setup. Never a hardcoded capital: this is the
                  first place an onboarding answer has to show up, and the first
                  place a wrong guess is visible. */}
              <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 13, color: colors.muted, letterSpacing: -0.2 }}>{homeLocationLabel(prefs, devicePlace)}</Text>
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

        {/* The opening, then the promo panel — the order the reference uses.
            The greeting stays because it is the one line on Home addressed to a
            person rather than to a queue. */}
        <View style={{ marginTop: ticket ? 22 : 18 }}>
          <Text style={{ ...type.callout, fontSize: 14.5, color: colors.muted }}>
            {greeting}, {firstName}.
          </Text>
          <Text style={{ fontFamily: font.extra, fontSize: 27, lineHeight: 32, color: colors.ink, letterSpacing: -0.9, marginTop: 6 }}>
            What do you need{'\n'}to get done?
          </Text>
        </View>

        {/* search */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Search')}
          style={{ height: 54, borderRadius: 17, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 16, paddingRight: 7, marginTop: 18, ...shadow.card }}>
          <Icon name="search" size={19} color={colors.muted} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.muted }}>Search agencies &amp; branches</Text>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sliders" size={19} color={colors.accentInk} />
          </View>
        </TouchableOpacity>

        <HomeHero
          onJoinNow={() => navigation.navigate('Search')}
          onPlanLater={() => navigation.navigate('Plan')}
        />

        {/* Popular places — the reference's category grid, carrying agencies
            because that is what people navigate a queue app by.

            The section stays even with nothing in it. A first release ships
            before any agency has signed, and a row that silently disappears
            teaches somebody the app is broken; a row that says what will live
            there teaches them what the app is for. */}
        <View style={{ marginTop: 26 }}>
          <RailHead title="Popular places" actionLabel="See all" onAction={() => navigation.navigate('Search')} />
          {tiles.length > 0 ? (
            <TileGrid items={tiles} />
          ) : (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 13,
              backgroundColor: colors.surface, borderRadius: 20, padding: 16, ...shadow.card,
            }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="pin" size={20} color={colors.muted} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink, letterSpacing: -0.2 }}>
                  The places you use will sit here
                </Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 17 }}>
                  As agencies come on Lyne, tap one to jump straight to its lines.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Recommended — the badged card rail. Each badge is computed from the
            live figures below, never assigned for decoration. */}
        <View style={{ marginTop: 26 }}>
          <RailHead
            title={savedIds.size ? 'Your agencies' : 'Recommended for you'}
            actionLabel="View all"
            onAction={() => navigation.navigate('Search')}
          />

          {isLoading && <SkeletonRows count={2} />}

          {!!error && !isLoading && (
            <ErrorCard
              title="Waits unavailable"
              message="Live queue times could not be loaded."
              onRetry={() => refetch()}
            />
          )}

          {/* Two different nothings, and they must not share a sentence.
              "Every branch is closed" is true when the app knows about
              branches and none is open; on a fresh install that knows about no
              agency at all it is a lie, and the button under it does nothing
              because there is nothing to unfilter. */}
          {!isLoading && !error && recommended.length === 0 && branches.length === 0 && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 26, alignItems: 'center', ...shadow.card }}>
              <Icon name="government" size={26} color={colors.muted} />
              <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, marginTop: 12 }}>No agencies yet</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                When an agency joins Lyne, its branches and live wait times show up here — busiest first, so you can pick the shortest line.
              </Text>
            </View>
          )}

          {!isLoading && !error && recommended.length === 0 && branches.length > 0 && (
            <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 26, alignItems: 'center', ...shadow.card }}>
              <Icon name="clock" size={26} color={colors.muted} />
              <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink, marginTop: 12 }}>Nothing open here yet</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
                Every branch in this filter is closed right now. Switch to All to see them anyway.
              </Text>
              <TouchableOpacity onPress={() => setOpenOnly(false)} style={{ marginTop: 16, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.accentInk }}>Show all branches</Text>
              </TouchableOpacity>
            </View>
          )}

          {recommended.length > 0 && (
            <Rail>
              {recommended.map(({ branch, badge }) => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  badge={badge}
                  onOpen={() => openBranch(branch)}
                  onJoin={() => navigation.navigate('Service', { businessId: branch.business_id, branchId: branch.id })}
                />
              ))}
            </Rail>
          )}
        </View>

        {/* What Lyne actually does, in four short claims. */}
        <View style={{ marginTop: 30 }}>
          <ProofRow />
        </View>

        {/* The full list, under the proofs — the rail shows a handful, this is
            everywhere else, in the same shape the Search results use so the two
            screens do not teach two different reading habits. */}
        {agencyRows.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <RailHead title="Agencies near you" actionLabel="See all" onAction={() => navigation.navigate('Search')} />
            <View style={{ gap: 10 }}>
              {agencyRows.map(({ best, count }, i) => {
                const wait = Math.round(Number(best.avg_wait_minutes || 0));
                const isOpen = isBranchOpen(best);
                return (
                  <Appear key={best.business_id} index={i}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openBranch(best)}
                      accessibilityRole="button"
                      accessibilityLabel={`${best.business_name}, ${count} ${count === 1 ? 'branch' : 'branches'}, ${isOpen ? 'open' : 'closed'}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.surface, borderRadius: 20, padding: 14, ...shadow.card }}
                    >
                      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: orgAcronym(best.business_id, best.business_name).length >= 5 ? 11.5 : 13.5, color: colors.accent }}>
                          {orgAcronym(best.business_id, best.business_name)}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>
                          {best.business_name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted }}>
                            {count} {count === 1 ? 'branch' : 'branches'}
                          </Text>
                          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: isOpen ? colors.light : colors.muted }} />
                          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: isOpen ? colors.light : colors.muted }}>
                            {isOpen ? 'Open' : 'Closed'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.5 }}>{waitShort(wait)}</Text>
                        <Text style={{ fontFamily: font.semibold, fontSize: 10.5, color: colors.muted, letterSpacing: 0.4 }}>SHORTEST</Text>
                      </View>
                    </TouchableOpacity>
                  </Appear>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>
      <TabBar active="Home" showTicketPill={false} />
    </View>
  );
}

export { Monogram };
