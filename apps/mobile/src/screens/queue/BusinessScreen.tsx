import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/apiClient';
import { BranchSummary, SavedBusiness } from '../../lib/mobileData';
import { colors, font, t, initials, statusFromWait, statusMeta } from '../../lib/theme';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Business'>;

export default function BusinessScreen() {
  const route = useRoute<Params>();
  const nav = useNavigation<any>();
  const queryClient = useQueryClient();
  const { businessId, businessName } = route.params;

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', businessId],
    queryFn: () => api.get<BranchSummary[]>(`/branches?business_id=${businessId}`, false),
    refetchInterval: 30_000,
  });
  const { data: saved = [] } = useQuery({ queryKey: ['saved-businesses'], queryFn: () => api.get<SavedBusiness[]>('/saved') });
  const isSaved = saved.some(business => business.id === businessId);

  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? api.delete(`/saved/${businessId}`) : api.post(`/saved/${businessId}`, {})),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-businesses'] }),
  });

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => nav.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <TouchableOpacity disabled={toggleSave.isPending} onPress={() => toggleSave.mutate()} style={t.iconBtn}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 }}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{initials(businessName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={t.h1}>{businessName}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted, marginBottom: 20 }}>Select a branch</Text>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />}
        {!isLoading && branches.length === 0 && <Text style={{ fontFamily: font.semibold, color: colors.muted }}>No branches are available for this company yet.</Text>}

        <View style={{ gap: 12 }}>
          {branches.map(b => {
            const wait = Math.round(Number(b.avg_wait_minutes || 0));
            const meta = statusMeta(statusFromWait(wait));
            return (
              <TouchableOpacity key={b.id} activeOpacity={0.85} onPress={() => nav.navigate('Branch', { businessId, branchId: b.id, branchName: b.name })} style={t.listRow}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="location-outline" size={20} color={colors.muted} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{b.name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted }}>{[b.city, b.parish].filter(Boolean).join(', ') || 'Location'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink }}>{wait}<Text style={{ fontSize: 11, color: colors.muted }}>m</Text></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                    <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: colors.muted }}>{meta.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
