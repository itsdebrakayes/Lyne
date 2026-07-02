import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { brandGradient, colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { TicketRecord } from '../../lib/mobileData';
import { scheduleQueueUpdateNotification } from '../../lib/notifications';
import Code39Barcode from '../../components/Code39Barcode';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Ticket'>;

// Presentation config per ticket status.
const STATE_META: Record<string, { label: string; tone: string; note: string }> = {
  waiting: { label: 'In line', tone: '#c9bcff', note: 'Hang tight — we’ll notify you as your turn gets close.' },
  called: { label: "You're being called", tone: '#7ef2a3', note: 'Head to the counter now and show the code below.' },
  in_service: { label: 'Being served', tone: '#7ef2a3', note: 'You’re at the counter. Thanks for using QME Now!' },
  served: { label: 'Completed', tone: '#7ef2a3', note: 'This visit is complete. See you next time!' },
  no_show: { label: 'Place released', tone: '#ff9d9d', note: 'The call window passed, so your spot was released. You can rejoin the queue below.' },
  left: { label: 'You left the queue', tone: '#c9c9d4', note: 'You left this line. Join again whenever you’re ready.' },
  cancelled: { label: 'Ticket cancelled', tone: '#c9c9d4', note: 'This ticket was cancelled. You can join a new queue anytime.' },
};

export default function TicketScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const providedTicketId = route.params?.ticketId;
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const previous = useRef<{ status?: string; wait?: number }>({});
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

  useEffect(() => {
    if (!ticket) return;
    if (previous.current.status && previous.current.status !== ticket.status) {
      const meta = STATE_META[ticket.status];
      const title = ticket.status === 'called' ? "You're being called" : ticket.status === 'no_show' ? 'You lost your place in line' : 'Queue status updated';
      scheduleQueueUpdateNotification(title, `${ticket.branch_name || 'Your branch'}: ${meta?.label || ticket.status.replace('_', ' ')}`, ticket.id).catch(() => {});
    } else if (previous.current.wait !== undefined && previous.current.wait !== ticket.estimated_wait_minutes) {
      scheduleQueueUpdateNotification('Wait time updated', `Your estimated wait is now ${ticket.estimated_wait_minutes} minutes.`, ticket.id).catch(() => {});
    }
    previous.current = { status: ticket.status, wait: ticket.estimated_wait_minutes };
  }, [ticket]);

  const leaveQueue = async () => {
    if (!ticketId) return;
    try {
      setLeaving(true);
      setError('');
      await api.put(`/tickets/${ticketId}/leave`, {});
      navigation.navigate('Main');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not leave this queue.');
    } finally {
      setLeaving(false);
    }
  };

  const rejoin = () => {
    if (ticket?.branch_id && ticket?.service_id) {
      navigation.navigate('JoinQueue', {
        businessId: ticket.business_id || '',
        branchId: ticket.branch_id,
        serviceId: ticket.service_id,
        serviceName: ticket.service_name,
      });
    } else {
      navigation.navigate('Main');
    }
  };

  if (!providedTicketId && activeTicketQuery.isLoading) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.brand} /></View>;
  if (!ticketId) return (
    <View style={[v3.root, { alignItems: 'center', justifyContent: 'center', padding: 28 }]}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}><Ionicons name="ticket-outline" size={32} color={colors.brand} /></View>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, textAlign: 'center' }}>No active ticket</Text>
      <Text style={{ color: colors.muted, fontWeight: '600', textAlign: 'center', marginTop: 8 }}>You&apos;re not in a line right now. Find a branch and join from anywhere.</Text>
      <TouchableOpacity style={[v3.primaryButton, { marginTop: 20, alignSelf: 'stretch' }]} onPress={() => navigation.navigate('Main')}><Text style={v3.primaryButtonText}>Find a queue</Text></TouchableOpacity>
    </View>
  );
  if (ticketQuery.isLoading) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.brand} /></View>;
  if (ticketQuery.error || !ticket) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}><Text style={{ color: colors.danger, fontWeight: '700', textAlign: 'center' }}>Your live ticket could not be loaded. Check your connection and try again.</Text></View>;

  const meta = STATE_META[ticket.status] || STATE_META.waiting;
  const position = ticket.waiting_position ?? ticket.position;
  const active = ['waiting', 'called'].includes(ticket.status);
  const inService = ticket.status === 'in_service';
  const releasedNoShow = ticket.status === 'no_show';
  const showCode = active || inService;

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={[v3.content, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <View style={v3.pillBadge}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} /><Text style={v3.pillBadgeText}>LIVE TICKET</Text></View>
          <Text style={[v3.h2, { marginTop: 12, textAlign: 'center' }]}>{ticket.branch_name}</Text>
          <Text style={v3.small}>{ticket.service_name}</Text>
        </View>

        <LinearGradient colors={releasedNoShow ? ['#3a2440', '#241526'] : brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 30, padding: 26, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,.7)', fontWeight: '800', fontSize: 11, letterSpacing: 1 }}>YOUR NUMBER</Text>
          <Text style={{ color: '#fff', fontSize: 60, fontWeight: '900', marginVertical: 6, letterSpacing: -1 }}>{ticket.ticket_number}</Text>
          <Text style={{ color: meta.tone, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 13 }}>{ticket.status_message || meta.label}</Text>
          {(active || inService) && (
            <View style={{ flexDirection: 'row', marginTop: 24, width: '100%' }}>
              <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{position ?? '-'}</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700', fontSize: 12, marginTop: 2 }}>position</Text></View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,.18)' }} />
              <View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{ticket.estimated_wait_minutes}m</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700', fontSize: 12, marginTop: 2 }}>est. wait</Text></View>
            </View>
          )}
        </LinearGradient>

        <View style={[v3.card, { padding: 16, marginBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }]}>
          <Ionicons name={releasedNoShow ? 'alert-circle' : active || inService ? 'information-circle' : 'checkmark-circle'} size={22} color={releasedNoShow ? colors.danger : colors.brand} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 13.5, lineHeight: 19 }}>{meta.note}</Text>
        </View>

        {showCode && (
          <View style={[v3.card, { padding: 20, marginBottom: 16, alignItems: 'center' }]}>
            <Text style={v3.label}>Verification Code</Text>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 4, marginTop: 10 }}>{ticket.verification_code}</Text>
            <View style={{ marginTop: 16 }}>{ticket.verification_code ? <Code39Barcode value={ticket.verification_code} color={colors.text} /> : null}</View>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 12, fontWeight: '600' }}>Show this code when your number is called.</Text>
          </View>
        )}

        {!!error && <Text style={{ color: colors.danger, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>{error}</Text>}

        {active ? (
          <TouchableOpacity disabled={leaving} style={v3.secondaryButton} onPress={leaveQueue}>{leaving ? <ActivityIndicator color={colors.text} /> : <Text style={{ color: colors.danger, fontWeight: '800' }}>Leave queue</Text>}</TouchableOpacity>
        ) : releasedNoShow || ticket.status === 'left' || ticket.status === 'cancelled' ? (
          <>
            <TouchableOpacity style={v3.primaryButton} onPress={rejoin}><Text style={v3.primaryButtonText}>Rejoin this queue</Text></TouchableOpacity>
            <TouchableOpacity style={[v3.secondaryButton, { marginTop: 12 }]} onPress={() => navigation.navigate('Main')}><Text style={{ color: colors.text, fontWeight: '800' }}>Back to home</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={v3.primaryButton} onPress={() => navigation.navigate('Main')}><Text style={v3.primaryButtonText}>Return home</Text></TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
