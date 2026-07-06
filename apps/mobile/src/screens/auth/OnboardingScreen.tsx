import React, { useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../lib/theme';

const slides = [
  { icon: 'search-outline', title: 'Find the shortest wait', body: 'Browse nearby agencies and compare live branch wait times before you leave home.' },
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
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      <TouchableOpacity accessibilityRole="button" onPress={onComplete} style={{ position: 'absolute', right: 24, top: 58, zIndex: 2, padding: 10 }}>
        <Text style={{ color: 'rgba(255,255,255,.7)', fontFamily: font.bold, fontSize: 14 }}>Skip</Text>
      </TouchableOpacity>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setActive(Math.round(event.nativeEvent.contentOffset.x / width))}>
        {slides.map((slide, index) => (
          <View key={slide.title} style={{ width, paddingHorizontal: 28, paddingTop: 140, paddingBottom: 170, justifyContent: 'center' }}>
            <View style={{ width: 82, height: 82, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 40 }}>
              <Ionicons name={slide.icon} size={38} color={colors.accentInk} />
            </View>
            <Text style={{ color: 'rgba(255,255,255,.6)', fontFamily: font.extra, fontSize: 13, marginBottom: 14, letterSpacing: 1 }}>0{index + 1} / 0{slides.length}</Text>
            <Text style={{ color: '#fff', fontFamily: font.extra, fontSize: 40, lineHeight: 45, marginBottom: 20, letterSpacing: -1 }}>{slide.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,.75)', fontFamily: font.medium, fontSize: 17, lineHeight: 26, maxWidth: 430 }}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 7 }}>
          {slides.map((slide, index) => <View key={slide.title} style={{ width: index === active ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: index === active ? colors.accent : 'rgba(255,255,255,.28)' }} />)}
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={next} style={{ minWidth: 138, minHeight: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}>
          <Text style={{ color: colors.accentInk, fontFamily: font.extra, fontSize: 15 }}>{active === slides.length - 1 ? 'Get started' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
