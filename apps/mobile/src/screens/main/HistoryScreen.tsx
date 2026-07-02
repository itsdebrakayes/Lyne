import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, v3 } from '../../lib/mobileV3Styles';
import api from '../../lib/apiClient';

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
  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['visit-history'],
    queryFn: () => api.get<VisitHistoryRow[]>('/history'),
  });

  return (
    <View style={v3.root}>
      <ScrollView contentContainerStyle={v3.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[v3.h2, { marginBottom: 18 }]}>Queue History</Text>
        {isLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 32 }} />}
        {!!error && <Text style={{ color: colors.danger, fontWeight: '700' }}>Queue history could not be loaded.</Text>}
        {!isLoading && !error && history.length === 0 && <Text style={{ color: colors.muted, fontWeight: '600' }}>You do not have any completed visits yet.</Text>}
        {history.map(visit => (
          <TouchableOpacity
            key={visit.id}
            activeOpacity={0.86}
            disabled={!visit.ticket_id}
            onPress={() => visit.ticket_id && navigation.navigate('Ticket', { ticketId: visit.ticket_id })}
            style={[v3.card, { padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 }]}
          >
            <View style={v3.iconBox}><Text style={v3.iconText}>{visit.ticket_number?.slice(-2) || 'Q'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text }}>{visit.business_name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>{visit.branch_name} · {visit.service_name}</Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 5 }}>{formatStatus(visit.status)} · {visit.wait_time_minutes ?? 0}m wait</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
