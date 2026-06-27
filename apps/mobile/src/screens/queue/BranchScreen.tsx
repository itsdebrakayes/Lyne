import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';
import { BranchSummary, initials, queueStatus, ServiceSummary, statusMeta } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Branch'>;
interface BranchStats { total_waiting: number; avg_wait_minutes: number; open_queues: number; }

export default function BranchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { businessId, branchId } = route.params;
  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false) });
  const servicesQuery = useQuery({ queryKey: ['services', branchId], queryFn: () => api.get<ServiceSummary[]>(`/services?business_id=${businessId}&branch_id=${branchId}`, false), refetchInterval: 30_000 });
  const statsQuery = useQuery({ queryKey: ['branch-stats', branchId], queryFn: () => api.get<BranchStats>(`/branches/${branchId}/stats`, false), refetchInterval: 30_000 });
  const branch = branchQuery.data;
  const services = servicesQuery.data || [];
  const stats = statsQuery.data || { total_waiting: 0, avg_wait_minutes: 0, open_queues: 0 };
  const meta = statusMeta(queueStatus(Number(stats.avg_wait_minutes || 0)));
  const loading = branchQuery.isLoading || servicesQuery.isLoading;
  const failed = branchQuery.error || servicesQuery.error;

  return (
    <View style={v3.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: colors.featured, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={22} color="#fff" /></TouchableOpacity><Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Branch details</Text><View style={{ width: 44 }} /></View>
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <View style={{ width: 78, height: 78, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{initials(branch?.business_name || 'Q')}</Text></View>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: '600' }}>{branch?.business_name || 'Loading business'}</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 }}>{branch?.name || route.params.branchName}</Text>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 3 }}>{[branch?.city, branch?.parish].filter(Boolean).join(', ') || 'Location unavailable'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}><Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>~{Math.round(Number(stats.avg_wait_minutes))} min wait</Text><Text style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 11, fontWeight: '700' }}>● {meta.label}</Text></View>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Services & lines</Text><Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted }}>{stats.open_queues} LIVE</Text></View>
          {loading && <ActivityIndicator color={colors.text} style={{ marginTop: 30 }} />}
          {!!failed && <Text style={{ color: colors.danger, fontWeight: '700' }}>This branch's live services are unavailable.</Text>}
          {!loading && !failed && services.length === 0 && <Text style={{ color: colors.muted, fontWeight: '600' }}>No services are currently available at this branch.</Text>}
          {services.map(service => {
            const wait = Math.round(Number(service.avg_wait_minutes || service.base_avg_time_minutes || 0));
            const serviceMeta = statusMeta(queueStatus(wait));
            return (
              <TouchableOpacity key={service.id} activeOpacity={0.85} style={[v3.card, { padding: 16, marginBottom: 12 }]} onPress={() => navigation.navigate('JoinQueue', { businessId, branchId, serviceId: service.id, serviceName: service.name })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{service.name}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.pill, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: serviceMeta.color }} /><Text style={{ fontSize: 11, fontWeight: '800', color: colors.text }}>{serviceMeta.label}</Text></View></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 13 }}><View><Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{wait}m</Text><Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>est. wait</Text></View><View><Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{Number(service.waiting_count || 0)}</Text><Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>in line</Text></View><Ionicons name="chevron-forward" size={18} color={colors.text} style={{ marginLeft: 'auto' }} /></View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
