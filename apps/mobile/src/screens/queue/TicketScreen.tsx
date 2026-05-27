/**
 * TicketScreen — Q ME NOW Mobile App
 * Premium UI v3.0 — Animated ticket card, pulse ring, countdown, live dot
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Vibration, Share, Alert, Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_LABELS: Record<string, string> = {
  waiting:    'Waiting',
  in_service: 'Being Served',
  served:     'Served',
  cancelled:  'Cancelled',
  left:       'Left Queue',
};

const STATUS_COLOR: Record<string, string> = {
  waiting:    '#38bdf8',
  in_service: '#fbbf24',
  served:     '#4ade80',
  cancelled:  '#f87171',
  left:       '#9ca3af',
};

/* ── Animated Digit ── */
function AnimatedDigit({ value }: { value: string }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: 100, useNativeDriver: true }),
      ]).start(() => {
        prevValue.current = value;
        translateY.setValue(12);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 300 }),
        ]).start();
      });
    }
  }, [value]);

  return (
    <Animated.Text style={[styles.ticketDigit, { opacity, transform: [{ translateY }] }]}>
      {value}
    </Animated.Text>
  );
}

/* ── Animated Ticket Number ── */
function AnimatedTicketNumber({ value }: { value: number }) {
  const digits = String(value).padStart(3, '0').split('');
  return (
    <View style={styles.ticketNumberRow}>
      {digits.map((d, i) => <AnimatedDigit key={i} value={d} />)}
    </View>
  );
}

/* ── Pulse Ring ── */
function PulseRing({ color = '#fbbf24' }: { color?: string }) {
  const scale1 = useRef(new Animated.Value(1)).current;
  const scale2 = useRef(new Animated.Value(1)).current;
  const opacity1 = useRef(new Animated.Value(0.6)).current;
  const opacity2 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 2.2, duration: 1500, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();

    pulse(scale1, opacity1, 0);
    pulse(scale2, opacity2, 750);
  }, []);

  return (
    <View style={styles.pulseContainer}>
      <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: scale1 }], opacity: opacity1 }]} />
      <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: scale2 }], opacity: opacity2 }]} />
    </View>
  );
}

/* ── Countdown Timer ── */
function CountdownTimer({ totalSeconds }: { totalSeconds: number }) {
  const [seconds, setSeconds] = useState(totalSeconds);
  useEffect(() => { setSeconds(totalSeconds); }, [totalSeconds]);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mDigits = String(m).padStart(2, '0').split('');
  const sDigits = String(s).padStart(2, '0').split('');
  return (
    <View style={styles.countdownRow}>
      {mDigits.map((d, i) => <AnimatedDigit key={`m${i}`} value={d} />)}
      <Text style={styles.countdownColon}>:</Text>
      {sDigits.map((d, i) => <AnimatedDigit key={`s${i}`} value={d} />)}
    </View>
  );
}

/* ── Progress Bar ── */
function ProgressBar({ progress }: { progress: number }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: progress, duration: 1000, useNativeDriver: false }).start();
  }, [progress]);
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, {
        width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
      }]} />
    </View>
  );
}

