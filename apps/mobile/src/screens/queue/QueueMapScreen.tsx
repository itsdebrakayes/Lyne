/**
 * QueueMapScreen — "The line right now".
 *
 * The seat-map from the reference set, read as what it actually looks like: a
 * queue. The open counters sit spread across the top in blue, a fork runs down
 * from each of them into the head of the line, and from there the line snakes
 * left→right→down→right→left: dark circles for everyone waiting, a dashed grey
 * spot for where you would land if you joined.
 *
 * The geometry is deliberately the seat map's, not something looser: big
 * circles on a tight pitch. Drawn small with generous gaps it read as dots on a
 * page rather than a queue.
 *
 * The fork is what separates the two sets. Counters and the people queuing for
 * them used to share one snake, so a caption reading "AHEAD OF YOU 4" sat above
 * a picture you would count as eight. Lifting the counters out and pointing
 * them at the head of the line says the true thing — four desks, one line
 * feeding all of them — and the dark card's numbers now match the drawing.
 */
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, shadow, remoteJoinInfo, hoursFromBranch } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import api from '../../lib/apiClient';
import { BranchSummary, ServiceSummary } from '../../lib/mobileData';
import { useContentColumn, useContentColumnInner } from '../../lib/stage';
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

/* The counter band above the line: desks on the top row, the fork gathering
   into a junction, then the drop into the head of the queue. */
const COUNTER_Y = R;
const JUNCTION_Y = 112;
const QUEUE_TOP = 182;
const RAIL = '#EDF1F7';

/** Where the nth of `total` counters sits along the top. */
function counterX(index: number, total: number) {
  if (total <= 1) return VB_W / 2;
  return R + (index * (VB_W - 2 * R)) / (total - 1);
}

/** Serpentine order: row 0 left→right, row 1 right→left, and so on. */
function seat(index: number, top: number) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const x = R + (row % 2 === 0 ? col : COLS - 1 - col) * PITCH_X;
  const y = top + row * PITCH_Y;
  return { x, y };
}

/** Only draw as many rows as the line actually needs — a six-person queue on a
 *  25-slot grid is three empty rows of nothing, and it buries the summary and
 *  the Join button below the fold. */
function gridFor(occupied: number, top: number) {
  const rows = Math.max(1, Math.min(ROWS, Math.ceil(occupied / COLS)));
  const capacity = rows * COLS;
  const height = top + (rows - 1) * PITCH_Y + R;
  const points = Array.from({ length: capacity }, (_, i) => {
    const { x, y } = seat(i, top);
    return `${x},${y}`;
  }).join(' ');
  return { rows, capacity, height, points };
}

