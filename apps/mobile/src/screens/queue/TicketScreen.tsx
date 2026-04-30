import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Animated,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import { RootStackParamList } from '../../navigation/AppNavigator';

type TicketRouteProp = RouteProp<RootStackParamList, 'Ticket'>;

interface TicketData {
  id: string;
  ticket_number: string;
  position: number;
  status: string;
  estimated_wait_minutes: number;
  service_name: string;
  branch_name: string;
  business_name: string;
  joined_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  waiting:   'Waiting',
  called:    "You're up!",
  completed: 'Served',
  cancelled: 'Cancelled',
  no_show:   'No Show',
};

const STATUS_COLORS: Record<string, string> = {
  waiting:   '#60a5fa',
  called:    '#fbbf24',
  completed: '#34d399',
  cancelled: '#f87171',
  no_show:   '#9ca3af',
};

export default function TicketScreen() {
  const route     = useRoute<TicketRouteProp>();
  const nav       = useNavigation<any>();
  const qc        = useQueryClient();
  const { ticketId } = route.params;

  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.get<TicketData>(`/tickets/${ticketId}`),
    refetchInterval: 10_000,
  });

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Pulse animation when called
  useEffect(() => {
    if (ticket?.status === 'called') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [ticket?.status]);

  const cancelMutation = useMutation({
    mutationFn: () => api.put(`/tickets/${ticketId}/status`, { new_status: 'cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      nav.goBack();
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  const handleCancel = () => {
    Alert.alert(
      'Leave Queue',
      'Are you sure you want to leave the queue?',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]
    );
  };

  if (isLoading || !ticket) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  const statusColor = STATUS_COLORS[ticket.status] || '#9ca3af';
  const isDone = ['completed', 'cancelled', 'no_show'].includes(ticket.status);

  return (
    <View style={styles.container}>
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => nav.navigate('Main')}>
        <Text style={styles.backText}>← Home</Text>
      </TouchableOpacity>

      {/* Business info */}
      <Text style={styles.businessName}>{ticket.business_name}</Text>
      <Text style={styles.branchName}>{ticket.branch_name} · {ticket.service_name}</Text>

      {/* Ticket number */}
      <Animated.View style={[styles.ticketCard, { transform: [{ scale: pulseAnim }], borderColor: statusColor }]}>
        <Text style={styles.ticketLabel}>Your Ticket</Text>
        <Text style={styles.ticketNumber}>{ticket.ticket_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[ticket.status] || ticket.status}</Text>
        </View>
      </Animated.View>

      {/* Position & wait */}
      {!isDone && (
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoValue}>{ticket.position}</Text>
            <Text style={styles.infoLabel}>Position</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBox}>
            <Text style={styles.infoValue}>~{ticket.estimated_wait_minutes}</Text>
            <Text style={styles.infoLabel}>Min wait</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoBox}>
            <Text style={styles.infoValue}>{elapsed}</Text>
            <Text style={styles.infoLabel}>Min waited</Text>
          </View>
        </View>
      )}

      {/* Called state */}
      {ticket.status === 'called' && (
        <View style={styles.calledBanner}>
          <Text style={styles.calledEmoji}>🔔</Text>
          <Text style={styles.calledText}>Please proceed to the counter now!</Text>
        </View>
      )}

      {/* Done state */}
      {isDone && (
        <View style={styles.doneBanner}>
          <Text style={styles.doneText}>
            {ticket.status === 'completed' ? '✅ You have been served. Thank you!' : '❌ Your ticket has been cancelled.'}
          </Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => nav.navigate('Main')}>
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cancel button */}
      {!isDone && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>Leave Queue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 24, paddingTop: 60 },
  backBtn:      { marginBottom: 24 },
  backText:     { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  businessName: { fontSize: 22, fontWeight: '700', color: '#fff' },
  branchName:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 32 },
  ticketCard:   { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, marginBottom: 24 },
  ticketLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  ticketNumber: { fontSize: 52, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  statusBadge:  { marginTop: 12, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  statusText:   { fontSize: 13, fontWeight: '600' },
  infoRow:      { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 24 },
  infoBox:      { flex: 1, alignItems: 'center' },
  infoValue:    { fontSize: 24, fontWeight: '700', color: '#fff' },
  infoLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  infoDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  calledBanner: { backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  calledEmoji:  { fontSize: 24 },
  calledText:   { color: '#fbbf24', fontSize: 15, fontWeight: '600', flex: 1 },
  doneBanner:   { alignItems: 'center', marginBottom: 24 },
  doneText:     { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  homeBtn:      { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  homeBtnText:  { color: '#000', fontWeight: '700', fontSize: 15 },
  cancelBtn:    { borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelText:   { color: '#f87171', fontSize: 14, fontWeight: '600' },
});
