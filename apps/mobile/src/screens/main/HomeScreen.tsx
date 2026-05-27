/**
 * HomeScreen — Q ME NOW Mobile App
 * Premium UI v3.0 — Animated cards, gradient header, live status badges
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/apiClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_COLOR: Record<string, string> = {
  waiting:    '#38bdf8',
  in_service: '#fbbf24',
  served:     '#4ade80',
  cancelled:  '#f87171',
  left:       '#9ca3af',
};

/* ── Animated Card ── */
function AnimatedCard({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, damping: 20, stiffness: 200 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/* ── Live Dot ── */
function LiveDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={styles.liveDotContainer}>
      <Animated.View style={[styles.liveDotRing, { transform: [{ scale }] }]} />
      <View style={styles.liveDotCore} />
    </View>
  );
}

/* ── Business Card ── */
function BusinessCard({ item, onPress }: { item: any; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, damping: 20 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 20 }).start();

  const color = item.business_color || '#0369a1';
  const initials = item.business_name.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}>
      <Animated.View style={[styles.businessCard, { transform: [{ scale }] }]}>
        <View style={[styles.businessIconBg, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.businessInitials, { color }]}>{initials}</Text>
        </View>
        <Text style={styles.businessName} numberOfLines={2}>{item.business_name}</Text>
        {item.branch_count !== undefined && (
          <Text style={styles.businessBranches}>{item.branch_count} branch{item.branch_count !== 1 ? 'es' : ''}</Text>
        )}
        <View style={[styles.businessColorBar, { backgroundColor: color }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ── History Card ── */
function HistoryCard({ item, index }: { item: any; index: number }) {
  const statusColor = STATUS_COLOR[item.status] || '#9ca3af';
  const date = new Date(item.visited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <AnimatedCard delay={index * 60} style={styles.historyCard}>
      <View style={styles.historyLeft}>
        <Text style={styles.historyBusiness}>{item.business_name}</Text>
        <Text style={styles.historyMeta}>{item.service_name} · {item.branch_name}</Text>
        <Text style={styles.historyDate}>{date}</Text>
      </View>
      <View style={styles.historyRight}>
        <Text style={styles.historyTicket}>#{item.ticket_number}</Text>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}40` }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
    </AnimatedCard>
  );
}

/* ── Main Screen ── */
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [saved, setSaved] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fetchData = async () => {
    try {
      setLoadingSaved(true);
      const savedRes = await apiClient.get('/user/saved-businesses');
      setSaved(savedRes.data?.data || []);
    } catch { setSaved([]); }
    finally { setLoadingSaved(false); }

    try {
      setLoadingHistory(true);
      const histRes = await apiClient.get('/user/history?limit=10');
      setHistory(histRes.data?.data || []);
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="rgba(255,255,255,0.4)" />}
    >
      {/* ── Header ── */}
      <AnimatedCard delay={0}>
        <View style={styles.header}>
          {/* Gradient orbs */}
          <View style={styles.orb1} />
          <View style={styles.orb2} />

          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => navigation.navigate('Search')}
            >
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          {/* Live status pill */}
          <View style={styles.livePill}>
            <LiveDot />
            <Text style={styles.livePillText}>Queue updates are live</Text>
          </View>
        </View>
      </AnimatedCard>

      {/* ── Saved Businesses ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Saved Businesses</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={styles.sectionAction}>Browse all</Text>
          </TouchableOpacity>
        </View>

        {loadingSaved ? (
          <ActivityIndicator color="#38bdf8" style={{ marginTop: 16 }} />
        ) : saved.length === 0 ? (
          <AnimatedCard delay={100}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="bookmark-outline" size={28} color="rgba(255,255,255,0.3)" />
              </View>
              <Text style={styles.emptyText}>No saved businesses</Text>
              <Text style={styles.emptyHint}>Search and save businesses for quick access.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Search')}>
                <Text style={styles.emptyBtnText}>Find a Business</Text>
              </TouchableOpacity>
            </View>
          </AnimatedCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hScrollContent}>
            {saved.map((b, i) => (
              <AnimatedCard key={b.id} delay={i * 60}>
                <BusinessCard
                  item={b}
                  onPress={() => navigation.navigate('Business', { businessId: b.business_id, businessName: b.business_name })}
                />
              </AnimatedCard>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Recent Visits ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Visits</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        {loadingHistory ? (
          <ActivityIndicator color="#38bdf8" style={{ marginTop: 16 }} />
        ) : history.length === 0 ? (
          <AnimatedCard delay={200}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={28} color="rgba(255,255,255,0.3)" />
              </View>
              <Text style={styles.emptyText}>No visits yet</Text>
              <Text style={styles.emptyHint}>Join a queue to get started.</Text>
            </View>
          </AnimatedCard>
        ) : (
          <View style={styles.historyList}>
            {history.map((v, i) => <HistoryCard key={v.id} item={v} index={i} />)}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#060a14' },
  content:           { paddingBottom: 40 },

  /* Header */
  header:            { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 28, overflow: 'hidden', position: 'relative' },
  orb1:              { position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(56,189,248,0.08)' },
  orb2:              { position: 'absolute', top: 20, left: -60, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(3,105,161,0.06)' },
  headerTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting:          { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  name:              { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  searchBtn:         { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  livePill:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' },
  livePillText:      { color: '#4ade80', fontSize: 12, fontWeight: '600' },

  /* Live Dot */
  liveDotContainer:  { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDotRing:       { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(74,222,128,0.4)' },
  liveDotCore:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },

  /* Section */
  section:           { marginTop: 28, paddingHorizontal: 20 },
  sectionHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:      { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionAction:     { fontSize: 13, fontWeight: '600', color: '#38bdf8' },

  /* Horizontal scroll */
  hScroll:           { marginHorizontal: -20 },
  hScrollContent:    { paddingHorizontal: 20, gap: 12 },

  /* Business Card */
  businessCard:      { width: 130, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  businessIconBg:    { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  businessInitials:  { fontSize: 18, fontWeight: '800' },
  businessName:      { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  businessBranches:  { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 },
  businessColorBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },

  /* Empty */
  emptyCard:         { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  emptyIcon:         { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyText:         { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  emptyHint:         { color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 18 },
  emptyBtn:          { marginTop: 16, backgroundColor: 'rgba(56,189,248,0.15)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  emptyBtnText:      { color: '#38bdf8', fontSize: 13, fontWeight: '700' },

  /* History */
  historyList:       { gap: 10 },
  historyCard:       { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  historyLeft:       { flex: 1 },
  historyBusiness:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  historyMeta:       { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  historyDate:       { color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 4 },
  historyRight:      { alignItems: 'flex-end', gap: 6 },
  historyTicket:     { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
  statusPill:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusPillText:    { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
});
