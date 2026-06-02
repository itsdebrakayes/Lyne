/**
 * QMe Now Mobile — Luxury Ticket Screen
 * OLED Black · Bodoni Moda ticket number · Gold pulse rings · Premium glass card
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Vibration, Share, Alert, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/apiClient';

const { width: W } = Dimensions.get('window');
const GOLD = '#CA8A04';
const GOLD_LIGHT = '#D4AF37';
const BG = '#080706';

const STATUS_LABELS: Record<string, string> = { waiting: 'Waiting', in_service: 'Being Served', served: 'Complete', cancelled: 'Cancelled', left: 'Left Queue' };
const STATUS_COLOR: Record<string, string>  = { waiting: GOLD_LIGHT, in_service: '#4ade80', served: '#4ade80', cancelled: '#f87171', left: 'rgba(245,240,232,0.3)' };

// ── Animated Digit ────────────────────────────────────────────────────────────
function AnimatedDigit({ value }: { value: string }) {
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      Animated.parallel([
        Animated.timing(op, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -10, duration: 80, useNativeDriver: true }),
      ]).start(() => {
        prev.current = value; ty.setValue(10);
        Animated.parallel([
          Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.spring(ty, { toValue: 0, damping: 22, stiffness: 300, useNativeDriver: true }),
        ]).start();
      });
    }
  }, [value]);
  return <Animated.Text style={[s.digit, { opacity: op, transform: [{ translateY: ty }] }]}>{value}</Animated.Text>;
}

// ── Gold Pulse Rings ──────────────────────────────────────────────────────────
function GoldPulse({ color = GOLD_LIGHT }: { color?: string }) {
  const s1 = useRef(new Animated.Value(1)).current;
  const s2 = useRef(new Animated.Value(1)).current;
  const s3 = useRef(new Animated.Value(1)).current;
  const o1 = useRef(new Animated.Value(0.6)).current;
  const o2 = useRef(new Animated.Value(0.4)).current;
  const o3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const pulse = (sv: Animated.Value, ov: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(sv, { toValue: 2.4, duration: 2000, useNativeDriver: true }),
          Animated.timing(ov, { toValue: 0,   duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sv, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ov, { toValue: 0.6 - delay * 0.001, duration: 0, useNativeDriver: true }),
        ]),
      ])).start();
    pulse(s1, o1, 0);
    pulse(s2, o2, 650);
    pulse(s3, o3, 1300);
  }, []);

  const ring = (sv: Animated.Value, ov: Animated.Value) => (
    <Animated.View style={[ps.ring, { borderColor: color, transform: [{ scale: sv }], opacity: ov }]} />
  );
  return <View style={ps.container}>{ring(s1, o1)}{ring(s2, o2)}{ring(s3, o3)}</View>;
}

const ps = StyleSheet.create({
  container: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  ring:      { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
});

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({ totalSeconds }: { totalSeconds: number }) {
  const [secs, setSecs] = useState(totalSeconds);
  useEffect(() => { setSecs(totalSeconds); }, [totalSeconds]);
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = String(Math.floor(secs / 60)).padStart(2, '0').split('');
  const sc = String(secs % 60).padStart(2, '0').split('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {m.map((d, i) => <AnimatedDigit key={`m${i}`} value={d} />)}
      <Text style={[s.digit, { marginHorizontal: 2 }]}>:</Text>
      {sc.map((d, i) => <AnimatedDigit key={`s${i}`} value={d} />)}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TicketScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ticketId } = route.params || {};

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const prevStatus = useRef<string | null>(null);

  const cardScale   = useRef(new Animated.Value(0.92)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await apiClient.get(`/tickets/${ticketId}`);
      const data = res.data?.data;
      if (data) {
        if (prevStatus.current && prevStatus.current !== data.status) {
          if (data.status === 'in_service') Vibration.vibrate([0, 200, 100, 200]);
          else if (data.status === 'served') Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        }
        prevStatus.current = data.status;
        setTicket(data);
      }
    } catch (e: any) { setError(e.message || 'Failed to load ticket'); }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); const t = setInterval(fetchTicket, 10000); return () => clearInterval(t); }, [fetchTicket]);

  useEffect(() => {
    if (ticket) Animated.parallel([
      Animated.spring(cardScale,   { toValue: 1,   useNativeDriver: true, damping: 18, stiffness: 180 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [ticket]);

  const handleLeave = () => {
    Alert.alert('Leave Queue', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        setLeaving(true);
        try { await apiClient.patch(`/tickets/${ticketId}/status`, { status: 'left' }); navigation.navigate('Main'); }
        catch { Alert.alert('Error', 'Please try again.'); }
        finally { setLeaving(false); }
      }},
    ]);
  };

  const handleShare = async () => {
    if (!ticket) return;
    await Share.share({ message: `I'm at ${ticket.business_name}, ticket #${ticket.ticket_number}. Tracking with QMe Now.`, title: 'QMe Now Ticket' }).catch(() => {});
  };

  // Loading
  if (loading) return (
    <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="time-outline" size={22} color={GOLD} />
      </View>
      <Text style={[s.caption, { marginTop: 12 }]}>Loading your ticket…</Text>
    </View>
  );

  if (error || !ticket) return (
    <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="alert-circle-outline" size={36} color="#f87171" />
      <Text style={[s.caption, { color: '#f87171', marginTop: 8 }]}>{error || 'Ticket not found'}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={fetchTicket}>
        <Text style={[s.caption, { color: GOLD_LIGHT }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const status       = ticket.status as string;
  const statusColor  = STATUS_COLOR[status] || 'rgba(245,240,232,0.4)';
  const isServing    = status === 'in_service';
  const isDone       = ['served', 'cancelled', 'left'].includes(status);
  const position     = ticket.position ?? 1;
  const total        = ticket.total_in_queue ?? position;
  const progress     = total > 0 ? Math.max(0, Math.min(100, ((total - position + 1) / total) * 100)) : 0;
  const waitSecs     = (ticket.estimated_wait_minutes ?? 0) * 60;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Main')}>
          <Ionicons name="arrow-back" size={18} color="rgba(245,240,232,0.6)" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>Your Ticket</Text>
          {!isDone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <Animated.View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ade80' }} />
              <Text style={{ fontSize: 10, color: '#4ade80', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' }}>Live</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color="rgba(245,240,232,0.6)" />
        </TouchableOpacity>
      </View>

      {/* Business name */}
      <Animated.View style={{ opacity: cardOpacity, paddingHorizontal: 24, marginBottom: 20 }}>
        <Text style={s.businessName}>{ticket.business_name}</Text>
        <Text style={s.businessSub}>{ticket.branch_name} · {ticket.service_name}</Text>
      </Animated.View>

      {/* ── Main Ticket Card ── */}
      <Animated.View style={[s.ticketCard, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
        {/* Gold top border */}
        <View style={[s.cardGoldTop, { backgroundColor: statusColor }]} />

        {/* Glow */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${statusColor}05`, borderRadius: 28 }]} />

        {/* Pulse rings for in_service */}
        {isServing && <GoldPulse color={statusColor} />}

        <Text style={s.ticketCaption}>Ticket Number</Text>

        {/* Big Bodoni number */}
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          {String(ticket.ticket_number ?? '042').padStart(3, '0').split('').map((d, i) => (
            <AnimatedDigit key={i} value={d} />
          ))}
        </View>

        {/* Status badge */}
        <View style={[s.statusBadge, { borderColor: `${statusColor}35`, backgroundColor: `${statusColor}10` }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABELS[status] || status}</Text>
        </View>
      </Animated.View>

      {/* Stats */}
      {!isDone && (
        <Animated.View style={[s.statsRow, { opacity: cardOpacity }]}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Position</Text>
            <Text style={s.statValue}>{position}</Text>
            <Text style={s.statSub}>in queue</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statLabel}>Est. Wait</Text>
            {waitSecs > 0 ? <Countdown totalSeconds={waitSecs} /> : <Text style={s.statValue}>—</Text>}
            <Text style={s.statSub}>remaining</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statLabel}>Ahead</Text>
            <Text style={s.statValue}>{Math.max(0, position - 1)}</Text>
            <Text style={s.statSub}>people</Text>
          </View>
        </Animated.View>
      )}

      {/* Progress bar */}
      {!isDone && total > 0 && (
        <Animated.View style={[s.progressSection, { opacity: cardOpacity }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.caption}>Queue Progress</Text>
            <Text style={[s.caption, { color: GOLD_LIGHT }]}>{Math.round(progress)}%</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress}%` as any }]} />
          </View>
        </Animated.View>
      )}

      {/* Serving banner */}
      {isServing && (
        <Animated.View style={[s.servingBanner, { opacity: cardOpacity }]}>
          <Ionicons name="notifications" size={18} color="#4ade80" />
          <Text style={s.servingText}>It's your turn — please proceed to the counter.</Text>
        </Animated.View>
      )}

      {/* Done banner */}
      {isDone && (
        <Animated.View style={[s.doneBanner, { opacity: cardOpacity, borderColor: `${statusColor}25`, backgroundColor: `${statusColor}07` }]}>
          <Ionicons name={status === 'served' ? 'checkmark-circle' : 'close-circle'} size={36} color={statusColor} />
          <Text style={[s.doneTitle, { color: statusColor }]}>
            {status === 'served' ? 'Service Complete' : status === 'cancelled' ? 'Ticket Cancelled' : 'You Left the Queue'}
          </Text>
          <Text style={s.doneSub}>{status === 'served' ? 'Thank you for using QMe Now.' : 'You can rejoin any time.'}</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.navigate('Main')}>
            <Text style={[s.caption, { color: GOLD_LIGHT }]}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Actions */}
      <Animated.View style={[s.actions, { opacity: cardOpacity }]}>
        <TouchableOpacity style={s.secondaryBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={s.secondaryBtnText}>Home</Text>
        </TouchableOpacity>
        {!isDone && (
          <TouchableOpacity style={[s.leaveBtn, (leaving || isServing) && { opacity: 0.4 }]}
            onPress={handleLeave} disabled={leaving || isServing}>
            <Text style={s.leaveBtnText}>{leaving ? 'Leaving…' : 'Leave Queue'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: BG },
  content:       { paddingBottom: 48 },

  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  iconBtn:       { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.08)' },
  headerTitle:   { fontSize: 15, fontWeight: '700', color: '#F5F0E8' },

  businessName:  { fontSize: 20, fontWeight: '800', color: '#F5F0E8', textAlign: 'center', letterSpacing: -0.3 },
  businessSub:   { fontSize: 12, color: 'rgba(245,240,232,0.3)', textAlign: 'center', marginTop: 4 },

  ticketCard: {
    marginHorizontal: 20, borderRadius: 28, padding: 36,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center', overflow: 'hidden', marginBottom: 14,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, elevation: 8,
  },
  cardGoldTop:   { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.7 },
  ticketCaption: { fontSize: 9, color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 14 },

  digit:         { fontSize: 72, fontWeight: '700', color: '#F5F0E8', letterSpacing: -2, lineHeight: 80 },

  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusDot:     { width: 5, height: 5, borderRadius: 3 },
  statusText:    { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.06)' },
  statBox:  { flex: 1, alignItems: 'center', gap: 1 },
  statLabel:{ fontSize: 9, color: 'rgba(245,240,232,0.28)', textTransform: 'uppercase', letterSpacing: 1 },
  statValue:{ fontSize: 26, fontWeight: '800', color: '#F5F0E8' },
  statSub:  { fontSize: 9, color: 'rgba(245,240,232,0.22)' },
  statDivider: { width: 1, backgroundColor: 'rgba(212,175,55,0.08)', marginHorizontal: 4 },

  progressSection: { marginHorizontal: 20, marginBottom: 12 },
  progressTrack:   { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: GOLD_LIGHT, borderRadius: 2 },

  caption:    { fontSize: 11, color: 'rgba(245,240,232,0.35)', fontWeight: '500', letterSpacing: 0.3 },

  servingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, backgroundColor: 'rgba(74,222,128,0.07)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' },
  servingText:   { flex: 1, color: '#4ade80', fontSize: 12, fontWeight: '600', lineHeight: 17 },

  doneBanner: { marginHorizontal: 20, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, marginBottom: 14, gap: 8 },
  doneTitle:  { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  doneSub:    { color: 'rgba(245,240,232,0.35)', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  doneBtn:    { marginTop: 8, backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },

  retryBtn:   { marginTop: 12, padding: 10 },

  actions:         { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 4 },
  secondaryBtn:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.08)' },
  secondaryBtnText:{ color: 'rgba(245,240,232,0.5)', fontWeight: '600', fontSize: 13 },
  leaveBtn:        { flex: 1, backgroundColor: 'rgba(248,113,113,0.07)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' },
  leaveBtnText:    { color: '#f87171', fontWeight: '700', fontSize: 13 },
});
