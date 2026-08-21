/**
 * QueueMapScreen — "The line right now".
 *
 * The seat-map from the reference set, read as what it actually looks like: a
 * queue. Counters sit at the top, the line snakes left→right→down→right→left,
 * the blue dot is the person at the counter, the dark dots are everyone
 * waiting, and the dashed grey spot is where you would land if you joined.
 *
 * The geometry is deliberately the seat map's, not something looser: big
 * circles on a tight pitch. Drawn small with generous gaps it read as dots on a
 * page rather than a queue.
 */
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, font, shadow, remoteJoinInfo, hoursFromBranch } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import api from '../../lib/apiClient';
import { BranchSummary, ServiceSummary } from '../../lib/mobileData';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SkeletonCard } from '../../components/Feedback';
import Icon from '../../components/Icon';
import EmptyState from '../../components/EmptyState';

type Params = RouteProp<RootStackParamList, 'QueueMap'>;

// Seat-map geometry: 5 across, 5 down, circles 52 on a 65.5 pitch.
const COLS = 5;
const ROWS = 5;
const R = 26;
const PITCH_X = 65.5;
const PITCH_Y = 68;
const VB_W = R + (COLS - 1) * PITCH_X + R;   // 314
const MAX_CAPACITY = COLS * ROWS;

/** Serpentine order: row 0 left→right, row 1 right→left, and so on. */
function seat(index: number) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const x = R + (row % 2 === 0 ? col : COLS - 1 - col) * PITCH_X;
  const y = R + row * PITCH_Y;
  return { x, y };
}

/** Only draw as many rows as the line actually needs — a six-person queue on a
 *  25-slot grid is three empty rows of nothing, and it buries the summary and
 *  the Join button below the fold. */
function gridFor(occupied: number) {
  const rows = Math.min(ROWS, Math.max(2, Math.ceil((occupied + 1) / COLS)));
  const capacity = rows * COLS;
  const height = R + (rows - 1) * PITCH_Y + R;
  const points = Array.from({ length: capacity }, (_, i) => {
    const { x, y } = seat(i);
    return `${x},${y}`;
  }).join(' ');
  return { rows, capacity, height, points };
}

function Legend({ swatch, border, label }: { swatch: string; border?: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: swatch, borderWidth: border ? 2.5 : 0, borderColor: border, borderStyle: border ? 'dashed' : 'solid' }} />
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

