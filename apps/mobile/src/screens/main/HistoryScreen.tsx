/**
 * HistoryScreen — timeline redesign (reference image 2, right).
 * A 7-day strip selects the day; that day's visits render as a vertical
 * timeline. The most recent visit gets the full dark card; the rest are
 * light timeline entries.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
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

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dateKey(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

const STATUS_TONE: Record<string, string> = {
  served: colors.light,
  completed: colors.light,
  no_show: colors.busy,
  cancelled: colors.muted,
  left: colors.muted,
};

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

  // The last 7 calendar days, today last.
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    return d;
  }), []);
  const [selectedKey, setSelectedKey] = useState(() => dateKey(new Date()));

  const byDay = useMemo(() => {
    const map: Record<string, VisitHistoryRow[]> = {};
    for (const visit of history) (map[dateKey(visit.visit_date)] ||= []).push(visit);
    return map;
  }, [history]);

  const dayVisits = byDay[selectedKey] || [];
  const selectedDate = new Date(`${selectedKey}T12:00:00`);
  const isToday = selectedKey === dateKey(new Date());
  const olderCount = useMemo(() => {
    const weekKeys = new Set(days.map(dateKey));
    return history.filter(v => !weekKeys.has(dateKey(v.visit_date))).length;
  }, [history, days]);

  return (
    <View style={t.root}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 66, paddingBottom: 56 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentDeep} />}
      >
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={t.iconBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted }}>{MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}</Text>
          <View style={{ width: 46 }} />
        </View>
        <Text style={[t.h1, { marginBottom: 20 }]}>{isToday ? 'Today' : DAY_SHORT[selectedDate.getDay()]}</Text>

        {/* day strip */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}>
          {days.map(day => {
            const key = dateKey(day);
            const on = key === selectedKey;
            const hasVisits = (byDay[key] || []).length > 0;
            return (
              <TouchableOpacity key={key} onPress={() => setSelectedKey(key)} activeOpacity={0.85} style={{ alignItems: 'center', gap: 6, width: 44, paddingVertical: 10, borderRadius: 22, backgroundColor: on ? colors.dark : 'transparent' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: on ? '#fff' : colors.ink }}>{day.getDate()}</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: on ? colors.accent : colors.muted }}>{DAY_SHORT[day.getDay()]}</Text>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: hasVisits ? (on ? colors.accent : colors.light) : 'transparent' }} />
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading && <SkeletonRows count={4} />}
        {!!error && !isLoading && (
          <ErrorCard title="History unavailable" message="Your queue history could not be loaded right now." onRetry={() => refetch()} />
        )}
        {!isLoading && !error && dayVisits.length === 0 && (
          <EmptyCard icon="time-outline" title={isToday ? 'No visits today' : 'No visits this day'} message="Pick another day above, or join a queue and it will show up here." />
        )}

        {/* timeline */}
        <View>
          {dayVisits.map((visit, index) => {
            const first = index === 0;
            const last = index === dayVisits.length - 1;
            const tone = STATUS_TONE[visit.status] || colors.muted;
            const timeLabel = new Date(visit.visit_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return (
              <View key={visit.id} style={{ flexDirection: 'row', gap: 16 }}>
                {/* rail */}
                <View style={{ width: 18, alignItems: 'center' }}>
                  <View style={{ width: first ? 14 : 10, height: first ? 14 : 10, borderRadius: 7, marginTop: first ? 4 : 8, backgroundColor: first ? colors.dark : 'transparent', borderWidth: first ? 0 : 2, borderColor: colors.chevron }} />
                  {!last && <View style={{ flex: 1, width: 2, backgroundColor: '#e2e5ea', marginVertical: 4 }} />}
                </View>

                {/* entry */}
                <View style={{ flex: 1, paddingBottom: last ? 0 : 22 }}>
                  {first ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      disabled={!visit.ticket_id}
                      onPress={() => visit.ticket_id && navigation.navigate('Ticket', { ticketId: visit.ticket_id })}
                      style={{ backgroundColor: colors.dark, borderRadius: 24, padding: 19, ...shadow.hero }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 17, color: '#fff', letterSpacing: -0.3 }}>{visit.service_name}</Text>
                        <Text style={{ fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{timeLabel}</Text>
                      </View>
                      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 5 }}>{visit.business_name} · {visit.branch_name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.1)', borderRadius: 11, paddingVertical: 5, paddingHorizontal: 11 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
                          <Text style={{ fontFamily: font.extra, fontSize: 12, color: '#fff' }}>{formatStatus(visit.status)}</Text>
                        </View>
                        <View style={{ backgroundColor: colors.accent, borderRadius: 11, paddingVertical: 5, paddingHorizontal: 11 }}>
                          <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.accentInk }}>{visit.ticket_number}</Text>
                        </View>
                        <Text style={{ marginLeft: 'auto', fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{visit.wait_time_minutes ?? 0}m wait</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={!visit.ticket_id}
                      onPress={() => visit.ticket_id && navigation.navigate('Ticket', { ticketId: visit.ticket_id })}
                      style={{ paddingTop: 2 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                        <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 16, color: colors.ink, letterSpacing: -0.2 }}>{visit.service_name}</Text>
                        <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>{timeLabel}</Text>
                      </View>
                      <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 4 }}>{visit.branch_name} · {formatStatus(visit.status)} · {visit.wait_time_minutes ?? 0}m wait</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {olderCount > 0 && (
          <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 26 }}>
            {olderCount} older {olderCount === 1 ? 'visit' : 'visits'} beyond this week
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
