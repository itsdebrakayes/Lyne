import React, { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const slides = [
  { icon: 'search-outline', title: 'Find the shortest wait', body: 'Browse nearby businesses and compare live branch wait times before you leave.' },
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
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <TouchableOpacity accessibilityRole="button" onPress={onComplete} style={{ position: 'absolute', right: 24, top: 58, zIndex: 2, padding: 10 }}><Text style={{ color: '#a7a7ad', fontSize: 14, fontWeight: '700' }}>Skip</Text></TouchableOpacity>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setActive(Math.round(event.nativeEvent.contentOffset.x / width))}>
        {slides.map((slide, index) => (
          <View key={slide.title} style={{ width, paddingHorizontal: 28, paddingTop: 130, paddingBottom: 160, justifyContent: 'center' }}>
            <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 36 }}><Ionicons name={slide.icon} size={34} color="#080808" /></View>
            <Text style={{ color: '#77777e', fontSize: 13, fontWeight: '800', marginBottom: 12 }}>0{index + 1} / 0{slides.length}</Text>
            <Text style={{ color: '#fff', fontSize: 42, lineHeight: 47, fontWeight: '900', marginBottom: 20 }}>{slide.title}</Text>
            <Text style={{ color: '#a7a7ad', fontSize: 17, lineHeight: 26, maxWidth: 430 }}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>{slides.map((slide, index) => <View key={slide.title} style={{ width: index === active ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: index === active ? '#fff' : '#343439' }} />)}</View>
        <TouchableOpacity accessibilityRole="button" onPress={next} style={{ minWidth: 132, minHeight: 54, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}><Text style={{ color: '#080808', fontSize: 15, fontWeight: '900' }}>{active === slides.length - 1 ? 'Get started' : 'Continue'}</Text></TouchableOpacity>
      </View>
    </View>
  );
}
