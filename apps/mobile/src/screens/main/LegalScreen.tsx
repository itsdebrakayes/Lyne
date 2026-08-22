/**
 * LegalScreen — the privacy policy and terms, in the app.
 *
 * App Review requires the privacy policy to be reachable from inside the app,
 * not only as a URL in App Store Connect. Both documents live here and share
 * one screen with a segmented switch.
 */
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import { COMPANY, PRIVACY_POLICY, TERMS, type LegalSection } from '../../lib/legalContent';

function Section({ section }: { section: LegalSection }) {
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: colors.ink, marginBottom: 8 }}>{section.heading}</Text>
      {section.body.map((paragraph) => (
        <Text
          key={paragraph}
          style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 21, marginBottom: 10 }}
        >
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

export default function LegalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [tab, setTab] = useState<'privacy' | 'terms'>(route.params?.tab === 'terms' ? 'terms' : 'privacy');
  const sections = tab === 'privacy' ? PRIVACY_POLICY : TERMS;

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={t.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={t.h2}>Legal</Text>
        </View>

        <View
          style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 4, gap: 4 }}
          accessibilityRole="tablist"
        >
          {([['privacy', 'Privacy policy'], ['terms', 'Terms of use']] as const).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 11,
                alignItems: 'center',
                backgroundColor: tab === id ? colors.surface : 'transparent',
                ...(tab === id ? shadow.card : null),
              }}
            >
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: tab === id ? colors.ink : colors.muted }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {sections.map((section) => <Section key={section.heading} section={section} />)}

        <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 28, lineHeight: 18 }}>
          {COMPANY} is responsible for this app and the information described above.
        </Text>
      </ScrollView>
    </View>
  );
}
