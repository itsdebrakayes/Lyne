import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { TicketRecord } from '../../lib/mobileData';
import { scheduleQueueUpdateNotification } from '../../lib/notifications';
import Code39Barcode from '../../components/Code39Barcode';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Ticket'>;

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
      const title = ticket.status === 'called' ? "You're being called" : 'Queue status updated';
      scheduleQueueUpdateNotification(title, `${ticket.branch_name || 'Your branch'}: ${ticket.status.replace('_', ' ')}`, ticket.id).catch(() => {});
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

  if (!providedTicketId && activeTicketQuery.isLoading) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.text} /></View>;
  if (!ticketId) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}><Text style={{ color: colors.danger, fontWeight: '700', textAlign: 'center' }}>You do not have an active ticket right now.</Text><TouchableOpacity style={[v3.primaryButton, { marginTop: 18 }]} onPress={() => navigation.navigate('Main')}><Text style={v3.primaryButtonText}>Find a queue</Text></TouchableOpacity></View>;
  if (ticketQuery.isLoading) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.text} /></View>;
  if (ticketQuery.error || !ticket) return <View style={[v3.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}><Text style={{ color: colors.danger, fontWeight: '700', textAlign: 'center' }}>Your live ticket could not be loaded. Check your connection and try again.</Text></View>;

  const position = ticket.waiting_position ?? ticket.position;
  const active = ['waiting', 'called'].includes(ticket.status);
  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={[v3.content, { paddingBottom: 36 }]} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 18 }}><Text style={v3.label}>LIVE TICKET</Text><Text style={[v3.h2, { marginTop: 8 }]}>{ticket.branch_name}</Text><Text style={v3.small}>{ticket.service_name}</Text></View>
        <View style={[v3.darkCard, { padding: 24, marginBottom: 16, alignItems: 'center' }]}>
          <Text style={{ color: 'rgba(255,255,255,.55)', fontWeight: '800', fontSize: 11 }}>YOUR NUMBER</Text><Text style={{ color: '#fff', fontSize: 54, fontWeight: '800', marginVertical: 8 }}>{ticket.ticket_number}</Text>
          <Text style={{ color: ticket.status === 'called' ? '#7ef29a' : 'rgba(255,255,255,.65)', fontWeight: '800', textTransform: 'uppercase' }}>{ticket.status_message || ticket.status.replace('_', ' ')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 24, width: '100%' }}><View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 25, fontWeight: '800' }}>{position ?? '-'}</Text><Text style={{ color: 'rgba(255,255,255,.55)', fontWeight: '700' }}>position</Text></View><View style={{ flex: 1, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 25, fontWeight: '800' }}>{ticket.estimated_wait_minutes}m</Text><Text style={{ color: 'rgba(255,255,255,.55)', fontWeight: '700' }}>est. wait</Text></View></View>
        </View>
        <View style={[v3.card, { padding: 18, marginBottom: 16 }]}><Text style={{ color: colors.muted, fontWeight: '800', fontSize: 11, marginBottom: 12 }}>VERIFICATION CODE</Text><Text style={{ color: colors.text, fontSize: 25, fontWeight: '800', textAlign: 'center', letterSpacing: 3 }}>{ticket.verification_code}</Text><View style={{ marginTop: 16 }}>{ticket.verification_code ? <Code39Barcode value={ticket.verification_code} color={colors.text} /> : null}</View><Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 10 }}>Show this code when your number is called.</Text></View>
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700', marginBottom: 12 }}>{error}</Text>}
        {active ? <TouchableOpacity disabled={leaving} style={v3.secondaryButton} onPress={leaveQueue}>{leaving ? <ActivityIndicator color={colors.text} /> : <Text style={{ color: colors.text, fontWeight: '800' }}>Leave queue</Text>}</TouchableOpacity> : <TouchableOpacity style={v3.primaryButton} onPress={() => navigation.navigate('Main')}><Text style={v3.primaryButtonText}>Return home</Text></TouchableOpacity>}
      </ScrollView>
    </View>
  );
}
