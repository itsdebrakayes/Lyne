/**
 * BusyTimesScreen — screen 02 of the Predictive Insights design.
 *
 * "When it's quiet at TAJ Constant Spring": a day × hour grid for ONE service,
 * tap a cell, read what that hour is actually like.
 *
 * Ported from the design file rather than interpreted from it. Every size,
 * weight, radius and colour below is the value in the source; where this had to
 * depart from it the comment says why.
 *
 * It is the destination of "See heatmap →" on screen 01, which is why the
 * heatmap that used to be an accordion inside each service card on that screen
 * is a screen of its own: sixty-three cells is not an inline detail, and a
 * service picker belongs above a grid rather than being implied by which card
 * you happened to expand.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../lib/theme';
import { D, RAMP, LEVEL_NAMES, waitLevel, hourText, DAY_SHORT, DAY_FULL } from '../../lib/predictiveDesign';
import { PREMIUM_TRIAL_ENABLED } from '../../lib/features';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import EmptyState from '../../components/EmptyState';
import PremiumLock from '../../components/PremiumLock';
import { InsightsHeader } from '../../components/InsightsHeader';
import { scheduleQuietHourReminder, ensureNotificationPermission } from '../../lib/notifications';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'BusyTimes'>;

interface Cell { dow: number; hour: number; visits: number; avg_wait: number }
interface ServicePlan {
  service_id: string;
  service_name: string;
  grid?: Cell[];
}
interface BestTimes { window_days: number; premium?: boolean; services: ServicePlan[] }

export default function BusyTimesScreen() {
  const topPad = useTopPad(8);
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user, refreshProfile } = useAuth();
  /* Two sources, and they can disagree for a moment. The user record flips the
     instant a trial starts; the cached response is still the free one until the
     refetch lands. Whichever says premium is enough to unlock — the record
     because entitlement is real, the payload because the data is already here.
     Reading only the record left the panel frosted over data it had; reading
     only the payload would leave it frosted until the network answered. */
  const entitled = Boolean(Number(user?.is_premium || 0));

  const [serviceId, setServiceId] = useState<string | null>(route.params?.serviceId ?? null);
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState<{ dow: number; hour: number } | null>(null);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState('');
  const [reminding, setReminding] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [remindError, setRemindError] = useState('');

  const { businessId, branchId, branchName } = route.params ?? ({} as any);

  const q = useQuery({
    queryKey: ['best-times', businessId, branchId, user?.id ?? 'anon'],
    queryFn: () => api.get<BestTimes>(`/predictions/best-times?business_id=${businessId}&branch_id=${branchId}`),
    enabled: Boolean(businessId && branchId),
    staleTime: 1000 * 60 * 15,
  });

  const premium = entitled || Boolean(q.data?.premium);
  const services = q.data?.services ?? [];
  const service = useMemo(
    () => services.find((s) => s.service_id === serviceId) || services[0] || null,
    [services, serviceId],
  );

  /* The grid is premium. For a free customer the server sends no cells at all,
     so the panel below renders a representative shape and PremiumLock frosts
     it — there is nothing real to leak because nothing real was sent. */
  const grid = service?.grid ?? [];

  const { hours, days, byKey } = useMemo(() => {
    const hourSet = new Set<number>();
    const daySet = new Set<number>();
    const map = new Map<string, Cell>();
    grid.forEach((c) => { hourSet.add(c.hour); daySet.add(c.dow); map.set(`${c.dow}-${c.hour}`, c); });
    return {
      hours: [...hourSet].sort((a, b) => a - b),
      days: [...daySet].sort((a, b) => a - b),
      byKey: map,
    };
  }, [grid]);

  /* Opens on the quietest well-evidenced cell rather than on nothing, so the
     detail card below is answering something the moment the screen appears. */
  const selected = useMemo(() => {
    if (sel) return byKey.get(`${sel.dow}-${sel.hour}`) ?? null;
    const solid = grid.filter((c) => c.visits >= 8);
    const pool = solid.length ? solid : grid;
    return [...pool].sort((a, b) => a.avg_wait - b.avg_wait)[0] ?? null;
  }, [sel, byKey, grid]);

  const startTrial = async () => {
    try {
      setTrialBusy(true); setTrialError('');
      await api.post('/auth/start-trial', {});
      await refreshProfile();
      await q.refetch();
    } catch (e: any) {
      setTrialError(e?.message || 'That did not work. Try again in a moment.');
    } finally {
      setTrialBusy(false);
    }
  };

  const remindMe = async () => {
    if (!selected || !service) return;
    try {
      setReminding(true); setRemindError('');
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setRemindError('Turn on notifications for Lyne to be reminded.');
        return;
      }
      await scheduleQuietHourReminder({
        branchName: branchName || 'your branch',
        serviceName: service.service_name,
        dow: selected.dow,
        hour: selected.hour,
        avgWait: selected.avg_wait,
      });
      setReminded(true);
    } catch (e: any) {
      setRemindError(e?.message || 'That reminder could not be set.');
    } finally { setReminding(false); }
  };

  /* A new cell means a new reminder is on offer. */
  React.useEffect(() => { setReminded(false); setRemindError(''); }, [sel?.dow, sel?.hour]);

  /* ── the placeholder grid a free customer sees under the frost ──
     Six rows of nine, in the real ramp, at the real size. Not data: the server
     sent none. It exists so the locked panel has the silhouette of the thing
     being sold rather than a grey rectangle. */
  const PLACEHOLDER_ROWS = 6;
  const PLACEHOLDER_COLS = 9;

  const body = () => {
    if (q.isLoading) return <SkeletonRows count={6} />;
    if (q.error) {
      return <ErrorCard title="Busy times unavailable"
        message="This branch's pattern could not be loaded. Check your connection and try again."
        onRetry={() => q.refetch()} />;
    }
    if (!services.length) {
      return <EmptyState icon="clock" title="Not enough visits yet"
        body="A few days of real visits are needed before an hourly pattern is worth reading."
        actionLabel="Go back" onAction={() => navigation.goBack()} />;
    }
    return null;
  };

  const earlier = body();

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 40 + lift }} showsVerticalScrollIndicator={false}>

        <InsightsHeader title="Busy times" onBack={() => navigation.goBack()} />

        <Text style={{ fontFamily: font.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: D.ink, maxWidth: 300, marginBottom: 16 }}>
          Quiet hours at {branchName || 'this branch'}
        </Text>

        {earlier || (
          <>
            {/* service picker · window chip */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setPicking((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: picking }}
                accessibilityLabel={`Service: ${service?.service_name ?? 'choose'}`}
                style={{
                  flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: 36,
                  backgroundColor: D.surface, borderWidth: 1, borderColor: '#e3e7ee',
                  borderRadius: 18, paddingLeft: 14, paddingRight: 12,
                }}
              >
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.semibold, fontSize: 13, color: D.ink }}>
                  {service?.service_name ?? 'Choose a service'}
                </Text>
                <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={14} color={D.ink} />
              </TouchableOpacity>
              <View style={{
                backgroundColor: D.surface, borderWidth: 1, borderColor: '#e3e7ee',
                borderRadius: 18, height: 36, paddingHorizontal: 14, justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: D.sub }}>
                  Last {q.data?.window_days ?? 90} days
                </Text>
              </View>
            </View>

            {picking && (
              <View style={{
                backgroundColor: D.surface, borderWidth: 1, borderColor: D.lineSoft,
                borderRadius: 18, marginTop: -16, marginBottom: 24, overflow: 'hidden',
              }}>
                {services.map((s, i) => (
                  <TouchableOpacity
                    key={s.service_id}
                    onPress={() => { setServiceId(s.service_id); setSel(null); setPicking(false); }}
                    accessibilityRole="button"
                    style={{
                      paddingVertical: 13, paddingHorizontal: 16,
                      borderBottomWidth: i === services.length - 1 ? 0 : 1, borderBottomColor: D.lineSoft,
                      backgroundColor: s.service_id === service?.service_id ? D.coolBg : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: font.semibold, fontSize: 13, color: D.ink }}>{s.service_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* the grid */}
            <PremiumLock
              locked={!premium}
              radius={20}
              headline="See every hour, for every service"
              error={trialError}
              trialBusy={trialBusy}
              onStartTrial={PREMIUM_TRIAL_ENABLED ? startTrial : undefined}
              unavailableNote={PREMIUM_TRIAL_ENABLED ? undefined : 'Premium arrives with the first App Store release.'}
              onSeePlans={() => navigation.navigate('Premium')}
            >
              <View style={{
                backgroundColor: D.surface, borderRadius: 20,
                paddingVertical: 20, paddingHorizontal: 18,
                borderWidth: 1, borderColor: '#edf0f4',
              }}>
                {/* hour axis — a 30px label gutter, then one column per hour */}
                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                  <View style={{ width: 28 }} />
                  {(premium ? hours : Array.from({ length: PLACEHOLDER_COLS }, (_, i) => 8 + i)).map((h) => (
                    <View key={h} style={{ flex: 1 }}>
                      <Text style={{ textAlign: 'center', fontFamily: font.medium, fontSize: 10, color: '#8a94a6' }}>
                        {h > 12 ? h - 12 : h}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={{ gap: 8, marginTop: 10 }}>
                  {(premium ? days : Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => i + 1)).map((dow) => (
                    <View key={dow} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      <Text style={{ width: 28, fontFamily: font.semibold, fontSize: 12, color: D.sub }}>
                        {DAY_SHORT[dow]}
                      </Text>
                      {(premium ? hours : Array.from({ length: PLACEHOLDER_COLS }, (_, i) => 8 + i)).map((hour) => {
                        const cell = premium ? byKey.get(`${dow}-${hour}`) : undefined;
                        const isSel = selected && cell
                          && selected.dow === cell.dow && selected.hour === cell.hour;
                        /* aspectRatio 1 on a flex child gives the design's
                           square cells at any width, which is what the source
                           uses and what keeps the grid square on a small phone. */
                        return (
                          <TouchableOpacity
                            key={hour}
                            disabled={!cell}
                            activeOpacity={0.75}
                            onPress={() => cell && setSel({ dow, hour })}
                            accessibilityRole={cell ? 'button' : undefined}
                            accessibilityLabel={cell
                              ? `${DAY_FULL[dow]} ${hourText(hour)}, about ${Math.round(cell.avg_wait)} minutes from ${cell.visits} visits`
                              : undefined}
                            accessibilityState={{ selected: Boolean(isSel) }}
                            style={{
                              flex: 1, aspectRatio: 1, borderRadius: 6,
                              backgroundColor: cell
                                ? RAMP[waitLevel(cell.avg_wait)]
                                : RAMP[(dow + hour) % 5],
                              /* The design's inner halo: box-shadow 0 0 0 2px
                                 #fff. A border works because the cell is a flat
                                 colour, so insetting it by 2 is invisible. */
                              borderWidth: isSel ? 2 : 0,
                              borderColor: '#fff',
                            }}
                          >
                            {/* The design's OUTER ring: box-shadow 0 0 0 4px
                                #0c1826, drawn 2px outside the cell. This was a
                                shadow with radius 0 and no offset, which draws
                                nothing at all on iOS — so the selected cell had
                                a white outline on a pale blue grid and was very
                                hard to find. A sibling View inset by -2 is the
                                one way to get a second ring in RN, and it is
                                positioned outside the cell exactly as the
                                design offsets it.

                                pointerEvents none so it cannot swallow the tap
                                it is sitting on top of. */}
                            {isSel && (
                              <View
                                pointerEvents="none"
                                style={{
                                  position: 'absolute',
                                  top: -3.5, left: -3.5, right: -3.5, bottom: -3.5,
                                  borderRadius: 9,
                                  borderWidth: 1.5,
                                  borderColor: D.ink,
                                }}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>

                {/* Quiet ———— Peak */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#8a94a6' }}>Quiet</Text>
                  <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
                    {RAMP.map((c) => (
                      <View key={c} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c }} />
                    ))}
                  </View>
                  <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#8a94a6' }}>Peak</Text>
                </View>
              </View>
            </PremiumLock>

            {/* the selected cell, in detail */}
            {premium && selected && (
              <View style={{
                backgroundColor: D.ink, borderRadius: 24, padding: 20, marginTop: 24,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,.6)' }}>
                      {DAY_FULL[selected.dow]}s at {hourText(selected.hour)}
                    </Text>
                    <Text style={{ fontFamily: font.semibold, fontSize: 22, letterSpacing: -0.4, color: '#fff', marginTop: 4 }}>
                      {LEVEL_NAMES[waitLevel(selected.avg_wait)]}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font.semibold, fontSize: 28, letterSpacing: -0.6, color: D.onDarkAccent, marginTop: 12 }}>
                    {Math.round(selected.avg_wait)}<Text style={{ fontFamily: font.medium, fontSize: 15, letterSpacing: 0 }}> min</Text>
                  </Text>
                </View>

                {/* The design's note is "Based on N visits · a good time to go",
                    or a pointer to a better slot. The alternative named here is
                    the quietest cell on the SAME day, so the suggestion is a
                    different hour rather than a different trip. */}
                <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,.55)', marginTop: 12 }}>
                  {(() => {
                    const base = `Based on ${selected.visits} visit${selected.visits === 1 ? '' : 's'}.`;
                    if (waitLevel(selected.avg_wait) <= 1) return `${base} A good time to go.`;
                    const sameDay = grid.filter((c) => c.dow === selected.dow && c.visits >= 8);
                    const better = [...sameDay].sort((a, b) => a.avg_wait - b.avg_wait)[0];
                    return better && better.hour !== selected.hour
                      ? `${base} Try ${DAY_FULL[selected.dow]} at ${hourText(better.hour)} for about ${Math.round(better.avg_wait)} min.`
                      : `${base} This is the quietest hour that day.`;
                  })()}
                </Text>

                {/* The design's two actions, and both do the thing they say.
                    "Remind me" schedules a local notification the evening
                    before the slot — 7pm, which is when somebody can still
                    rearrange a morning; a reminder at 8am for a 10am slot is
                    one you cannot act on. "Hold my place" is the Line Helper. */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                  <TouchableOpacity
                    onPress={remindMe}
                    disabled={reminding || reminded}
                    accessibilityRole="button"
                    accessibilityLabel={reminded ? 'Reminder set' : 'Remind me the evening before'}
                    style={{
                      flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
                      backgroundColor: 'rgba(125,163,224,.16)',
                    }}
                  >
                    {reminding ? <ActivityIndicator color="#b9cdee" size="small" /> : (
                      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: '#b9cdee' }}>
                        {reminded ? 'Reminder set' : 'Remind me'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('LineHelper', {
                      businessId, branchId, branchName,
                      serviceId: service!.service_id, serviceName: service!.service_name,
                      targetDow: selected.dow, targetHour: selected.hour,
                    })}
                    accessibilityRole="button"
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: D.accentBright, borderRadius: 12 }}
                  >
                    <Text style={{ fontFamily: font.semibold, fontSize: 14, color: '#fff' }}>Hold my place</Text>
                  </TouchableOpacity>
                </View>

                {!!remindError && (
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#ff9d9d', marginTop: 12 }}>
                    {remindError}
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
