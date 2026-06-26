import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import { getBranch, getService } from '../../lib/prototypeData';
import api from '../../lib/apiClient';
import { registerPushNotifications, scheduleDepartureReminder } from '../../lib/notifications';

type LiveQueue = {
  id: string | null;
  waiting_count: number;
  estimated_wait_minutes: number;
};

type Ticket = {
  id: string;
  ticket_number: string;
  verification_code?: string;
  position: number;
  estimated_wait_minutes: number;
};

export default function JoinQueueScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branch = getBranch(route.params?.branchId);
  const service = getService(branch.id, route.params?.serviceId);
  const queueId = route.params?.queueId;
  const [liveQueue, setLiveQueue] = useState<LiveQueue | null>(queueId ? { id: queueId, waiting_count: service.people, estimated_wait_minutes: service.wait } : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!route.params?.branchId || !route.params?.serviceId) return;
    let cancelled = false;
    api.get<LiveQueue>(`/queues/live?branch_id=${route.params.branchId}&service_id=${route.params.serviceId}`, false)
      .then((data) => { if (!cancelled) setLiveQueue(data); })
      .catch(() => { /* Keep the visual estimate when prototype ids are not backend UUIDs. */ });
    return () => { cancelled = true; };
  }, [route.params?.branchId, route.params?.serviceId]);

  const waiting = liveQueue?.waiting_count ?? service.people;
  const wait = liveQueue?.estimated_wait_minutes ?? service.wait;

  const joinQueue = async () => {
    const targetQueueId = liveQueue?.id || queueId;
    if (!targetQueueId) {
      navigation.navigate('Ticket', { branchId: branch.id, serviceId: service.id });
      return;
    }
    try {
      setLoading(true);
      setError('');
      const ticket = await api.post<Ticket>('/tickets', { queue_id: targetQueueId });
      registerPushNotifications().catch(() => {});
      scheduleDepartureReminder({
        ticketId: ticket.id,
        branchName: branch.branch,
        branchLatitude: route.params?.latitude ?? branch.latitude,
        branchLongitude: route.params?.longitude ?? branch.longitude,
        estimatedWaitMinutes: ticket.estimated_wait_minutes || wait,
        leadTimeMinutes: 10,
      }).catch(() => {});
      navigation.navigate('Ticket', { branchId: branch.id, serviceId: service.id, ticket });
    } catch (err: any) {
      setError(err?.message || 'Could not join this queue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[v3.secondaryButton, { width: 46, minHeight: 46, marginBottom: 18 }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={v3.label}>JOIN REMOTELY</Text>
        <Text style={[v3.h1, { marginTop: 8, marginBottom: 10 }]}>Take your spot{'\n'}from anywhere.</Text>
        <Text style={[v3.small, { lineHeight: 21, marginBottom: 20 }]}>
          You are joining {service.name} at {branch.short} · {branch.branch}. Your saved profile will be used to pre-fill the visit.
        </Text>
        <View style={[v3.darkCard, { padding: 22, marginBottom: 16 }]}>
          <Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>{branch.agency}</Text>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 }}>{service.name}</Text>
          <View style={{ flexDirection: 'row', marginTop: 20 }}>
            <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{waiting}</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>ahead</Text></View>
            <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{wait}m</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>est. wait</Text></View>
            <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{service.lines}</Text><Text style={{ color: 'rgba(255,255,255,.6)', fontWeight: '700' }}>lines</Text></View>
          </View>
        </View>
        <View style={[v3.card, { padding: 18, gap: 12 }]}>
          {['Receive your ticket instantly', 'Track your position live', "We'll notify you when it is your turn"].map((copy, index) => (
            <View key={copy} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{index + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.text, fontWeight: '700' }}>{copy}</Text>
            </View>
          ))}
        </View>
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700', marginTop: 14 }}>{error}</Text>}
      </ScrollView>
      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 26 }}>
        <TouchableOpacity disabled={loading} style={v3.primaryButton} onPress={joinQueue}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={v3.primaryButtonText}>Confirm & join queue →</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
