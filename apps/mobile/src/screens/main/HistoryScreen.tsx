import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';

interface VisitRecord { id: string; business_name: string; service_name: string; branch_name: string; visited_at: string; ticket_number: string; status: string; }

const STATUS_COLORS: Record<string, string> = { completed: '#34d399', cancelled: '#f87171', no_show: '#9ca3af', waiting: '#60a5fa', called: '#fbbf24' };

export default function HistoryScreen() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['visit-history-full'],
    queryFn: () => api.get<VisitRecord[]>('/history?limit=50'),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visit History</Text>
      {isLoading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={v => v.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item: v }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.business}>{v.business_name}</Text>
                <Text style={styles.service}>{v.service_name} · {v.branch_name}</Text>
                <Text style={styles.date}>{new Date(v.visited_at).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.ticket}>{v.ticket_number}</Text>
                <View style={[styles.badge, { backgroundColor: `${STATUS_COLORS[v.status] || '#9ca3af'}22` }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[v.status] || '#9ca3af' }]}>{v.status}</Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No visits yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20, paddingTop: 60 },
  title:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  card:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 10 },
  business:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  service:   { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  date:      { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 },
  ticket:    { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  empty:     { color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 48 },
});
