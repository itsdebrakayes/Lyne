import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Business'>;
interface Branch { id: string; name: string; city?: string; parish?: string; is_active: boolean; }

export default function BusinessScreen() {
  const route = useRoute<Params>();
  const nav   = useNavigation<any>();
  const { businessId, businessName } = route.params;

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', businessId],
    queryFn: () => api.get<Branch[]>(`/branches?business_id=${businessId}`, false),
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <Text style={styles.title}>{businessName}</Text>
      <Text style={styles.sub}>Select a branch</Text>
      {isLoading ? <ActivityIndicator color="#fff" style={{ marginTop: 32 }} /> : (
        <FlatList
          data={branches}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item: b }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => nav.navigate('Branch', { businessId, branchId: b.id, branchName: b.name })}
            >
              <Text style={styles.branchName}>{b.name}</Text>
              {(b.city || b.parish) && <Text style={styles.branchLoc}>{[b.city, b.parish].filter(Boolean).join(', ')}</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20, paddingTop: 60 },
  back:       { marginBottom: 20 },
  backText:   { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:      { fontSize: 22, fontWeight: '700', color: '#fff' },
  sub:        { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 24 },
  card:       { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 10 },
  branchName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  branchLoc:  { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
});
