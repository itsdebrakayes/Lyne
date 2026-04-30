import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useMutation } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'JoinQueue'>;

export default function JoinQueueScreen() {
  const route = useRoute<Params>();
  const nav   = useNavigation<any>();
  const { businessId, branchId, serviceId } = route.params;

  const joinMutation = useMutation({
    mutationFn: () => api.post<{ id: string; ticket_number: string }>('/tickets', {
      business_id: businessId,
      branch_id:   branchId,
      service_id:  serviceId,
      intake_data: {},
    }),
    onSuccess: (ticket) => {
      nav.navigate('Ticket', { ticketId: ticket.id });
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <Text style={styles.title}>Join Queue</Text>
      <Text style={styles.sub}>You're about to join this queue. You'll receive a ticket number and live updates.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>What happens next</Text>
        <Text style={styles.step}>1. You'll get a ticket number</Text>
        <Text style={styles.step}>2. Watch your position update in real time</Text>
        <Text style={styles.step}>3. You'll be notified when it's your turn</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, joinMutation.isPending && styles.btnDisabled]}
        onPress={() => joinMutation.mutate()}
        disabled={joinMutation.isPending}
      >
        {joinMutation.isPending
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.btnText}>Join Queue</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 24, paddingTop: 60 },
  back:      { marginBottom: 24 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:     { fontSize: 26, fontWeight: '700', color: '#fff' },
  sub:       { color: 'rgba(255,255,255,0.45)', fontSize: 14, marginTop: 8, marginBottom: 32, lineHeight: 22 },
  card:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 32, gap: 10 },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  step:      { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  btn:       { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#000', fontWeight: '700', fontSize: 16 },
});
