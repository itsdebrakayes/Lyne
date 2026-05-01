/**
 * BranchScreen — Service selection for a given branch.
 *
 * Shows:
 *  1. Live branch stats (waiting count, avg wait, open queues)
 *  2. BestTimeCard — AI recommendation for this branch
 *  3. Service list — tap to go to JoinQueueScreen
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import BestTimeCard from '../../components/BestTimeCard';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Branch'>;

interface Service {
  id: string;
  name: string;
  description?: string;
  avg_wait_minutes?: number;
  waiting_count?: number;
  ticket_prefix?: string;
}

interface BranchStats {
  total_waiting: number;
  avg_wait_minutes: number;
  open_queues: number;
}

export default function BranchScreen() {
  const route = useRoute<Params>();
  const nav   = useNavigation<any>();
  const { businessId, branchId, branchName } = route.params;

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services', branchId],
    queryFn: () => api.get<Service[]>(`/services?branch_id=${branchId}`),
  });

  const { data: stats } = useQuery({
    queryKey: ['branch-stats', branchId],
    queryFn: () => api.get<BranchStats>(`/branches/${branchId}/stats`),
    refetchInterval: 30_000,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{branchName}</Text>

      {/* Live stats row */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>{stats.total_waiting}</Text>
            <Text style={styles.statLbl}>Waiting</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>~{stats.avg_wait_minutes} min</Text>
            <Text style={styles.statLbl}>Avg Wait</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statVal}>{stats.open_queues}</Text>
            <Text style={styles.statLbl}>Open Queues</Text>
          </View>
        </View>
      )}

      {/* ── Best Time to Visit ── */}
      <BestTimeCard businessId={businessId} branchId={branchId} />

      {/* Services */}
      <Text style={styles.sectionLabel}>Select a Service</Text>

      {loadingServices ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      ) : services.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No services available right now.</Text>
        </View>
      ) : (
        services.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.card}
            onPress={() =>
              nav.navigate('JoinQueue', {
                businessId,
                branchId,
                serviceId: s.id,
                serviceName: s.name,
              })
            }
          >
            <View style={styles.cardLeft}>
              <Text style={styles.serviceName}>{s.name}</Text>
              {s.description && (
                <Text style={styles.serviceDesc} numberOfLines={1}>
                  {s.description}
                </Text>
              )}
              {s.waiting_count !== undefined && (
                <Text style={styles.waitingCount}>{s.waiting_count} waiting</Text>
              )}
            </View>
            <View style={styles.cardRight}>
              {s.avg_wait_minutes !== undefined && (
                <Text style={styles.wait}>~{s.avg_wait_minutes} min</Text>
              )}
              <Text style={styles.joinArrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content:   { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },

  back:     { marginBottom: 20 },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:    { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 16 },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statVal: { color: '#60a5fa', fontSize: 18, fontWeight: '800' },
  statLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLeft:     { flex: 1 },
  cardRight:    { alignItems: 'flex-end', gap: 4 },
  serviceName:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  serviceDesc:  { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  waitingCount: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 },
  wait:         { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  joinArrow:    { color: 'rgba(255,255,255,0.25)', fontSize: 22 },

  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyIcon:  { fontSize: 36 },
  emptyText:  { color: 'rgba(255,255,255,0.4)', fontSize: 15 },
});
