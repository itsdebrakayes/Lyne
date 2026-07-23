import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials, remoteJoinInfo, hoursFromBranch } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
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
  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false) });
  const serviceQuery = useQuery({ queryKey: ['service', serviceId], queryFn: () => api.get<ServiceSummary>(`/services/${serviceId}`, false) });
  const queueQuery = useQuery({ queryKey: ['live-queue', branchId, serviceId], queryFn: () => api.get<LiveQueue>(`/queues/live?branch_id=${branchId}&service_id=${serviceId}`, false), refetchInterval: 15_000 });
  const branch = branchQuery.data;
  const service = serviceQuery.data;
  const liveQueue = queueQuery.data;
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
  const canJoin = joinState.allowed && queueOpen;

  // Why the button is off, in the order the user would ask it.
  const blockedNotice = !branch ? null
    : !joinState.allowed ? { label: joinState.label, detail: joinState.detail }
    : !queueOpen ? { label: 'Not taking a line today', detail: `${service?.name || 'This service'} has no queue open at ${branch.name} today. Try another service, or check back tomorrow.` }
    : null;

  const ctaLabel = canJoin ? 'Confirm & join queue →'
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
      const ticket = await api.post<TicketRecord>('/tickets', { queue_id: liveQueue.id });
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
      setError(caught instanceof Error ? caught.message : 'Could not join this queue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pageLoading = branchQuery.isLoading || serviceQuery.isLoading || queueQuery.isLoading;
  const pageError = branchQuery.error || serviceQuery.error || queueQuery.error;

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[t.iconBtn, { marginBottom: 18 }]}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
        <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Join remotely</Text>
        <Text style={[t.h1, { marginTop: 8, marginBottom: 10 }]}>Take your spot{'\n'}from anywhere.</Text>

        {pageLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 36 }} />}
        {!!pageError && <Text style={{ fontFamily: font.bold, color: colors.danger }}>Live queue details could not be loaded.</Text>}

        {branch && service && (
          <>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 20 }}>You are joining {service.name} at {branch.business_name} · {branch.name}.</Text>
            <View style={{ backgroundColor: colors.dark, borderRadius: 26, padding: 22 }}>
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
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 28 }}>
        <TouchableOpacity disabled={loading || pageLoading || !canJoin} style={[t.primaryBtn, (!canJoin || pageLoading) && { opacity: 0.45 }]} onPress={joinQueue}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>{ctaLabel}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
