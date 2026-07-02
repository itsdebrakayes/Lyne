import React, { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { brandGradient } from '../../lib/mobileV3Styles';

const slides = [
  { icon: 'search-outline', title: 'Find the shortest wait', body: 'Browse nearby businesses and compare live branch wait times before you leave home.' },
  { icon: 'ticket-outline', title: 'Join from anywhere', body: 'Choose a service, take your place in line, and carry your secure ticket on your phone.' },
  { icon: 'navigate-outline', title: 'Arrive right on time', body: 'Live updates and departure reminders help you reach the branch when your turn is close.' },
] as const;

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [active, setActive] = useState(0);
  const next = () => {
    if (active === slides.length - 1) return onComplete();
    scrollRef.current?.scrollTo({ x: (active + 1) * width, animated: true });
  };

  return (
    <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ flex: 1 }}>
      <TouchableOpacity accessibilityRole="button" onPress={onComplete} style={{ position: 'absolute', right: 24, top: 58, zIndex: 2, padding: 10 }}><Text style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, fontWeight: '700' }}>Skip</Text></TouchableOpacity>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setActive(Math.round(event.nativeEvent.contentOffset.x / width))}>
        {slides.map((slide, index) => (
          <View key={slide.title} style={{ width, paddingHorizontal: 28, paddingTop: 140, paddingBottom: 170, justifyContent: 'center' }}>
            <View style={{ width: 82, height: 82, borderRadius: 26, backgroundColor: 'rgba(255,255,255,.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}><Ionicons name={slide.icon} size={38} color="#fff" /></View>
            <Text style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, fontWeight: '800', marginBottom: 14, letterSpacing: 1 }}>0{index + 1} / 0{slides.length}</Text>
            <Text style={{ color: '#fff', fontSize: 42, lineHeight: 47, fontWeight: '900', marginBottom: 20, letterSpacing: -1 }}>{slide.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 17, lineHeight: 26, maxWidth: 430 }}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>{slides.map((slide, index) => <View key={slide.title} style={{ width: index === active ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: index === active ? '#fff' : 'rgba(255,255,255,.35)' }} />)}</View>
        <TouchableOpacity accessibilityRole="button" onPress={next} style={{ minWidth: 138, minHeight: 56, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}><Text style={{ color: '#6b4eff', fontSize: 15, fontWeight: '900' }}>{active === slides.length - 1 ? 'Get started' : 'Continue'}</Text></TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
