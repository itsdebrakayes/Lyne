import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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

  /* Ask every time this screen is opened.
     It lives in a navigator, so it is mounted long before it is looked at and
     never mounts again — which meant opening it showed whatever the 20s poll
     last happened to fetch. Somebody who was just called swiped the banner
     away, tapped the bell, and found an empty list: the row was on the server,
     the phone had not asked. A screen about what just happened cannot open on
     a cached answer. */
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  /* Off at the phone level: nothing here can turn it back on except the phone's
     own Settings, so say so and take them there. Never asked yet: ask here. */
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('granted');
  const checkPermission = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then(p => setPermission(p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied'))
      .catch(() => {});
  }, []);
  useFocusEffect(checkPermission);
  // Back from the phone's Settings: the screen never lost focus, so look again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st === 'active') checkPermission(); });
    return () => sub.remove();
  }, [checkPermission]);
  const turnOn = async () => {
    if (permission === 'undetermined') {
      const p = await Notifications.requestPermissionsAsync().catch(() => null);
      if (p?.granted) { setPermission('granted'); return; }
      if (p && !p.canAskAgain) { setPermission('denied'); return; }
    }
    Linking.openSettings().catch(() => {});
  };

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

        {permission !== 'granted' && (
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons name="notifications-off-outline" size={20} color={colors.ink} />
              <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Notifications are turned off</Text>
            </View>
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, lineHeight: 19 }}>
              {permission === 'denied'
                ? 'Turn them on in your phone’s Settings for Lyne, so you hear when you’re called even with the app closed.'
                : 'Turn them on so you hear when you’re called, even with the app closed.'}
            </Text>
            <TouchableOpacity onPress={turnOn} accessibilityRole="button" style={[t.primaryBtn, { minHeight: 48 }]}>
              <Text style={t.primaryBtnText}>{permission === 'denied' ? 'Open Settings' : 'Turn on notifications'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading && <SkeletonRows count={4} />}
        {!!error && !isLoading && (
          <ErrorCard title="Notifications unavailable" message="Your notifications could not be loaded right now." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && notifications.length === 0 && (
          <EmptyState
            icon="bell"
            title="Nothing to catch up on"
            body="When you're called forward, when a wait changes, or when it's time to set off, it lands here."
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
