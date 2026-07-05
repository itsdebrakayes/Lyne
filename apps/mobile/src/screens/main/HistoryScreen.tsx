import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, initials } from '../../lib/theme';
import api from '../../lib/apiClient';
import { EmptyCard, ErrorCard, SkeletonRows } from '../../components/Feedback';

interface VisitHistoryRow {
  id: string;
  ticket_id?: string | null;
  business_name: string;
  branch_name: string;
  service_name: string;
  ticket_number: string;
  visit_date: string;
  wait_time_minutes?: number | null;
  service_time_minutes?: number | null;
  status: string;
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const { data: history = [], isLoading, error, refetch } = useQuery({
    queryKey: ['visit-history'],
    queryFn: () => api.get<VisitHistoryRow[]>('/history'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={t.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} style={[t.iconBtn, { marginBottom: 16 }]}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[t.h2, { marginBottom: 18 }]}>Queue history</Text>
        {isLoading && <SkeletonRows count={5} />}
        {!!error && !isLoading && (
          <ErrorCard title="History unavailable" message="Your queue history could not be loaded right now." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && history.length === 0 && (
          <EmptyCard icon="time-outline" title="No visits yet" message="Join your first queue and your completed visits will show up here." />
        )}
        <View style={{ gap: 12 }}>
          {history.map(visit => (
            <TouchableOpacity
              key={visit.id}
              activeOpacity={0.86}
              disabled={!visit.ticket_id}
              onPress={() => visit.ticket_id && navigation.navigate('Ticket', { ticketId: visit.ticket_id })}
              style={[t.listRow, { padding: 15 }]}
            >
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{visit.ticket_number?.slice(-2) || initials(visit.business_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{visit.business_name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 3 }}>{visit.branch_name} · {visit.service_name}</Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 11, color: colors.muted, marginTop: 5 }}>{formatStatus(visit.status)} · {visit.wait_time_minutes ?? 0}m wait</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
