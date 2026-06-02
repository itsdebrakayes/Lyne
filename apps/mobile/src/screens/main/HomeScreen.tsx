/**
 * QMe Now Mobile — Luxury Home Screen
 * OLED Black · Gold accents · Elegant business cards · Warm dark palette
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, RefreshControl, Dimensions, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

const { width: W } = Dimensions.get('window');
const GOLD = '#CA8A04';
const GOLD_LIGHT = '#D4AF37';
const BG = '#080706';

interface Business { id: string; name: string; slug: string; city?: string; category?: string; is_open: boolean; avg_wait_minutes?: number; waiting_count?: number; }

const CATS = ['All', 'Health', 'Finance', 'Retail', 'Food', 'Services'];
const CAT_COLORS: Record<string, string> = { Health: '#4ade80', Finance: '#60a5fa', Retail: GOLD_LIGHT, Food: '#f97316', Services: GOLD };

function getStatus(wait = 0, count = 0): 'low' | 'med' | 'high' {
  if (wait > 20 || count > 30) return 'high';
  if (wait > 10 || count > 15) return 'med';
  return 'low';
}
const STATUS_COLOR: Record<string, string> = { low: '#4ade80', med: '#fbbf24', high: '#f87171' };
const STATUS_LABEL: Record<string, string> = { low: 'Available', med: 'Moderate', high: 'Busy' };

function GoldDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', transform: [{ scale }], opacity }} />
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ade80' }} />
    </View>
  );
}

function BusinessCard({ b, index }: { b: Business; index: number }) {
  const navigation = useNavigation<any>();
  const slideY = useRef(new Animated.Value(24)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, delay: index * 55, damping: 20, stiffness: 120, useNativeDriver: true }),
      Animated.timing(fade,   { toValue: 1, duration: 320, delay: index * 55, useNativeDriver: true }),
    ]).start();
  }, []);

  const status    = getStatus(b.avg_wait_minutes, b.waiting_count);
  const sColor    = STATUS_COLOR[status];
  const catColor  = CAT_COLORS[b.category || ''] || GOLD;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
      <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Business', { slug: b.slug, businessId: b.id })} activeOpacity={0.82}>
        {/* Gold stripe top */}
        <View style={[s.cardStripe, { backgroundColor: catColor }]} />

        <View style={s.cardBody}>
          {/* Avatar */}
          <View style={[s.avatar, { backgroundColor: `${catColor}14`, borderColor: `${catColor}30` }]}>
            <Text style={[s.avatarText, { color: catColor }]}>{b.name[0].toUpperCase()}</Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.cardName} numberOfLines={1}>{b.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
              {b.category && <Text style={[s.catTag, { color: catColor }]}>{b.category}</Text>}
              {b.city && <Text style={s.city} numberOfLines={1}>{b.city}</Text>}
            </View>

            {b.is_open && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <GoldDot />
                  <Text style={[s.statText, { color: sColor }]}>{STATUS_LABEL[status]}</Text>
                </View>
                {(b.waiting_count ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="people-outline" size={10} color="rgba(245,240,232,0.3)" />
                    <Text style={s.statMuted}>{b.waiting_count} waiting</Text>
                  </View>
                )}
                {(b.avg_wait_minutes ?? 0) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={10} color="rgba(245,240,232,0.3)" />
                    <Text style={s.statMuted}>~{b.avg_wait_minutes}m</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* CTA */}
          <View style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {b.is_open ? (
              <View style={[s.joinBtn, { backgroundColor: GOLD }]}>
                <Text style={s.joinBtnText}>Join</Text>
              </View>
            ) : (
              <View style={s.closedBadge}><Text style={s.closedText}>Closed</Text></View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;

  const { data: raw = [], refetch } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => apiClient.get('/businesses').then(r => r.data?.data || []),
    refetchInterval: 30000,
  });

  const mock: Business[] = [
    { id: '1', name: 'Downtown Clinic',  slug: 'downtown-clinic',  city: 'Kingston',     category: 'Health',   is_open: true,  avg_wait_minutes: 14, waiting_count: 22 },
    { id: '2', name: 'National Bank',    slug: 'national-bank',    city: 'Kingston',     category: 'Finance',  is_open: true,  avg_wait_minutes: 8,  waiting_count: 11 },
    { id: '3', name: 'Sovereign Centre', slug: 'sovereign-centre', city: 'Kingston',     category: 'Retail',   is_open: true,  avg_wait_minutes: 4,  waiting_count: 5  },
    { id: '4', name: 'Island Grill',     slug: 'island-grill',     city: 'New Kingston', category: 'Food',     is_open: true,  avg_wait_minutes: 20, waiting_count: 34 },
    { id: '5', name: 'Tax Authority',    slug: 'tax-authority',    city: 'Kingston',     category: 'Services', is_open: false, avg_wait_minutes: 0,  waiting_count: 0  },
    { id: '6', name: 'Health Express',   slug: 'health-express',   city: 'Portmore',     category: 'Health',   is_open: true,  avg_wait_minutes: 6,  waiting_count: 8  },
  ];

  const businesses = raw.length ? raw : mock;
  const filtered = businesses.filter(b => {
    const ms = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.city?.toLowerCase().includes(search.toLowerCase());
    const mc = cat === 'All' || b.category === cat;
    return ms && mc;
  });

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const h = { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  return (
    <View style={s.root}>
      {/* Header */}
      <Animated.View style={[s.header, h]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}</Text>
            <Text style={s.headline}>Find a Queue</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={16} color="rgba(245,240,232,0.5)" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={14} color="rgba(245,240,232,0.25)" />
          <TextInput style={s.searchInput} placeholder="Search businesses…" placeholderTextColor="rgba(245,240,232,0.2)"
            value={search} onChangeText={setSearch} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={14} color="rgba(245,240,232,0.25)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
          {CATS.map(c => (
            <TouchableOpacity key={c} onPress={() => setCat(c)}
              style={[s.chip, cat === c && { borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(202,138,4,0.1)' }]}>
              <Text style={[s.chipText, cat === c && { color: GOLD_LIGHT }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* List */}
      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={s.listCount}>{filtered.length} {filtered.length === 1 ? 'place' : 'places'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <GoldDot />
            <Text style={s.listLive}>Live</Text>
          </View>
        </View>

        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={28} color="rgba(245,240,232,0.15)" />
            <Text style={s.emptyTitle}>{search ? 'No results' : 'No businesses yet'}</Text>
            <Text style={s.emptyBody}>{search ? 'Try a different search.' : 'Businesses will appear here.'}</Text>
          </View>
        ) : (
          filtered.map((b, i) => <BusinessCard key={b.id} b={b} index={i} />)
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: { paddingTop: 58, paddingHorizontal: 22, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.06)', backgroundColor: BG },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting:  { fontSize: 12, color: 'rgba(245,240,232,0.3)', fontWeight: '500', letterSpacing: 0.2, marginBottom: 3 },
  headline:  { fontSize: 30, fontWeight: '700', color: '#F5F0E8', letterSpacing: -0.5 },
  profileBtn:{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: 'rgba(212,175,55,0.08)' },
  searchInput: { flex: 1, color: '#F5F0E8', fontSize: 13, fontWeight: '400' },

  chip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)' },
  chipText: { fontSize: 11, fontWeight: '600', color: 'rgba(245,240,232,0.38)', letterSpacing: 0.3 },

  list:       { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40, gap: 10 },
  listCount:  { fontSize: 11, color: 'rgba(245,240,232,0.25)', fontWeight: '600', letterSpacing: 0.4 },
  listLive:   { fontSize: 11, color: '#4ade80', fontWeight: '700', letterSpacing: 0.3 },

  card:       { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.08)', overflow: 'hidden' },
  cardStripe: { height: 1.5, width: '100%' },
  cardBody:   { flexDirection: 'row', padding: 14, gap: 8, alignItems: 'center' },

  avatar:     { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 18, fontWeight: '800' },

  cardName: { fontSize: 14, fontWeight: '700', color: '#F5F0E8' },
  catTag:   { fontSize: 10, fontWeight: '700' },
  city:     { fontSize: 10, color: 'rgba(245,240,232,0.28)', fontWeight: '400' },

  statText:  { fontSize: 10, fontWeight: '700' },
  statMuted: { fontSize: 10, color: 'rgba(245,240,232,0.3)', fontWeight: '400' },

  joinBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  joinBtnText:{ color: BG, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  closedBadge:{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  closedText: { color: 'rgba(245,240,232,0.22)', fontSize: 10, fontWeight: '600' },

  empty:      { alignItems: 'center', paddingTop: 64, gap: 10 },
  emptyTitle: { color: 'rgba(245,240,232,0.5)', fontSize: 15, fontWeight: '700' },
  emptyBody:  { color: 'rgba(245,240,232,0.25)', fontSize: 12, textAlign: 'center' },
});