/* ── Main Screen ── */
export default function TicketScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ticketId } = route.params || {};

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const prevStatus = useRef<string | null>(null);

  const cardScale = useRef(new Animated.Value(0.9)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await apiClient.get(`/tickets/${ticketId}`);
      const data = res.data?.data;
      if (data) {
        // Vibrate on status change
        if (prevStatus.current && prevStatus.current !== data.status) {
          if (data.status === 'in_service') Vibration.vibrate([0, 200, 100, 200]);
          else if (data.status === 'served') Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        }
        prevStatus.current = data.status;
        setTicket(data);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 10000);
    return () => clearInterval(interval);
  }, [fetchTicket]);

  // Entrance animation
  useEffect(() => {
    if (ticket) {
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [ticket]);

  const handleLeave = () => {
    Alert.alert('Leave Queue', 'Are you sure you want to leave the queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            await apiClient.patch(`/tickets/${ticketId}/status`, { status: 'left' });
            navigation.navigate('Main');
          } catch {
            Alert.alert('Error', 'Failed to leave queue. Please try again.');
          } finally {
            setLeaving(false);
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!ticket) return;
    try {
      await Share.share({
        message: `I'm in the queue at ${ticket.business_name}! My ticket number is #${ticket.ticket_number}. Track with Q ME NOW.`,
        title: 'Q ME NOW Ticket',
      });
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingPulse} />
          <Text style={styles.loadingText}>Loading your ticket...</Text>
        </View>
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={40} color="#f87171" />
          <Text style={styles.errorText}>{error || 'Ticket not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchTicket}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const status = ticket.status as string;
  const statusColor = STATUS_COLOR[status] || '#9ca3af';
  const isServing = status === 'in_service';
  const isDone = ['served', 'cancelled', 'left'].includes(status);
  const position = ticket.position ?? 1;
  const totalInQueue = ticket.total_in_queue ?? position;
  const progress = totalInQueue > 0 ? Math.max(0, Math.min(100, ((totalInQueue - position + 1) / totalInQueue) * 100)) : 0;
  const waitSeconds = (ticket.estimated_wait_minutes ?? 0) * 60;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Main')}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Your Ticket</Text>
          {!isDone && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDotCore} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      {/* ── Business Info ── */}
      <Animated.View style={{ opacity: cardOpacity }}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>{ticket.business_name}</Text>
          <Text style={styles.branchMeta}>{ticket.branch_name} · {ticket.service_name}</Text>
        </View>
      </Animated.View>

      {/* ── Main Ticket Card ── */}
      <Animated.View style={[styles.ticketCard, {
        transform: [{ scale: cardScale }],
        opacity: cardOpacity,
        borderColor: `${statusColor}40`,
        shadowColor: statusColor,
      }]}>
        {/* Background grid */}
        <View style={styles.cardGrid} />

        {/* Glow */}
        <View style={[styles.cardGlow, { backgroundColor: `${statusColor}08` }]} />

        {/* Pulse ring for in_service */}
        {isServing && <PulseRing color={statusColor} />}

        <Text style={styles.ticketLabel}>Your Ticket Number</Text>

        <AnimatedTicketNumber value={typeof ticket.ticket_number === 'string' ? parseInt(ticket.ticket_number) || 0 : ticket.ticket_number} />

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}40` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[status] || status}</Text>
        </View>

        {/* Bottom glow line */}
        <View style={[styles.cardBottomLine, { backgroundColor: statusColor }]} />
      </Animated.View>

      {/* ── Stats Row ── */}
      {!isDone && (
        <Animated.View style={[styles.statsRow, { opacity: cardOpacity }]}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Position</Text>
            <Text style={styles.statValue}>{position}</Text>
            <Text style={styles.statSub}>in queue</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Est. Wait</Text>
            {waitSeconds > 0 ? (
              <CountdownTimer totalSeconds={waitSeconds} />
            ) : (
              <Text style={styles.statValue}>—</Text>
            )}
            <Text style={styles.statSub}>remaining</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Ahead</Text>
            <Text style={styles.statValue}>{Math.max(0, position - 1)}</Text>
            <Text style={styles.statSub}>people</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Progress Bar ── */}
      {!isDone && totalInQueue > 0 && (
        <Animated.View style={[styles.progressSection, { opacity: cardOpacity }]}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Queue Progress</Text>
            <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          </View>
          <ProgressBar progress={progress} />
        </Animated.View>
      )}

      {/* ── In Service Banner ── */}
      {isServing && (
        <Animated.View style={[styles.servingBanner, { opacity: cardOpacity }]}>
          <View style={styles.servingIcon}>
            <Ionicons name="notifications" size={20} color="#fbbf24" />
          </View>
          <Text style={styles.servingText}>It's your turn! Please proceed to the counter now.</Text>
        </Animated.View>
      )}

      {/* ── Done Banner ── */}
      {isDone && (
        <Animated.View style={[styles.doneBanner, { opacity: cardOpacity, borderColor: `${statusColor}30`, backgroundColor: `${statusColor}08` }]}>
          <Ionicons
            name={status === 'served' ? 'checkmark-circle' : 'close-circle'}
            size={40}
            color={statusColor}
          />
          <Text style={[styles.doneTitle, { color: statusColor }]}>
            {status === 'served' ? 'Service Completed' : status === 'cancelled' ? 'Ticket Cancelled' : 'You Left the Queue'}
          </Text>
          <Text style={styles.doneHint}>
            {status === 'served' ? 'Thank you for using Q ME NOW!' : 'You can rejoin the queue from the services page.'}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Main')}>
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Notification Prompt ── */}
      {!isDone && (
        <Animated.View style={[styles.notifCard, { opacity: cardOpacity }]}>
          <View style={styles.notifIcon}>
            <Ionicons name="notifications-outline" size={18} color="#38bdf8" />
          </View>
          <View style={styles.notifText}>
            <Text style={styles.notifTitle}>Stay Updated</Text>
            <Text style={styles.notifSub}>We'll notify you when you're almost up</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Actions ── */}
      <Animated.View style={[styles.actions, { opacity: cardOpacity }]}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
        {!isDone && (
          <TouchableOpacity
            style={[styles.leaveBtn, leaving && styles.leaveBtnDisabled]}
            onPress={handleLeave}
            disabled={leaving || isServing}
          >
            <Text style={styles.leaveBtnText}>{leaving ? 'Leaving...' : 'Leave Queue'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#060a14' },
  content:          { paddingBottom: 48 },
  centered:         { alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backBtn:          { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerCenter:     { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle:      { fontSize: 17, fontWeight: '700', color: '#fff' },
  liveIndicator:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDotCore:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText:         { fontSize: 11, color: '#4ade80', fontWeight: '600' },
  shareBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },

  /* Business */
  businessInfo:     { paddingHorizontal: 24, marginBottom: 20 },
  businessName:     { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  branchMeta:       { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4 },

  /* Ticket Card */
  ticketCard:       {
    marginHorizontal: 20, borderRadius: 28, padding: 32,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1, alignItems: 'center', overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24,
    elevation: 12, marginBottom: 16,
  },
  cardGrid:         {
    position: 'absolute', inset: 0,
    opacity: 0.03,
  },
  cardGlow:         { position: 'absolute', inset: 0, borderRadius: 28 },
  ticketLabel:      { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 },
  ticketNumberRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  ticketDigit:      { fontSize: 72, fontWeight: '900', color: '#fff', letterSpacing: -2, lineHeight: 80 },
  statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusDot:        { width: 6, height: 6, borderRadius: 3 },
  statusText:       { fontSize: 13, fontWeight: '700' },
  cardBottomLine:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, opacity: 0.6 },

  /* Pulse Ring */
  pulseContainer:   { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  pulseRing:        { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1.5 },

  /* Stats */
  statsRow:         { flexDirection: 'row', marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statBox:          { flex: 1, alignItems: 'center', gap: 2 },
  statLabel:        { fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue:        { fontSize: 26, fontWeight: '800', color: '#fff' },
  statSub:          { fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  statDivider:      { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 },

  /* Countdown */
  countdownRow:     { flexDirection: 'row', alignItems: 'center' },
  countdownColon:   { fontSize: 26, fontWeight: '800', color: '#fff', marginHorizontal: 1 },

  /* Progress */
  progressSection:  { marginHorizontal: 20, marginBottom: 12 },
  progressHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  progressPct:      { fontSize: 12, color: '#38bdf8', fontWeight: '700' },
  progressTrack:    { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: '100%', backgroundColor: '#38bdf8', borderRadius: 3 },

  /* Serving Banner */
  servingBanner:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
  servingIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(251,191,36,0.15)', alignItems: 'center', justifyContent: 'center' },
  servingText:      { flex: 1, color: '#fbbf24', fontSize: 13, fontWeight: '600', lineHeight: 18 },

  /* Done Banner */
  doneBanner:       { marginHorizontal: 20, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, marginBottom: 16, gap: 10 },
  doneTitle:        { fontSize: 20, fontWeight: '800' },
  doneHint:         { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  doneBtn:          { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  doneBtnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* Notif Card */
  notifCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, backgroundColor: 'rgba(56,189,248,0.06)', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)' },
  notifIcon:        { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(56,189,248,0.12)', alignItems: 'center', justifyContent: 'center' },
  notifText:        { flex: 1 },
  notifTitle:       { color: '#fff', fontSize: 13, fontWeight: '600' },
  notifSub:         { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },

  /* Actions */
  actions:          { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 8 },
  secondaryBtn:     { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  secondaryBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  leaveBtn:         { flex: 1, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
  leaveBtnDisabled: { opacity: 0.4 },
  leaveBtnText:     { color: '#f87171', fontWeight: '700', fontSize: 14 },

  /* Loading / Error */
  loadingCard:      { alignItems: 'center', gap: 12 },
  loadingPulse:     { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(56,189,248,0.15)' },
  loadingText:      { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  errorCard:        { alignItems: 'center', gap: 12, padding: 24 },
  errorText:        { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' },
  retryBtn:         { backgroundColor: 'rgba(56,189,248,0.15)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  retryBtnText:     { color: '#38bdf8', fontWeight: '700', fontSize: 13 },
});
