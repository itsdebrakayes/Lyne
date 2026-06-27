import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { BranchSummary, ServiceSummary, TicketRecord } from '../../lib/mobileData';
import { registerPushNotifications, scheduleDepartureReminder } from '../../lib/notifications';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'JoinQueue'>;
interface LiveQueue { id: string | null; waiting_count: number; estimated_wait_minutes: number; }

export default function JoinQueueScreen() {
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

  useEffect(() => { if (liveQueue?.id) setError(''); }, [liveQueue?.id]);

  const joinQueue = async () => {
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
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[v3.secondaryButton, { width: 46, minHeight: 46, marginBottom: 18 }]}><Ionicons name="chevron-back" size={22} color={colors.text} /></TouchableOpacity>
        <Text style={v3.label}>JOIN REMOTELY</Text><Text style={[v3.h1, { marginTop: 8, marginBottom: 10 }]}>Take your spot{`\n`}from anywhere.</Text>
        {pageLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 36 }} />}
        {!!pageError && <Text style={{ color: colors.danger, fontWeight: '700' }}>Live queue details could not be loaded.</Text>}
        {branch && service && <>
          <Text style={[v3.small, { lineHeight: 21, marginBottom: 20 }]}>You are joining {service.name} at {branch.business_name} · {branch.name}.</Text>
          <View style={[v3.darkCard, { padding: 22, marginBottom: 16 }]}><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>{branch.business_name}</Text><Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 }}>{service.name}</Text><View style={{ flexDirection: 'row', marginTop: 20 }}><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{liveQueue?.waiting_count ?? 0}</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>ahead</Text></View><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{liveQueue?.estimated_wait_minutes ?? 0}m</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>est. wait</Text></View></View></View>
          {!liveQueue?.id && <Text style={{ color: colors.danger, fontWeight: '700' }}>This service does not have an open queue today.</Text>}
        </>}
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: 14 }}>{error}</Text>}
      </ScrollView>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 26 }}><TouchableOpacity disabled={loading || pageLoading || !liveQueue?.id} style={[v3.primaryButton, (!liveQueue?.id || pageLoading) && { opacity: 0.45 }]} onPress={joinQueue}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={v3.primaryButtonText}>Confirm & join queue →</Text>}</TouchableOpacity></View>
    </View>
  );
}
