import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/apiClient';
import { SavedBusiness } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Business'>;
interface Branch { id: string; name: string; city?: string; parish?: string; is_active: boolean; }

export default function BusinessScreen() {
  const route = useRoute<Params>();
  const nav   = useNavigation<any>();
  const queryClient = useQueryClient();
  const { businessId, businessName } = route.params;

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', businessId],
    queryFn: () => api.get<Branch[]>(`/branches?business_id=${businessId}`, false),
  });

  const { data: saved = [] } = useQuery({
    queryKey: ['saved-businesses'],
    queryFn: () => api.get<SavedBusiness[]>('/saved'),
  });
  const isSaved = saved.some(business => business.id === businessId);

  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? api.delete(`/saved/${businessId}`) : api.post(`/saved/${businessId}`, {})),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{businessName}</Text>
          <Text style={styles.sub}>Select a branch</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isSaved ? `Remove ${businessName} from saved` : `Save ${businessName}`}
          disabled={toggleSave.isPending}
          onPress={() => toggleSave.mutate()}
          style={styles.saveButton}
        >
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      {isLoading ? <ActivityIndicator color="#fff" style={{ marginTop: 32 }} /> : (
        <FlatList
          data={branches}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={<Text style={styles.empty}>No branches are available for this business yet.</Text>}
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
  titleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 24 },
  title:      { fontSize: 22, fontWeight: '700', color: '#fff' },
  sub:        { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 },
  saveButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  empty:      { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 16 },
  card:       { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 10 },
  branchName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  branchLoc:  { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
});
