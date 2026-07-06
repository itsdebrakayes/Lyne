import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials } from '../../lib/theme';
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
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
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
                  <Text style={{ fontFamily: font.extra, fontSize: 24, color: '#fff' }}>{liveQueue?.waiting_count ?? 0}</Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 4 }}>ahead</Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,.12)' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 24, color: '#fff' }}>{liveQueue?.estimated_wait_minutes ?? 0}<Text style={{ fontSize: 13 }}>m</Text></Text>
                  <Text style={{ fontFamily: font.bold, fontSize: 11, color: 'rgba(255,255,255,.55)', marginTop: 4 }}>est. wait</Text>
                </View>
              </View>
            </View>
            {!liveQueue?.id && <Text style={{ fontFamily: font.bold, color: colors.danger, marginTop: 14 }}>This service does not have an open queue today.</Text>}
          </>
        )}
        {!!error && <Text style={{ fontFamily: font.bold, color: colors.danger, marginTop: 14 }}>{error}</Text>}
      </ScrollView>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 28 }}>
        <TouchableOpacity disabled={loading || pageLoading || !liveQueue?.id} style={[t.primaryBtn, (!liveQueue?.id || pageLoading) && { opacity: 0.45 }]} onPress={joinQueue}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>Confirm & join queue →</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
