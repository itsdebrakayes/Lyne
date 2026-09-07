/**
 * QueueMapScreen — "The line right now".
 *
 * The line drawn as a line: a vertical rail running from the counters at the
 * top, down through the people waiting, to the spot you would land in.
 *
 * It was a grid of dots before, and the grid was wrong twice over. It ran
 * sideways on a screen whose spare room is vertical, so a short queue left a
 * band of nothing above the Join button; and it drew the people at the
 * counters in the same snake as the people queuing, so a caption reading
 * "AHEAD OF YOU 4" sat above a picture anyone would count as eight.
 *
 * On a rail the two sets are separated by construction — the counters are the
 * destination, the beads below them are the wait — and the connectors carry
 * `flex: 1`, so the drawing stretches to whatever height is left rather than
 * floating in the middle of an empty card.
 */
import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
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

const RAIL_W = 36;
const RAIL_INK = '#E2E8F0';
const WAITING_INK = '#101D2E';

/** Nine beads is where a queue stops reading as people and starts reading as
 *  texture. Past that the tail is stated in words instead. */
const MAX_BEADS = 9;

/** "5th" — the way somebody says their place out loud. */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const ones = n % 10;
  return `${n}${ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`;
}

function Bead({ size, fill, dashed }: { size: number; fill: string; dashed?: boolean }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: fill,
      ...(dashed ? { borderWidth: 2.5, borderColor: '#5F6C7E', borderStyle: 'dashed' as const } : null),
    }} />
  );
}

/** The stretch of rail between two beads. It is the flexible part of the
 *  drawing — the beads keep their size, the gaps take up the slack. */
function Link() {
  return (
    <View style={{ flexDirection: 'row', flex: 1, minHeight: 14, maxHeight: 72 }}>
      <View style={{ width: RAIL_W, alignItems: 'center' }}>
        <View style={{ width: 2, flex: 1, backgroundColor: RAIL_INK }} />
      </View>
    </View>
  );
}

function Stop({ bead, title, detail }: { bead: React.ReactNode; title?: string; detail?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: RAIL_W, alignItems: 'center' }}>{bead}</View>
      {!!title && (
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink, letterSpacing: -0.2 }}>
            {title}
          </Text>
          {!!detail && (
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {detail}
            </Text>
          )}
        </View>
      )}
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

  const beads = Math.min(waiting, MAX_BEADS);
  const overflow = waiting - beads;
  /* One label for the whole stretch of waiting people, hung off the middle
     bead. A caption beside every dot would be nine ways of saying the same
     sentence. */
  const labelAt = Math.floor((beads - 1) / 2);

  const join = () => {
    if (!joinState.allowed || !service) return;
    navigation.navigate('JoinQueue', { businessId, branchId, serviceId, serviceName: service.name });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 150 }} showsVerticalScrollIndicator={false}
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
            <View style={{
              flex: 1, minHeight: 260,
              backgroundColor: colors.surface, borderRadius: 24,
              paddingVertical: 22, paddingHorizontal: 18, marginTop: 12, ...shadow.card,
            }}>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>
                The line right now
              </Text>

              {waiting === 0 && (
                /* The card still stretches when there is nobody to draw, so the
                   empty state centres in it rather than clinging to the title. */
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <EmptyState
                    compact
                    icon="walk"
                    title="No one's waiting"
                    body={joinState.allowed
                      ? 'The counter is free. Join now and you should be seen as soon as you arrive.'
                      : 'Nobody is in this line at the moment.'}
                  />
                </View>
              )}

              {waiting > 0 && (
                /* Capped stretch, then centred: the rail fills the card for a
                   real queue, and a two-person line sits composed in the middle
                   instead of being pulled apart to the corners. */
                <View style={{ flex: 1, justifyContent: 'center', marginTop: 18, marginLeft: -6 }}>
                  {/* The head of the line — where everybody in it is going. */}
                  <Stop
                    bead={<Bead size={22} fill={colors.accent} />}
                    title={counters > 0 ? `${counters} ${counters === 1 ? 'counter' : 'counters'} open` : 'No counters open'}
                    detail={counters > 0 ? 'Serving now' : 'Nobody is being called'}
                  />

                  {Array.from({ length: beads }, (_, i) => (
                    <React.Fragment key={i}>
                      <Link />
                      <Stop
                        bead={<Bead size={13} fill={WAITING_INK} />}
                        title={i === labelAt ? `${waiting} ${waiting === 1 ? 'person' : 'people'} ahead of you` : undefined}
                        detail={i === labelAt && overflow > 0 ? `${beads} shown · ${overflow} more further back` : undefined}
                      />
                    </React.Fragment>
                  ))}

                  {joinState.allowed && (
                    <>
                      <Link />
                      <Stop
                        bead={<Bead size={22} fill="#B7C0CE" dashed />}
                        title="You'd be here"
                        detail={`${ordinal(waiting + 1)} in line · about ${wait} min`}
                      />
                    </>
                  )}
                </View>
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
