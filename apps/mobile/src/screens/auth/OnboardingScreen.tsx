/**
 * QMe Now Mobile — Luxury Onboarding
 * OLED Black · Bodoni Moda · Gold accents · Large serif numbers
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width: W, height: H } = Dimensions.get('window');
const GOLD = '#CA8A04';
const GOLD_LIGHT = '#D4AF37';
const BG = '#080706';

const SLIDES = [
  { num: '01', title: 'Find Any\nQueue', body: 'Search for businesses near you or scan a QR code. Your digital ticket is issued in seconds — no account needed.', accent: GOLD },
  { num: '02', title: "Join.\nDon't Wait.", body: 'Select your service and receive your number instantly. Browse, shop, or relax nearby — we track your place.', accent: GOLD_LIGHT },
  { num: '03', title: 'Walk In\nOn Time.', body: 'We notify you at precisely the right moment. Arrive when it counts. Never stand in line again.', accent: '#F5C518' },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActive(idx);
  };

  const goNext = () => {
    if (active < SLIDES.length - 1) scrollRef.current?.scrollTo({ x: (active + 1) * W, animated: true });
    else navigation.replace('Main');
  };

  const slide = SLIDES[active];

  return (
    <View style={s.root}>
      {/* Background ambient lines */}
      <View style={s.ambientLines} pointerEvents="none">
        {[0.25, 0.5, 0.75].map(pos => (
          <View key={pos} style={[s.ambientLine, { top: H * pos }]} />
        ))}
      </View>

      {/* Skip */}
      <TouchableOpacity style={s.skip} onPress={() => navigation.replace('Main')} activeOpacity={0.7}>
        <Text style={s.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll} style={{ flex: 1 }} scrollEventThrottle={16}>
        {SLIDES.map((sl, i) => (
          <Animated.View key={i} style={[s.slide, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Giant serif number */}
            <Text style={[s.bigNum, { color: sl.accent }]}>{sl.num}</Text>

            {/* Gold line accent */}
            <View style={[s.accentLine, { backgroundColor: sl.accent }]} />

            <Text style={s.title}>{sl.title}</Text>
            <Text style={s.body}>{sl.body}</Text>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        {/* Dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, { width: i === active ? 24 : 6, backgroundColor: i === active ? slide.accent : 'rgba(245,240,232,0.15)' }]} />
          ))}
        </View>

        {/* Next/Start button */}
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: slide.accent }]} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.nextBtnText}>
            {active === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: BG },
  ambientLines:{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  ambientLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(212,175,55,0.04)' },
  skip:        { position: 'absolute', top: 60, right: 28, zIndex: 10 },
  skipText:    { fontSize: 11, fontWeight: '600', color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', letterSpacing: 2 },

  slide: {
    width: W,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 44,
    paddingTop: 100,
  },

  bigNum: {
    fontSize: 120,
    fontWeight: '700',
    lineHeight: 120,
    letterSpacing: -4,
    opacity: 0.12,
    position: 'absolute',
    top: 60,
    right: 24,
  },

  accentLine: {
    width: 32,
    height: 2,
    marginBottom: 28,
  },

  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#F5F0E8',
    lineHeight: 54,
    letterSpacing: -1,
    marginBottom: 20,
  },

  body: {
    fontSize: 16,
    fontWeight: '300',
    color: 'rgba(245,240,232,0.45)',
    lineHeight: 26,
    maxWidth: 300,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingBottom: 52,
    paddingTop: 20,
  },

  dots: { flexDirection: 'row', gap: 6 },
  dot:  { height: 6, borderRadius: 3 },

  nextBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  nextBtnText: { fontSize: 13, fontWeight: '700', color: BG, textTransform: 'uppercase', letterSpacing: 2 },
});
