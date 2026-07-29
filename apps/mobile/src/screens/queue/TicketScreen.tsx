import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t, sp, type, initials } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import { haptics } from '../../lib/haptics';
import api from '../../lib/apiClient';
import { TicketRecord } from '../../lib/mobileData';
import { dismissLiveTicketNotification, registerPushNotifications, scheduleQueueUpdateNotification, updateLiveTicketNotification } from '../../lib/notifications';
import Code39Barcode from '../../components/Code39Barcode';
import QueuePosition from '../../components/QueuePosition';
import { Press } from '../../components/Press';
import { ErrorCard } from '../../components/Feedback';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Ticket'>;

const TERMINAL_META: Record<string, { label: string; tone: string; note: string }> = {
  no_show: { label: 'Place released', tone: colors.busy, note: 'The call window passed, so your spot was released. You can rejoin the queue below.' },
  left: { label: 'You left the queue', tone: colors.muted, note: 'You left this line. Join again whenever you are ready.' },
  cancelled: { label: 'Ticket cancelled', tone: colors.muted, note: 'This ticket was cancelled. You can join a new queue anytime.' },
  served: { label: 'Completed', tone: colors.light, note: 'This visit is complete. See you next time!' },
};

export default function TicketScreen() {
  const topPad = useTopPad(18);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const providedTicketId = route.params?.ticketId;
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<'idle' | 'enabling' | 'on' | 'denied'>('idle');
  const previous = useRef<{ status?: string; wait?: number }>({});

  const enableAlerts = async () => {
    if (alerts === 'enabling' || alerts === 'on') return;
    try {
      setAlerts('enabling');
      const token = await registerPushNotifications();
      setAlerts(token ? 'on' : 'denied');
    } catch {
      setAlerts('denied');
    }
  };

  const activeTicketQuery = useQuery({
    queryKey: ['active-ticket'],
    queryFn: () => api.get<TicketRecord | null>('/tickets/active'),
    enabled: !providedTicketId,
    refetchInterval: 5_000,
  });
  const ticketId = providedTicketId || activeTicketQuery.data?.id;
  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.get<TicketRecord>(`/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
    refetchInterval: 5_000,
  });
  const ticket = ticketQuery.data;
  const { refreshing, onRefresh } = useRefresh(activeTicketQuery.refetch, ticketQuery.refetch);

  useEffect(() => {
    if (!ticket) return;
    const liveStatuses = ['waiting', 'called', 'in_service'];
    if (previous.current.status && previous.current.status !== ticket.status) {
      // Buzz the phone on the two status changes that matter — being called
      // forward (the whole point of the app) and losing your place.
      if (ticket.status === 'called') haptics.success();
      else if (ticket.status === 'no_show') haptics.error();
      const title = ticket.status === 'called' ? "You're being called" : ticket.status === 'no_show' ? 'You lost your place in line' : 'Queue status updated';
      scheduleQueueUpdateNotification(title, `${ticket.branch_name || 'Your branch'}: ${ticket.status.replace('_', ' ')}`, ticket.id).catch(() => {});
    } else if (previous.current.wait !== undefined && previous.current.wait !== ticket.estimated_wait_minutes) {
      scheduleQueueUpdateNotification('Wait time updated', `Your estimated wait is now ${ticket.estimated_wait_minutes} minutes.`, ticket.id).catch(() => {});
    }
    // Ongoing "live ticket" notification (Android sticky; iOS passive/time-sensitive)
    // mirrors the in-app pill on the lock screen and notification shade.
    if (liveStatuses.includes(ticket.status)) {
      updateLiveTicketNotification({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        status: ticket.status as 'waiting' | 'called' | 'in_service',
        ahead: Math.max(0, (ticket.waiting_position ?? ticket.position ?? 1) - 1),
        estimatedWaitMinutes: ticket.estimated_wait_minutes,
        branchName: ticket.branch_name,
      }).catch(() => {});
    } else if (previous.current.status && liveStatuses.includes(previous.current.status)) {
      dismissLiveTicketNotification();
    }
    previous.current = { status: ticket.status, wait: ticket.estimated_wait_minutes };
  }, [ticket]);

  // Leaving is irreversible — the place in line is released to the next person
  // and cannot be reclaimed — so it is confirmed rather than fired on one tap.
  const leaveQueue = async () => {
    if (!ticketId) return;
    try {
      setLeaving(true); setError('');
      await api.put(`/tickets/${ticketId}/leave`, {});
      setConfirmLeave(false);
      navigation.navigate('Main');
    } catch (caught: unknown) {
      setConfirmLeave(false);
      haptics.error();
      setError(caught instanceof Error ? caught.message : 'Could not leave this queue.');
    } finally {
      setLeaving(false);
    }
  };

  const rejoin = () => {
    if (ticket?.branch_id && ticket?.service_id) {
      navigation.navigate('JoinQueue', { businessId: ticket.business_id || '', branchId: ticket.branch_id, serviceId: ticket.service_id, serviceName: ticket.service_name });
    } else {
      navigation.navigate('Main');
    }
  };

  if (!providedTicketId && activeTicketQuery.isLoading) return <View style={[t.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;
  if (!ticketId) return (
    <View style={[t.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Ionicons name="ticket-outline" size={30} color={colors.muted} /></View>
      <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink }}>No active ticket</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center', marginTop: 8 }}>You are not in a line right now. Find a branch and join from anywhere.</Text>
      <TouchableOpacity style={[t.primaryBtn, { marginTop: 20, alignSelf: 'stretch' }]} onPress={() => navigation.navigate('Main')}><Text style={t.primaryBtnText}>Find a queue</Text></TouchableOpacity>
    </View>
  );
  if (ticketQuery.isLoading) return <View style={[t.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;
  if (ticketQuery.error || !ticket) {
    return (
      <View style={[t.root, { justifyContent: 'center', padding: 24 }]}>
        <ErrorCard
          title="Ticket unavailable"
          message="Your live ticket could not be loaded. Check your connection and try again."
          onRetry={() => ticketQuery.refetch()}
        />
      </View>
    );
  }

  const ahead = Math.max(0, (ticket.waiting_position ?? ticket.position ?? 1) - 1);
  const active = ['waiting', 'called', 'in_service'].includes(ticket.status);
  const called = ticket.status === 'called';
  const inService = ticket.status === 'in_service';
  const terminal = TERMINAL_META[ticket.status];
  const statusLabel = called
    ? "It's your turn — head to the counter"
    : inService
      ? 'You are being served now'
      : ticket.status_message || (active ? 'You are in line' : terminal?.label || ticket.status.replace('_', ' '));

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 44, flexGrow: 1 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Queue ticket</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ticket card */}
        <View style={[t.cardLg, { borderRadius: 26, overflow: 'hidden', padding: 0 }]}>
          {/* dark header */}
          <View style={{ backgroundColor: colors.dark, padding: 16, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.ink }}>{initials(ticket.business_name || ticket.branch_name)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 14.5, color: '#fff' }}>{ticket.branch_name || 'Branch'}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{ticket.service_name || 'Service'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 11 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light }} />
              <Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.accent, letterSpacing: 0.5 }}>LIVE</Text>
            </View>
          </View>

          {/* body */}
          <View style={{ padding: 24, paddingTop: 28, alignItems: 'center' }}>
            <Text style={{ ...type.callout, color: colors.muted }}>{ticket.service_name || 'Your service'}</Text>
            <Text style={{ ...type.numeral, fontSize: 60, lineHeight: 64, color: colors.ink, marginVertical: sp.s }}>{ticket.ticket_number}</Text>
            <View style={{ backgroundColor: called ? colors.accent : inService ? colors.light : colors.surfaceAlt, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 15 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: called ? colors.accentInk : inService ? '#fff' : colors.ink }}>{statusLabel}</Text>
            </View>
            {called && (
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.sub, textAlign: 'center', marginTop: 12, lineHeight: 19 }}>
                Go to the counter and show the code below before the call window closes.
              </Text>
            )}
            {active && !inService && (
              <>
                {/* The line, drawn. "2 ahead" is a number you have to trust;
                    watching a dot disappear is the answer to the only question
                    anyone standing in a queue is actually asking. */}
                <QueuePosition ahead={ahead} called={called} />
                {!called && (
                  <View style={{ flexDirection: 'row', marginTop: sp.l, alignSelf: 'stretch' }}>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ ...type.numeralSm, color: colors.ink }}>{ticket.estimated_wait_minutes}<Text style={{ ...type.caption }}>m</Text></Text>
                      <Text style={{ ...type.caption, color: colors.muted, marginTop: sp.xs }}>estimated wait</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.border }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ ...type.numeralSm, color: colors.ink }}>{ticket.total_waiting ?? ahead + 1}</Text>
                      <Text style={{ ...type.caption, color: colors.muted, marginTop: sp.xs }}>in this line</Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* perforation */}
          <View style={{ height: 0, position: 'relative' }}>
            <View style={{ position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bg }} />
            <View style={{ position: 'absolute', right: -13, top: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bg }} />
          </View>

          {/* barcode */}
          <View style={{ padding: 24, paddingTop: 26, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginHorizontal: 22 }}>
            {active && ticket.verification_code ? <Code39Barcode value={ticket.verification_code} color={colors.ink} /> : null}
            <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted, letterSpacing: 1, marginTop: 14 }}>{ticket.verification_code || '—'}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.faint, marginTop: 5 }}>Show at registration to confirm it&apos;s you</Text>
          </View>
        </View>

        {/* terminal note */}
        {terminal && (
          <View style={[t.card, { marginTop: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }]}>
            <Ionicons name={ticket.status === 'served' ? 'checkmark-circle' : 'alert-circle'} size={22} color={terminal.tone} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{terminal.note}</Text>
          </View>
        )}

        {!!error && <Text style={{ fontFamily: font.bold, color: colors.danger, marginTop: 12, textAlign: 'center' }}>{error}</Text>}

        {/* actions */}
        <View style={{ marginTop: 28, flexDirection: 'row', gap: 12 }}>
          {active ? (
            <>
              <TouchableOpacity
                disabled={alerts === 'enabling' || alerts === 'on'}
                onPress={enableAlerts}
                style={[t.primaryBtn, { flex: 1, minHeight: 54 }, alerts === 'on' && { backgroundColor: colors.light }]}
              >
                {alerts === 'enabling' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Ionicons name={alerts === 'on' ? 'notifications' : 'notifications-outline'} size={16} color={colors.onDark} />
                    <Text style={t.primaryBtnText}>{alerts === 'on' ? 'Alerts on' : 'Notify me'}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Press disabled={leaving} label="Leave this queue"
                hint="Gives up your place in line"
                onPress={() => { haptics.warning(); setConfirmLeave(true); }}
                style={[t.ghostBtn, { flex: 1, minHeight: 54 }] as never}>
                {leaving ? <ActivityIndicator color={colors.danger} /> : <Text style={{ ...type.cardTitle, color: colors.danger }}>Leave queue</Text>}
              </Press>
            </>
          ) : terminal && ticket.status !== 'served' ? (
            <>
              <TouchableOpacity onPress={rejoin} style={[t.primaryBtn, { flex: 1, minHeight: 54 }]}><Text style={t.primaryBtnText}>Rejoin queue</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Main')} style={[t.ghostBtn, { flex: 1, minHeight: 54 }]}><Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>Home</Text></TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Main')} style={[t.primaryBtn, { flex: 1, minHeight: 54 }]}><Text style={t.primaryBtnText}>Return home</Text></TouchableOpacity>
          )}
        </View>
        {active && alerts === 'on' && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.light, textAlign: 'center', marginTop: 12 }}>We&apos;ll ping you when you&apos;re called or the wait changes.</Text>}
        {active && alerts === 'denied' && <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 12 }}>Enable notifications in Settings to get called-up alerts.</Text>}
      </ScrollView>

      <ConfirmSheet
        visible={confirmLeave}
        title="Leave this queue?"
        message={`You'll give up place ${ticket.waiting_position ?? ticket.position} for ${ticket.service_name || 'this service'}, and it goes to the next person straight away. If you change your mind you can rejoin, but you'll start again at the back of the line.`}
        confirmLabel="Leave queue"
        cancelLabel="Stay in line"
        icon="exit-outline"
        busy={leaving}
        onConfirm={leaveQueue}
        onCancel={() => setConfirmLeave(false)}
      />
    </View>
  );
}
