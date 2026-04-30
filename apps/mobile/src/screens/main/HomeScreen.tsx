import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';

interface SavedBusiness {
  id: string;
  business_id: string;
  business_name: string;
  business_color?: string;
  branch_count?: number;
}

interface VisitRecord {
  id: string;
  business_name: string;
  service_name: string;
  branch_name: string;
  visited_at: string;
  ticket_number: string;
  status: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const { data: saved = [], isLoading: loadingSaved, refetch: refetchSaved } = useQuery({
    queryKey: ['saved-businesses'],
    queryFn: () => api.get<SavedBusiness[]>('/saved'),
    enabled: !!user,
  });

  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['visit-history'],
    queryFn: () => api.get<VisitRecord[]>('/history?limit=10'),
    enabled: !!user,
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSaved(), refetchHistory()]);
    setRefreshing(false);
  };

  const statusColor: Record<string, string> = {
    completed: '#34d399',
    cancelled: '#f87171',
    no_show:   '#9ca3af',
    waiting:   '#60a5fa',
    called:    '#fbbf24',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'there'} 👋</Text>
        <Text style={styles.subGreeting}>Where are you heading today?</Text>
      </View>

      {/* Saved businesses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Places</Text>
        {loadingSaved ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
        ) : saved.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No saved businesses yet.</Text>
            <Text style={styles.emptyHint}>Search for a business and save it for quick access.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
            {saved.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[styles.savedCard, { borderColor: b.business_color || 'rgba(255,255,255,0.1)' }]}
                onPress={() => navigation.navigate('Business', { businessId: b.business_id, businessName: b.business_name })}
              >
                <View style={[styles.savedIcon, { backgroundColor: b.business_color ? `${b.business_color}33` : 'rgba(255,255,255,0.08)' }]}>
                  <Text style={styles.savedIconText}>{b.business_name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.savedName} numberOfLines={2}>{b.business_name}</Text>
                {b.branch_count !== undefined && (
                  <Text style={styles.savedBranches}>{b.branch_count} branch{b.branch_count !== 1 ? 'es' : ''}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Visit history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Visits</Text>
        {loadingHistory ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No visits yet.</Text>
            <Text style={styles.emptyHint}>Join a queue to get started.</Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {history.map(v => (
              <View key={v.id} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyBusiness}>{v.business_name}</Text>
                  <Text style={styles.historyService}>{v.service_name} · {v.branch_name}</Text>
                  <Text style={styles.historyDate}>{new Date(v.visited_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyTicket}>{v.ticket_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor[v.status] || '#9ca3af'}22` }]}>
                    <Text style={[styles.statusText, { color: statusColor[v.status] || '#9ca3af' }]}>{v.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0a0a0a' },
  content:          { paddingBottom: 32 },
  header:           { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  greeting:         { fontSize: 24, fontWeight: '700', color: '#fff' },
  subGreeting:      { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  section:          { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  hScroll:          { marginHorizontal: -20, paddingHorizontal: 20 },
  savedCard:        { width: 120, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, borderWidth: 1 },
  savedIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  savedIconText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  savedName:        { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  savedBranches:    { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 },
  emptyCard:        { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, alignItems: 'center' },
  emptyText:        { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '500' },
  emptyHint:        { color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 4, textAlign: 'center' },
  historyList:      { gap: 10 },
  historyCard:      { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center' },
  historyLeft:      { flex: 1 },
  historyBusiness:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  historyService:   { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  historyDate:      { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 },
  historyRight:     { alignItems: 'flex-end', gap: 6 },
  historyTicket:    { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:       { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
});