export default function QueueMapScreen() {
  const topPad = useTopPad(14);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { businessId, branchId, serviceId, serviceName } = route.params;

  const branchQuery = useQuery({ queryKey: ['branch', branchId], queryFn: () => api.get<BranchSummary>(`/branches/${branchId}`, false), refetchInterval: 30_000 });
  const servicesQuery = useQuery({
    queryKey: ['branch-services', businessId, branchId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?business_id=${businessId}&branch_id=${branchId}`, false),
    refetchInterval: 10_000,
  });
  const { refreshing, onRefresh } = useRefresh(branchQuery.refetch, servicesQuery.refetch);

  const branch = branchQuery.data;
  const service = (servicesQuery.data || []).find(s => s.id === serviceId);

  const waiting = Math.max(0, Number(service?.waiting_count || 0));
  const counters = Number(service?.active_counters || 0);
  const wait = service?.estimated_wait_minutes != null
    ? Math.round(Number(service.estimated_wait_minutes))
    : Math.round(Number(service?.avg_wait_minutes || 0));

  const joinState = useMemo(() => remoteJoinInfo(new Date(), hoursFromBranch(branch)), [branch]);

  // The map tops out at 25. A longer line still has to be honest, so the tail is
  // summarised under the grid rather than silently cropped.
  /* People AT the counters and people IN the line are two different sets, and
     the picture used to conflate them: exactly one dot was drawn "at the
     counter" no matter how many counters were open, and that dot also consumed
     the first waiting slot. So a header reading "3 OPEN · 6 waiting" sat above a
     diagram showing one person served and five queuing — the caption and the
     drawing disagreed, on the one screen whose whole job is to make the line
     legible at a glance.

     Seats are now laid out in the order a person actually experiences them:
     the open counters first, then the line, then where you would land. */
  const atCounters = Math.max(0, Math.min(counters, MAX_CAPACITY - 1));
  const drawnWaiting = Math.min(waiting, Math.max(0, MAX_CAPACITY - atCounters - 1));
  const overflow = waiting - drawnWaiting;
  const yourIndex = atCounters + drawnWaiting;
  const grid = useMemo(() => gridFor(atCounters + drawnWaiting), [atCounters, drawnWaiting]);

  const join = () => {
    if (!joinState.allowed || !service) return;
    navigation.navigate('JoinQueue', { businessId, branchId, serviceId, serviceName: service.name });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 40 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>

        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={21} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 18, color: '#fff', letterSpacing: -0.4 }}>The line right now</Text>
        </View>

        {servicesQuery.isLoading && <SkeletonCard height={420} />}

        {!servicesQuery.isLoading && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 28, paddingVertical: 20, paddingHorizontal: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.6 }}>
                {service?.name || serviceName || 'This line'}
              </Text>
              <View style={{ marginLeft: 'auto', backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 13 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: colors.muted, letterSpacing: 0.4 }}>BRANCH</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink, marginTop: 1 }}>{branch?.name || '—'}</Text>
              </View>
            </View>

            {/* counters at the top, feeding the line */}
            <View style={{ backgroundColor: colors.dark, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Icon name="counter" size={17} color="#fff" />
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: '#fff', letterSpacing: 0.4 }}>
                {counters > 0 ? `COUNTERS · ${counters} OPEN` : 'COUNTERS CLOSED'}
              </Text>
              <Text style={{ marginLeft: 'auto', fontFamily: font.bold, fontSize: 12, color: 'rgba(255,255,255,.66)' }}>
                {waiting} waiting
              </Text>
            </View>
            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Icon name="arrowDown" size={18} color="#C3D4EA" />
            </View>

            {/* An empty line is not a failure state — it is the best outcome
                this app can report, and drawing 25 grey circles to say so
                buries it. Say it plainly instead. */}
            {waiting === 0 && (
              <EmptyState
                compact
                icon="walk"
                title="No one's waiting"
                body={joinState.allowed
                  ? 'The counter is free. Join now and you should be seen as soon as you arrive.'
                  : 'Nobody is in this line at the moment.'}
              />
            )}

            {waiting > 0 && (
            <Svg viewBox={`0 0 ${VB_W} ${grid.height}`} width="100%" style={{ aspectRatio: VB_W / grid.height }}>
              <Polyline points={grid.points} fill="none" stroke="#EDF1F7" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
              {Array.from({ length: grid.capacity }, (_, i) => {
                const { x, y } = seat(i);
                const atCounter = i < atCounters;
                const isWaiting = i >= atCounters && i < atCounters + drawnWaiting;
                const isYou = i === yourIndex && joinState.allowed;
                if (isYou) {
                  return <Circle key={i} cx={x} cy={y} r={R} fill="#B7C0CE" stroke="#5F6C7E" strokeWidth={3} strokeDasharray="6 5" />;
                }
                return (
                  <Circle key={i} cx={x} cy={y} r={R}
                    fill={atCounter ? colors.accent : isWaiting ? '#101D2E' : '#EDF1F7'} />
                );
              })}
            </Svg>
            )}

            {overflow > 0 && (
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 6 }}>
                + {overflow} more further back
              </Text>
            )}

            {waiting > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Legend swatch={colors.accent} label="At the counter" />
              <Legend swatch="#101D2E" label="Waiting" />
              <Legend swatch="#B7C0CE" border="#5F6C7E" label="You'd be here" />
              <Legend swatch="#EDF1F7" label="Open spot" />
            </View>
            )}
          </View>
        )}

        <View style={{ backgroundColor: colors.surface, borderRadius: 22, paddingVertical: 17, paddingHorizontal: 20, flexDirection: 'row', marginTop: 14, ...shadow.card }}>
          {([
            ['YOUR SPOT', joinState.allowed ? `${waiting + 1}${waiting + 1 === 1 ? 'st' : waiting + 1 === 2 ? 'nd' : waiting + 1 === 3 ? 'rd' : 'th'}` : '—'],
            ['AHEAD', joinState.allowed ? String(waiting) : '—'],
            ['EST. WAIT', joinState.allowed ? `${wait} min` : '—'],
          ] as const).map(([label, value]) => (
            <View key={label} style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.muted, letterSpacing: 0.4 }}>{label}</Text>
              <Text style={{ fontFamily: font.extra, fontSize: 21, color: colors.ink, letterSpacing: -0.8, marginTop: 3 }}>{value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={join}
          disabled={!joinState.allowed}
          accessibilityRole="button"
          accessibilityLabel={joinState.allowed ? `Join this line, about ${wait} minutes` : joinState.label}
          style={{ backgroundColor: joinState.allowed ? colors.accent : 'rgba(255,255,255,.12)', borderRadius: 20, height: 60, alignItems: 'center', justifyContent: 'center', marginTop: 14 }}
        >
          <Text style={{ fontFamily: font.extra, fontSize: 17, color: joinState.allowed ? colors.accentInk : 'rgba(255,255,255,.6)', letterSpacing: -0.3 }}>
            {joinState.allowed ? 'Join this line' : joinState.label}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