/** "5th" — the way somebody says their place out loud. */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const ones = n % 10;
  return `${n}${ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`;
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
  const column = useContentColumn();
  const barColumn = useContentColumnInner();
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

  /* Five desks is as many as fit across the band at this circle size. Past
     that the drawing stops adding them and the dark card's COUNTERS OPEN
     carries the exact figure. */
  const desks = Math.max(0, Math.min(counters, COLS));
  // The map tops out at 25. A longer line still has to be honest, so the tail is
  // summarised under the grid rather than silently cropped.
  const drawnWaiting = Math.min(waiting, MAX_CAPACITY - 1);
  const overflow = waiting - drawnWaiting;
  const yourIndex = drawnWaiting;

  const queueTop = desks > 0 ? QUEUE_TOP : R;
  const occupied = drawnWaiting + (joinState.allowed ? 1 : 0);
  const grid = useMemo(() => gridFor(occupied, queueTop), [occupied, queueTop]);

  const join = () => {
    if (!joinState.allowed || !service) return;
    navigation.navigate('JoinQueue', { businessId, branchId, serviceId, serviceName: service.name });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 150, ...column }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 18 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>
              {service?.name || serviceName || 'This line'}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
              {branch?.name || '—'}
            </Text>
          </View>
        </View>

        {servicesQuery.isLoading && <SkeletonCard height={300} />}

        {!servicesQuery.isLoading && (
          <>
            {/* The answer first.
                This used to sit BELOW the drawing, so the screen opened on a
                grid of dots and made somebody decode a picture to reach three
                numbers they could have read in a second. The picture is the
                evidence; these are the answer, so they go on top. */}
            <View style={{ backgroundColor: colors.dark, borderRadius: 24, padding: 22, ...shadow.hero }}>
              <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: 'rgba(255,255,255,.5)', letterSpacing: 1 }}>
                IF YOU JOIN NOW
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 46, color: '#fff', letterSpacing: -1.8, lineHeight: 50 }}>
                  {joinState.allowed ? `${wait}` : '—'}
                </Text>
                <Text style={{ fontFamily: font.extra, fontSize: 18, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>
                  {joinState.allowed ? 'min wait' : joinState.label}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.12)' }}>
                {([
                  ['YOUR SPOT', joinState.allowed ? ordinal(waiting + 1) : '—'],
                  ['AHEAD OF YOU', joinState.allowed ? String(waiting) : '—'],
                  ['COUNTERS OPEN', counters > 0 ? String(counters) : 'None'],
                ] as const).map(([label, value]) => (
                  <View key={label} style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 9.5, color: 'rgba(255,255,255,.5)', letterSpacing: 0.8 }}>{label}</Text>
                    <Text style={{ fontFamily: font.extra, fontSize: 19, color: '#fff', letterSpacing: -0.5, marginTop: 4 }}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* The picture, second. */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 18, marginTop: 12, ...shadow.card }}>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>
                The line right now
              </Text>

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
                <>
                  <View style={{ marginTop: 14 }}>
                    <Svg viewBox={`0 0 ${VB_W} ${grid.height}`} width="100%" style={{ aspectRatio: VB_W / grid.height }}>
                      {/* The fork, drawn under everything: one strand from each
                          open desk, gathered at a junction, then a single drop
                          into the front of the line. */}
                      {desks > 0 && (
                        <>
                          {Array.from({ length: desks }, (_, i) => {
                            const cx = counterX(i, desks);
                            return (
                              <Path
                                key={`fork-${i}`}
                                d={`M${cx},${COUNTER_Y} C${cx},${COUNTER_Y + 48} ${VB_W / 2},${JUNCTION_Y - 48} ${VB_W / 2},${JUNCTION_Y}`}
                                fill="none" stroke={RAIL} strokeWidth={7} strokeLinecap="round"
                              />
                            );
                          })}
                          <Path
                            d={`M${VB_W / 2},${JUNCTION_Y} C${VB_W / 2},${JUNCTION_Y + 32} ${R},${QUEUE_TOP - 36} ${R},${QUEUE_TOP}`}
                            fill="none" stroke={RAIL} strokeWidth={7} strokeLinecap="round"
                          />
                        </>
                      )}

                      <Polyline points={grid.points} fill="none" stroke={RAIL} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />

                      {/* The desks. */}
                      {Array.from({ length: desks }, (_, i) => (
                        <Circle key={`desk-${i}`} cx={counterX(i, desks)} cy={COUNTER_Y} r={R} fill={colors.accent} />
                      ))}

                      {/* The line. */}
                      {Array.from({ length: grid.capacity }, (_, i) => {
                        const { x, y } = seat(i, queueTop);
                        const isWaiting = i < drawnWaiting;
                        const isYou = i === yourIndex && joinState.allowed;
                        if (isYou) {
                          return <Circle key={i} cx={x} cy={y} r={R} fill="#B7C0CE" stroke="#5F6C7E" strokeWidth={3} strokeDasharray="6 5" />;
                        }
                        return <Circle key={i} cx={x} cy={y} r={R} fill={isWaiting ? '#101D2E' : '#EDF1F7'} />;
                      })}
                    </Svg>
                  </View>

                  {overflow > 0 && (
                    <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 6 }}>
                      + {overflow} more further back
                    </Text>
                  )}

                  {/* Three keys, not four. "Open spot" was labelling the empty
                      circles — the absence of a person — which is the one thing
                      a queue drawing does not need explained. */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
                    <Legend swatch={colors.accent} label="At the counter" />
                    <Legend swatch="#101D2E" label="Waiting" />
                    <Legend swatch="#B7C0CE" border="#5F6C7E" label="You'd be here" />
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* The action, pinned — the same bar as the chooser and the agency
          screen, so three screens in a row do not each invent a way forward. */}
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30,
        backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
      }}>
        <TouchableOpacity
          style={barColumn}
          onPress={join}
          disabled={!joinState.allowed}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel={joinState.allowed ? `Join this line, about ${wait} minutes` : joinState.label}
          accessibilityState={{ disabled: !joinState.allowed }}
        >
          <LinearGradient
            colors={joinState.allowed ? [colors.accentDeep, colors.dark] : [colors.surfaceAlt, colors.surfaceAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              minHeight: 78, borderRadius: 24, paddingLeft: 24, paddingRight: 16,
              ...(joinState.allowed ? shadow.hero : null),
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{
                fontFamily: font.extra, fontSize: 19, letterSpacing: -0.4,
                color: joinState.allowed ? '#fff' : colors.muted,
              }}>
                {joinState.allowed ? 'Join this line' : joinState.label}
              </Text>
              <Text numberOfLines={1} style={{
                fontFamily: font.semibold, fontSize: 13, marginTop: 3,
                color: joinState.allowed ? 'rgba(255,255,255,.66)' : colors.muted,
              }}>
                {joinState.allowed
                  ? `You'd be ${ordinal(waiting + 1)} · about ${wait} min`
                  : joinState.detail}
              </Text>
            </View>
            <View style={{
              width: 50, height: 50, borderRadius: 25,
              backgroundColor: joinState.allowed ? '#fff' : colors.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="arrowRight" size={21} color={joinState.allowed ? colors.dark : colors.muted} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}
