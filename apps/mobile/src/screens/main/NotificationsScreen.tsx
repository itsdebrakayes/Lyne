import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';

interface NotificationRow {
  id: string;
  notification_type: string;
  message: string;
  is_read: boolean | number;
  sent_at: string;
  ticket_id?: string | null;
}

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  called: 'megaphone-outline',
  no_show: 'alert-circle-outline',
  queue_update: 'swap-vertical-outline',
};

function timeAgo(value: string) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const topPad = useTopPad(24);
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationRow[]>('/notifications'),
    refetchInterval: 20_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Opening the screen clears the unread state.
  useEffect(() => {
    if (notifications.some(n => !n.is_read)) {
      api.put('/notifications/read-all', {})
        .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => {});
    }
  }, [notifications, queryClient]);

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={[t.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()} style={[t.iconBtn, { marginBottom: 20 }]}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[t.h2, { marginBottom: 22 }]}>Notifications</Text>

        {isLoading && <SkeletonRows count={4} />}
        {!!error && !isLoading && (
          <ErrorCard title="Notifications unavailable" message="Your notifications could not be loaded right now." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && notifications.length === 0 && (
          <EmptyState
            icon="bell"
            title="Nothing to catch up on"
            body="When you're called forward, when a wait changes, or when it's time to set off — it lands here."
          />
        )}

        <View style={{ gap: 12 }}>
          {notifications.map(n => (
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.85}
              disabled={!n.ticket_id}
              onPress={() => n.ticket_id && navigation.navigate('Ticket', { ticketId: n.ticket_id })}
              style={[t.listRow, { padding: 14, alignItems: 'flex-start', opacity: n.is_read ? 0.75 : 1 }]}
            >
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: n.notification_type === 'no_show' ? colors.dangerSoft : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={TYPE_ICON[n.notification_type] || 'notifications-outline'} size={18} color={n.notification_type === 'no_show' ? colors.danger : colors.ink} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.ink, lineHeight: 20 }}>{n.message}</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted, marginTop: 6 }}>{timeAgo(n.sent_at)}</Text>
              </View>
              {!n.is_read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 4 }} />}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
