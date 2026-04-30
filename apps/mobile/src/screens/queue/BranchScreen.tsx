import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Branch'>;
interface Service { id: string; name: string; description?: string; avg_wait_minutes?: number; ticket_prefix?: string; }

export default function BranchScreen() {
  const route = useRoute<Params>();
  const nav   = useNavigation<any>();
  const { businessId, branchId, branchName } = route.params;

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', businessId],
    queryFn: () => api.get<Service[]>(`/services?business_id=${businessId}`, false),
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <Text style={styles.title}>{branchName}</Text>
      <Text style={styles.sub}>Select a service</Text>
      {isLoading ? <ActivityIndicator color="#fff" style={{ marginTop: 32 }} /> : (
        <FlatList
          data={services}
          keyExtractor={s => s.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => nav.navigate('JoinQueue', { businessId, branchId, serviceId: s.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{s.name}</Text>
                {s.description && <Text style={styles.serviceDesc} numberOfLines={1}>{s.description}</Text>}
              </View>
              {s.avg_wait_minutes !== undefined && (
                <Text style={styles.wait}>~{s.avg_wait_minutes} min</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20, paddingTop: 60 },
  back:        { marginBottom: 20 },
  backText:    { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:       { fontSize: 22, fontWeight: '700', color: '#fff' },
  sub:         { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 24 },
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 10 },
  serviceName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  serviceDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  wait:        { color: '#60a5fa', fontSize: 13, fontWeight: '600' },
});
