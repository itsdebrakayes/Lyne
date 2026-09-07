/**
 * BusinessScreen — what this agency is, before you commit to a line.
 *
 * Built on Debra's reference: an identity panel, a row of facts, a plain-English
 * overview, and one action pinned to the bottom. It deliberately does NOT list
 * branches. Choosing a branch and a service is the next screen's whole job, and
 * doing half of it here meant somebody scrolled a list, tapped a branch, then
 * met a second list — the same decision asked twice in two different shapes.
 *
 * Two substitutions from the reference, for the same reason as elsewhere:
 * there is no photograph (the panel carries the agency mark on the navy ground)
 * and no star rating (nobody rates a tax office — the facts row carries what
 * actually decides a journey: how many branches, how many services, and the
 * hours).
 *
 * The bottom bar mirrors "Book Consultation · From $150" and answers the same
 * question in the currency that matters here — the shortest wait anywhere in
 * this agency right now. If nothing is open it says so rather than inviting a
 * tap that leads to a closed door.
 */
import React, { useMemo } from 'react';
import {
  ActivityIndicator, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/apiClient';
import {
  BranchSummary, SavedBusiness, ServiceSummary, orgAcronym, shortBranchName,
} from '../../lib/mobileData';
import { colors, font, shadow, t, isBranchOpen, waitShort } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import { ErrorCard } from '../../components/Feedback';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Business'>;

interface BusinessDetail {
  id: string;
  name: string;
  slug?: string;
  sector?: string | null;
  description?: string | null;
  phone?: string | null;
  website_url?: string | null;
  default_opening_time?: string | null;
  default_closing_time?: string | null;
}

const SECTOR_LABEL: Record<string, string> = {
  government_revenue: 'Government agency',
  judiciary: 'Court service',
  financial_services: 'Financial institution',
  microfinance: 'Microfinance',
  university: 'University',
  diagnostics: 'Health service',
};

/** "08:30:00" → "8:30 am". A seconds field on a signboard helps nobody. */
function clock(value?: string | null): string | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

const minutesOf = (v?: string | null) => {
  if (!v) return null;
  const [h, m] = v.split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

/**
 * The two hour facts, as a pair.
 *
 * A window that spans the whole day is not "opens 12 am, closes 11:59 pm" —
 * that is a clock reading of something nobody would ever say out loud. It means
 * the agency does not close, so it says so. Anything narrower is real hours and
 * is shown as real hours.
 */
function hourFacts(open?: string | null, close?: string | null) {
  const o = minutesOf(open);
  const c = minutesOf(close);
  if (o !== null && c !== null && o <= 1 && c >= 23 * 60 + 58) {
    return { openValue: '24 hrs', openLabel: 'Open', closeValue: 'Any day', closeLabel: 'You can join' };
  }
  return {
    openValue: clock(open) || '—',
    openLabel: 'Opens',
    closeValue: clock(close) || '—',
    closeLabel: 'Closes',
  };
}

/** One fact, in the shape the reference sets its four feature icons. */
function Fact({ icon, value, label }: {
  icon: keyof typeof Ionicons.glyphMap; value: string; label: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{
        width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{value}</Text>
      <Text numberOfLines={2} style={{ fontFamily: font.semibold, fontSize: 10.5, color: colors.muted, textAlign: 'center', lineHeight: 13 }}>
        {label}
      </Text>
    </View>
  );
}

export default function BusinessScreen() {
  const topPad = useTopPad(12);
  const route = useRoute<Params>();
  const nav = useNavigation<any>();
  const queryClient = useQueryClient();
  const { businessId, businessName } = route.params;

  const branchesQuery = useQuery({
    queryKey: ['branches', businessId],
    queryFn: () => api.get<BranchSummary[]>(`/branches?business_id=${businessId}`, false),
    refetchInterval: 30_000,
  });

  /* The list endpoint returns b.*, so one call carries the description, the
     sector and the default hours. There is no /businesses/:id — only :slug —
     and we arrive holding an id, so finding it here beats inventing a route. */
  const businessQuery = useQuery({
    queryKey: ['businesses-detail'],
    queryFn: () => api.get<BusinessDetail[]>('/businesses', false),
    staleTime: 10 * 60_000,
  });

  const servicesQuery = useQuery({
    queryKey: ['business-services', businessId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?business_id=${businessId}`, false),
    staleTime: 5 * 60_000,
  });

  const business = useMemo(
    () => (businessQuery.data || []).find(b => b.id === businessId),
    [businessQuery.data, businessId],
  );

  const branches = branchesQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  /* Pull-to-refresh refreshes what is ON the screen, not just the live figures.
     Refreshing only the branches left the facts row and the overview showing a
     cached answer while the waits updated around them. */
  const { refreshing, onRefresh } = useRefresh(
    branchesQuery.refetch, businessQuery.refetch, servicesQuery.refetch,
  );

  const { data: saved = [] } = useQuery({
    queryKey: ['saved-businesses'],
    queryFn: () => api.get<SavedBusiness[]>('/saved'),
  });
  const isSaved = saved.some(b => b.id === businessId);

  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? api.delete(`/saved/${businessId}`) : api.post(`/saved/${businessId}`, {})),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  /* The number the bottom bar promises. Only open branches count — a closed
     branch's stale figure is the one number that would send somebody out of
     the house for nothing. */
  const openBranches = branches.filter(isBranchOpen);
  const shortest = openBranches.length
    ? Math.min(...openBranches.map(b => Math.round(Number(b.avg_wait_minutes || 0))))
    : null;

  const name = business?.name || businessName;
  const acronym = orgAcronym(businessId, name);
  const sector = business?.sector ? (SECTOR_LABEL[business.sector] || 'Service') : null;
  const hours = hourFacts(business?.default_opening_time, business?.default_closing_time);

  const loading = branchesQuery.isLoading || businessQuery.isLoading;

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 152 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        {/* Identity panel — the reference's photo, carrying the mark instead. */}
        <View style={{ backgroundColor: colors.dark, paddingTop: topPad + 6, paddingHorizontal: 22, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              onPress={() => nav.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={toggleSave.isPending}
              onPress={() => toggleSave.mutate()}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? `Remove ${name} from saved` : `Save ${name}`}
              accessibilityState={{ selected: isSaved }}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 26 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: acronym.length >= 5 ? 15 : 18, color: colors.accent }}>
                {acronym}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 23, lineHeight: 28, color: '#fff', letterSpacing: -0.6 }}>
                {name}
              </Text>
              {!!sector && (
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>
                  {sector}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 22 }}>
          {/* Facts — the reference's four-icon strip, lifted onto the panel edge
              so it reads as belonging to the agency above it. */}
          <View style={{
            flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 22,
            paddingVertical: 18, paddingHorizontal: 8, marginTop: -18, ...shadow.card,
          }}>
            <Fact icon="business-outline" value={String(branches.length)} label={branches.length === 1 ? 'Branch' : 'Branches'} />
            <Fact icon="layers-outline" value={String(services.length)} label={services.length === 1 ? 'Service' : 'Services'} />
            <Fact icon="sunny-outline" value={hours.openValue} label={hours.openLabel} />
            <Fact icon="moon-outline" value={hours.closeValue} label={hours.closeLabel} />
          </View>

          {loading && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}

          {!!branchesQuery.error && !loading && (
            <View style={{ marginTop: 22 }}>
              <ErrorCard
                title="Could not load this agency"
                message="Live branch and wait information is unavailable right now."
                onRetry={() => branchesQuery.refetch()}
              />
            </View>
          )}

          {!!business?.description && (
            <View style={{ marginTop: 26 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 17, color: colors.ink, letterSpacing: -0.4 }}>
                About {acronym}
              </Text>
              <Text style={{ fontFamily: font.medium, fontSize: 14.5, lineHeight: 23, color: colors.sub, marginTop: 9 }}>
                {business.description}
              </Text>
            </View>
          )}

          {/* The branches, listed.
              This screen used to end at the overview and leave a few hundred
              points of nothing above the action. Filling it with the branches
              is not padding: it is the question somebody is actually holding —
              which one do I go to — answered before they commit to the flow.

              Choosing still happens on the next screen. This is reference, so
              a row opens the branch rather than joining a line from here; the
              one thing a row does commit to is the phone call, because that is
              the answer when the wait is long and the question is simple. */}
          {branches.length > 0 && (
            <View style={{ marginTop: 26 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 17, color: colors.ink, letterSpacing: -0.4 }}>
                {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
              </Text>

              <View style={{ gap: 10, marginTop: 12 }}>
                {branches.map((b) => {
                  const open = isBranchOpen(b);
                  const wait = Math.round(Number(b.avg_wait_minutes || 0));
                  return (
                    <View
                      key={b.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        backgroundColor: colors.surface, borderRadius: 20, padding: 14,
                        ...shadow.card,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => nav.navigate('Branch', { businessId, branchId: b.id, branchName: b.name })}
                        accessibilityRole="button"
                        accessibilityLabel={`${b.name}. ${open ? `Open, about ${wait} minutes` : 'Closed'}`}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>
                          {shortBranchName(b.name)}
                        </Text>
                        {!!b.address && (
                          <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 3 }}>
                            {b.address}
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: open ? colors.light : colors.muted }} />
                          <Text style={{ fontFamily: font.bold, fontSize: 12, color: open ? colors.light : colors.muted }}>
                            {open ? 'Open' : 'Closed'}
                          </Text>
                          {open && (
                            <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted }}>
                              · {waitShort(wait)} wait · {Number(b.total_waiting || 0)} ahead
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>

                      {!!b.phone && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${String(b.phone).replace(/[^\d+]/g, '')}`).catch(() => {})}
                          accessibilityRole="button"
                          accessibilityLabel={`Call ${b.name} on ${b.phone}`}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{
                            width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="call-outline" size={19} color={colors.accent} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Contact — the reference's "Learn More". Rows appear only when the
              agency actually published the detail, so the section never shows a
              row that does nothing. */}
          {(!!business?.phone || !!business?.website_url) && (
            <View style={{ marginTop: 24, backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', ...shadow.card }}>
              {!!business?.phone && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                  <Ionicons name="call-outline" size={18} color={colors.accent} />
                  <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.ink }}>{business.phone}</Text>
                </View>
              )}
              {!!business?.website_url && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
                  borderTopWidth: business?.phone ? 1 : 0, borderTopColor: colors.borderSoft,
                }}>
                  <Ionicons name="globe-outline" size={18} color={colors.accent} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.ink }}>
                    {business.website_url.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* The one action, pinned.
          Sized like the reference's "Book Consultation" bar rather than a
          normal button: this is the only thing to do on the screen, and at
          62pt with 16pt type it read as one control among several instead of
          the point of the page. The gradient gives it depth on a flat canvas —
          a single flat navy slab at this size reads as a footer, not a button.

          The arrow sits in a WHITE disc, as in the reference. On the accent
          blue it disappeared into the panel; white is the only thing on a navy
          gradient that reads instantly as "press here". */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30,
        backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
      }}>
        <TouchableOpacity
          onPress={() => nav.navigate('Service', { businessId, branchId: openBranches[0]?.id })}
          disabled={!openBranches.length}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={openBranches.length
            ? `Join a line at ${name}, from ${waitShort(shortest ?? 0)}`
            : `${name} is closed right now`}
          accessibilityState={{ disabled: !openBranches.length }}
        >
          <LinearGradient
            colors={openBranches.length
              ? [colors.accentDeep, colors.dark]
              : [colors.surfaceAlt, colors.surfaceAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              minHeight: 82, borderRadius: 26, paddingLeft: 26, paddingRight: 18,
              ...(openBranches.length ? shadow.hero : null),
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{
                fontFamily: font.extra, fontSize: 20, letterSpacing: -0.4,
                color: openBranches.length ? '#fff' : colors.muted,
              }}>
                {openBranches.length ? 'Join a line' : 'Closed right now'}
              </Text>
              <Text style={{
                fontFamily: font.semibold, fontSize: 13.5, marginTop: 3,
                color: openBranches.length ? 'rgba(255,255,255,.66)' : colors.muted,
              }}>
                {openBranches.length
                  ? `Now · from ${waitShort(shortest ?? 0)}`
                  : 'Check the opening hours above'}
              </Text>
            </View>
            <View style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: openBranches.length ? '#fff' : colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="arrow-forward" size={22} color={openBranches.length ? colors.dark : colors.muted} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
