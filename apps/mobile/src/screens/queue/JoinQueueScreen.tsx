import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials, remoteJoinInfo, hoursFromBranch } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import { haptics } from '../../lib/haptics';
import api from '../../lib/apiClient';
import { BranchSummary, ServiceSummary, TicketRecord } from '../../lib/mobileData';
import { registerPushNotifications, scheduleDepartureReminder } from '../../lib/notifications';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'JoinQueue'>;
interface LiveQueue { id: string | null; waiting_count: number; estimated_wait_minutes: number; }

export default function JoinQueueScreen() {
  const topPad = useTopPad(12);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { branchId, serviceId } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedReadiness, setCheckedReadiness] = useState<string[]>([]);
  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false) });
  const serviceQuery = useQuery({ queryKey: ['service', serviceId], queryFn: () => api.get<ServiceSummary>(`/services/${serviceId}`, false) });
  const queueQuery = useQuery({ queryKey: ['live-queue', branchId, serviceId], queryFn: () => api.get<LiveQueue>(`/queues/live?branch_id=${branchId}&service_id=${serviceId}`, false), refetchInterval: 15_000 });
  const branch = branchQuery.data;
  const service = serviceQuery.data;
  const liveQueue = queueQuery.data;
  const readiness = service?.readiness || [];
  const requiredReadiness = readiness.filter(item => item.is_mandatory);
  const readinessConfirmed = requiredReadiness.every(item => checkedReadiness.includes(item.id));
  const { refreshing, onRefresh } = useRefresh(branchQuery.refetch, serviceQuery.refetch, queueQuery.refetch);

  useEffect(() => { if (liveQueue?.id) setError(''); }, [liveQueue?.id]);

  // Tick so the screen unlocks itself the moment the branch opens or the
  // walk-in buffer expires — the user should never have to back out and return.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const joinState = useMemo(() => remoteJoinInfo(now, hoursFromBranch(branch)), [now, branch]);
  const queueOpen = !!liveQueue?.id;
  const canJoin = joinState.allowed && queueOpen && readinessConfirmed;

  // Why the button is off, in the order the user would ask it.
  const blockedNotice = !branch ? null
    : !joinState.allowed ? { label: joinState.label, detail: joinState.detail }
    : !queueOpen ? { label: 'Not taking a line today', detail: `${service?.name || 'This service'} has no queue open at ${branch.name} today. Try another service, or check back tomorrow.` }
    : null;

  const ctaLabel = canJoin ? 'Confirm & join queue →'
    : joinState.allowed && queueOpen && !readinessConfirmed ? 'Check the required items first'
    : joinState.state === 'closed' ? 'Closed right now'
    : joinState.state === 'about_to_open' ? 'Opening soon'
    : joinState.state === 'buffer' ? 'Walk-ins joining first'
    : 'Not available';

  const noticeIcon = joinState.state === 'closed' ? 'moon-outline'
    : joinState.state === 'about_to_open' ? 'time-outline'
    : joinState.state === 'buffer' ? 'walk-outline'
    : 'information-circle-outline';

  // Only show live counts when there is genuinely a line running. A closed
  // branch reading "0 ahead · 0m wait" looks like an invitation to join.
  const statsLive = joinState.state === 'open' || joinState.state === 'buffer';

  const joinQueue = async () => {
    if (!joinState.allowed) {
      setError(joinState.detail);
      return;
    }
    if (!liveQueue?.id || !branch || !service) {
      setError('This queue is not open right now. Please choose another service or try again later.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const ticket = await api.post<TicketRecord>('/tickets', {
        queue_id: liveQueue.id,
        readiness_acknowledged: readiness.length > 0 ? readinessConfirmed : undefined,
      });
      haptics.success();
      registerPushNotifications().catch(() => {});
      scheduleDepartureReminder({
        ticketId: ticket.id,
        branchName: branch.name,
        branchLatitude: branch.latitude,
        branchLongitude: branch.longitude,
        estimatedWaitMinutes: ticket.estimated_wait_minutes || liveQueue.estimated_wait_minutes,
        leadTimeMinutes: 10,
      }).catch(() => {});
      navigation.navigate('Ticket', { ticketId: ticket.id, businessId: branch.business_id, branchId, serviceId });
    } catch (caught: unknown) {
      haptics.error();
      setError(caught instanceof Error ? caught.message : 'Could not join this queue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pageLoading = branchQuery.isLoading || serviceQuery.isLoading || queueQuery.isLoading;
  const pageError = branchQuery.error || serviceQuery.error || queueQuery.error;

  /* The queue journey is a DARK flow — branch picker, live line map and ticket
     are all on the navy ground. This screen was the one light step in the
     middle, so a customer went light → dark → dark → light → dark on the way to
     a ticket. Content cards stay light on purpose: that boarding-pass contrast
     is the same treatment BranchScreen uses. */
  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 148 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontFamily: font.extra, fontSize: 11, color: 'rgba(255,255,255,.6)', letterSpacing: 0.6, textTransform: 'uppercase' }}>Join remotely</Text>
        <Text style={[t.h1, { marginTop: 8, marginBottom: 10, color: '#fff' }]}>Take your spot{'\n'}from anywhere.</Text>

        {pageLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 36 }} />}
        {!!pageError && <Text style={{ fontFamily: font.bold, color: '#ff9a9d' }}>Live queue details could not be loaded.</Text>}

        {branch && service && (
          <>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 20, marginBottom: 20 }}>You are joining {service.name} at {branch.business_name} · {branch.name}.</Text>
            {/* Raised a step above the page, not the same navy — on a dark
                ground the old colors.dark card had no edge at all. */}
            <View style={{ backgroundColor: 'rgba(255,255,255,.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,.10)', borderRadius: 26, padding: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.ink }}>{initials(branch.business_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{branch.business_name}</Text>
                  <Text style={{ fontFamily: font.extra, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>{service.name}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 22 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 24, color: '#fff' }}>{statsLive ? (liveQueue?.waiting_count ?? 0) : '—'}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 5 }}>ahead</Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,.12)' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 24, color: '#fff' }}>{statsLive ? <>{liveQueue?.estimated_wait_minutes ?? 0}<Text style={{ fontSize: 13 }}>m</Text></> : '—'}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 5 }}>est. wait</Text>
                </View>
              </View>
            </View>

            {/* Everything below the card used to be empty — roughly half the
                screen — right at the moment someone is deciding whether to
                commit to a queue. This is the answer to "what am I agreeing
                to?", built from data we already hold. */}
            {service.description ? (
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 20, marginTop: 18 }}>
                {service.description}
              </Text>
            ) : null}

            {readiness.length > 0 ? (
              <View style={{ marginTop: 22, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                <View style={{ padding: 18, paddingBottom: 14, backgroundColor: 'rgba(47,191,113,.08)', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark-done-outline" size={19} color={colors.light} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Have these ready</Text>
                      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 2 }}>
                        Tick each required item before taking your place. Staff will still check at the branch.
                      </Text>
                    </View>
                  </View>
                </View>

                {(['bring', 'prepare'] as const).map(kind => {
                  const items = readiness.filter(item => item.kind === kind);
                  if (!items.length) return null;
                  return (
                    <View key={kind} style={{ paddingHorizontal: 18, paddingTop: 16 }}>
                      <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.muted, letterSpacing: 0.45, textTransform: 'uppercase', marginBottom: 7 }}>
                        {kind === 'bring' ? 'Bring with you' : 'Do before you arrive'}
                      </Text>
                      {items.map(item => {
                        const checked = checkedReadiness.includes(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            activeOpacity={0.78}
                            onPress={() => {
                              haptics.select();
                              setCheckedReadiness(current => checked
                                ? current.filter(id => id !== item.id)
                                : [...current, item.id]);
                            }}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked }}
                            style={{ flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}
                          >
                            <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: checked ? colors.accent : colors.surfaceAlt, borderWidth: 1, borderColor: checked ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                              {checked ? <Ionicons name="checkmark" size={16} color={colors.accentInk} /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
                                <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{item.label}</Text>
                                {item.is_mandatory ? (
                                  <Text style={{ fontFamily: font.extra, fontSize: 9.5, color: colors.danger, textTransform: 'uppercase', letterSpacing: 0.35 }}>Required</Text>
                                ) : (
                                  <Text style={{ fontFamily: font.bold, fontSize: 9.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.35 }}>Helpful</Text>
                                )}
                              </View>
                              {item.detail ? <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 3 }}>{item.detail}</Text> : null}
                              {item.lead_minutes ? (
                                <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: colors.accentDeep, marginTop: 5 }}>
                                  <Ionicons name="time-outline" size={12} color={colors.accentDeep} />{' '}
                                  {item.lead_minutes >= 60
                                    ? `${Math.round(item.lead_minutes / 60)} hour${Math.round(item.lead_minutes / 60) === 1 ? '' : 's'} before`
                                    : `${item.lead_minutes} minutes before`}
                                </Text>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}

                <View style={{ padding: 16, flexDirection: 'row', gap: 9, alignItems: 'center' }}>
                  <Ionicons
                    name={readinessConfirmed ? 'checkmark-circle' : 'information-circle-outline'}
                    size={17}
                    color={readinessConfirmed ? colors.light : colors.muted}
                  />
                  <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 12, color: readinessConfirmed ? colors.ink : colors.muted }}>
                    {readinessConfirmed
                      ? 'Required items confirmed — you can join when the line is open.'
                      : `${requiredReadiness.filter(item => !checkedReadiness.includes(item.id)).length} required item${requiredReadiness.filter(item => !checkedReadiness.includes(item.id)).length === 1 ? '' : 's'} left to confirm.`}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 22, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: colors.ink, marginBottom: 14 }}>What happens next</Text>
              {[
                { icon: 'ticket-outline', text: 'You get a ticket number and a six-digit code, straight away.' },
                { icon: 'notifications-outline', text: 'We tell you when to set off, and again when you are next.' },
                { icon: 'shield-checkmark-outline', text: 'Show the code at the counter — it is how staff confirm it is you.' },
              ].map(step => (
                <View key={step.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <Ionicons name={step.icon as any} size={16} color={colors.accentDeep} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.sub, lineHeight: 18 }}>{step.text}</Text>
                </View>
              ))}
              <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 2 }}>
                You can leave the queue at any time, and nothing is charged for taking a place in line.
              </Text>
            </View>

            {(branch.address || branch.phone) ? (
              <View style={{ marginTop: 14, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 11 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: colors.ink }}>Where you are going</Text>
                {branch.address ? (
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <Ionicons name="location-outline" size={16} color={colors.muted} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.sub, lineHeight: 18 }}>{branch.address}</Text>
                  </View>
                ) : null}
                {branch.phone ? (
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Ionicons name="call-outline" size={16} color={colors.muted} />
                    <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.sub }}>{branch.phone}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {blockedNotice && (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: 'rgba(245,166,35,.10)', borderWidth: 1, borderColor: 'rgba(245,166,35,.28)' }}>
                <Ionicons name={noticeIcon as any} size={18} color={colors.moderate} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>{blockedNotice.label}</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 3 }}>{blockedNotice.detail}</Text>
                </View>
              </View>
            )}
          </>
        )}
        {!!error && <Text style={{ fontFamily: font.bold, color: colors.danger, marginTop: 14 }}>{error}</Text>}
      </ScrollView>
      {/* t.primaryBtn is colors.dark — the same navy as this page now uses, so
          on the dark ground the CTA had no edge at all and read as loose text.
          The accent is what the sibling "Join this line" button already uses on
          the same ground. The scrim keeps the card behind from running into it. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, backgroundColor: colors.dark }}>
        <TouchableOpacity disabled={loading || pageLoading || !canJoin}
          style={[t.primaryBtn, { backgroundColor: colors.accent }, (!canJoin || pageLoading) && { opacity: 0.45 }]}
          onPress={joinQueue}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>{ctaLabel}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
