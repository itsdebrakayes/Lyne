import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, t, initials, remoteJoinInfo, hoursFromBranch } from '../../lib/theme';
import { useNavBarLift, useTopPad } from '../../lib/insets';
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
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { branchId, serviceId } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /* Bumped when a join fails, to send the hold button back to rest. Without
     it a failed request leaves a tick sitting above the error explaining the
     join did not happen. */
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

  const requiredLeft = requiredReadiness.filter(item => !checkedReadiness.includes(item.id)).length;
  const ahead = Number(liveQueue?.waiting_count ?? 0);
  const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  const joinTitle = canJoin ? 'Join this line'
    : joinState.allowed && queueOpen && !readinessConfirmed ? 'Tick required items first'
    : joinState.state === 'closed' ? 'Closed right now'
    : joinState.state === 'about_to_open' ? 'Opening soon'
    : joinState.state === 'buffer' ? 'Walk-ins joining first'
    : 'Not available';
  const joinSub = canJoin ? `You'd be ${ordinal(ahead + 1)} · about ${liveQueue?.estimated_wait_minutes ?? 0} min`
    : joinState.allowed && queueOpen && !readinessConfirmed ? `${requiredLeft} required item${requiredLeft === 1 ? '' : 's'} left`
    : blockedNotice?.detail || '';


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
      /* No haptic here: HoldButton already fired success the moment the hold
         landed, which is the beat the user is actually feeling. A second one
         when the request returns reads as a stutter, not as confirmation. */
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 148 + lift }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Join remotely</Text>
        <Text style={{ fontFamily: font.extra, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: '#fff', marginTop: 8, marginBottom: 10 }}>Take your spot{'\n'}from anywhere.</Text>

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
                  <Text style={{ fontFamily: font.extra, fontSize: 12, color: "#0c1826" }}>{initials(branch.business_name)}</Text>
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
              /* App Screens Refresh 1c: a bigger checklist in the Reminders
                 style. Tap a row to tick it; required items gate the button. */
              <View style={{ marginTop: 20, borderRadius: 24, backgroundColor: '#fff', overflow: 'hidden' }}>
                <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ fontFamily: font.extra, fontSize: 22, letterSpacing: -0.6, color: '#0c1826' }}>Have these ready</Text>
                    <Text style={{ fontFamily: font.bold, fontSize: 13, color: readinessConfirmed ? '#166b41' : '#7a8699' }}>
                      {readinessConfirmed ? 'All set' : `${requiredLeft} left`}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: '#7a8699', marginTop: 6 }}>
                    Tick each required item before you take your place. Staff still check at the branch.
                  </Text>
                </View>

                {(['bring', 'prepare'] as const).map(kind => {
                  const items = readiness.filter(item => item.kind === kind);
                  if (!items.length) return null;
                  return (
                    <View key={kind}>
                      <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#5c6779', paddingTop: kind === 'bring' ? 16 : 18, paddingHorizontal: 20, paddingBottom: 2 }}>
                        {kind === 'bring' ? 'Bring with you' : 'Do before you arrive'}
                      </Text>
                      {items.map((item, i) => {
                        const checked = checkedReadiness.includes(item.id);
                        const last = i === items.length - 1;
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
                            accessibilityLabel={`${item.label}. ${item.is_mandatory ? 'Required' : 'Helpful'}${item.detail ? `. ${item.detail}` : ''}`}
                            style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20 }}
                          >
                            <View style={{ width: 24, height: 24, marginTop: 13, borderRadius: 7, backgroundColor: checked ? '#1b4b8f' : '#fff', borderWidth: 2, borderColor: checked ? '#1b4b8f' : '#c4ccd8', alignItems: 'center', justifyContent: 'center' }}>
                              {checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                            </View>
                            <View style={{ flex: 1, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#eef1f6' }}>
                              <Text style={{ fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: checked ? '#7a8699' : '#0c1826' }}>{item.label}</Text>
                              <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: '#7a8699', marginTop: 2 }}>
                                <Text style={{ fontFamily: font.bold, color: item.is_mandatory ? '#e5484d' : '#7a8699' }}>{item.is_mandatory ? 'Required' : 'Helpful'}</Text>
                                {item.detail ? ` · ${item.detail}` : ''}
                                {item.lead_minutes ? ` · ${item.lead_minutes >= 60
                                  ? `${Math.round(item.lead_minutes / 60)} hour${Math.round(item.lead_minutes / 60) === 1 ? '' : 's'} before`
                                  : `${item.lead_minutes} minutes before`}` : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
                <View style={{ height: 14 }} />
              </View>
            ) : null}

            <View style={{ marginTop: 14, borderRadius: 22, backgroundColor: '#fff', padding: 20 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 17, letterSpacing: -0.3, color: '#0c1826' }}>Good to know</Text>
              <View style={{ gap: 12, marginTop: 14 }}>
                {[
                  { icon: 'ticket-outline', text: 'You get a ticket number and a six-character code straight away.' },
                  { icon: 'notifications-outline', text: 'We tell you when to set off, and again when you are next.' },
                  { icon: 'shield-checkmark-outline', text: 'Show the code at the counter. It is how staff confirm it is you.' },
                ].map(step => (
                  <View key={step.text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <Ionicons name={step.icon as any} size={17} color="#143a6e" style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13.5, color: '#5c6779', lineHeight: 20 }}>{step.text}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: '#7a8699', lineHeight: 18, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#eef1f6' }}>
                Leave the queue any time. Taking a place in line is free.
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
                  {/* This sits on the navy page, not on a card: white text. */}
                  <Text style={{ fontFamily: font.extra, fontSize: 14, color: '#fff' }}>{blockedNotice.label}</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 19, marginTop: 3 }}>{blockedNotice.detail}</Text>
                </View>
              </View>
            )}
          </>
        )}
        {!!error && <Text style={{ fontFamily: font.bold, color: colors.danger, marginTop: 14 }}>{error}</Text>}
      </ScrollView>
      {/* App Screens Refresh 1c: one wide button at the foot, unlocking once
          the required items are ticked. The design makes it a tap with an
          arrow (it was hold-to-join); leaving is one tap on the ticket anyway. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: (Platform.OS === 'ios' ? 28 : 14) + lift, backgroundColor: colors.dark,
        shadowColor: colors.dark, shadowOpacity: 1, shadowRadius: 16, shadowOffset: { width: 0, height: -18 } }}>
        <TouchableOpacity
          disabled={!canJoin || loading}
          onPress={joinQueue}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canJoin }}
          accessibilityLabel={`${joinTitle}. ${joinSub}`}
          style={{ borderRadius: 24, overflow: 'hidden', ...(canJoin ? { shadowColor: '#2e6bff', shadowOpacity: 0.65, shadowRadius: 18, shadowOffset: { width: 0, height: 16 }, elevation: 10 } : null) }}
        >
          <LinearGradient
            colors={canJoin ? ['#143a6e', '#2e6bff'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ minHeight: 78, paddingLeft: 22, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 17, letterSpacing: -0.4, color: canJoin ? '#fff' : 'rgba(255,255,255,.7)' }}>{joinTitle}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: canJoin ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.45)', marginTop: 3 }}>{joinSub}</Text>
            </View>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: canJoin ? '#fff' : 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}>
              {loading || pageLoading ? <ActivityIndicator color={canJoin ? colors.dark : '#fff'} /> : (
                <Ionicons name="arrow-forward" size={20} color={canJoin ? '#0c1826' : 'rgba(255,255,255,.5)'} />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
