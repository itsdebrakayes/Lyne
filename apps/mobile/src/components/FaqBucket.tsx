/**
 * FaqBucket — a tap-to-expand content bucket (accordion row) for the Help
 * centre. Question/label on top; answer/body reveals below on tap.
 */
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow } from '../lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function FaqBucket({ q, children, defaultOpen = false }: { q: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setOpen(o => !o);
  };
  return (
    /* Borderless, radius 20, carried by shadow — the card the rest of the app
       settled on. The hairline-bordered 22 was the older language and it made
       Help read like a screen from a different product. */
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, marginBottom: 10, overflow: 'hidden', ...shadow.card }}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, paddingHorizontal: 18 }}>
        <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 14.5, color: colors.ink, lineHeight: 20, letterSpacing: -0.2 }}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18, marginTop: -3 }}>{children}</View>
      )}
    </View>
  );
}

/** Plain answer text for a FaqBucket. */
export function FaqAnswer({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 20 }}>{children}</Text>;
}
