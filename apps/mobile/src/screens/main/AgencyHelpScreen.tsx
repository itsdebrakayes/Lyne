/**
 * AgencyHelpScreen — one agency's help content: opening hours, each service
 * with the documents to bring and whether a Justice of the Peace stamp is
 * needed, plus a "good to know" note. Content buckets, no chatbot.
 */
import React, { useState } from 'react';
import { LayoutAnimation, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import Icon from '../../components/Icon';
import { agencyGuide, AgencyService } from '../../lib/helpContent';
import { FaqBucket, FaqAnswer } from '../../components/FaqBucket';
import { RootStackParamList } from '../../navigation/AppNavigator';

/** The section heading Home's rails use, so Help reads as the same app. */
const SECTION = {
  fontFamily: font.extra,
  fontSize: 18,
  color: colors.ink,
  letterSpacing: -0.5,
  marginTop: 30,
  marginBottom: 14,
} as const;

function ServiceBucket({ service }: { service: AgencyService }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity')); setOpen(o => !o); };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, marginBottom: 10, overflow: 'hidden', ...shadow.card }}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 18 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="briefcase-outline" size={16} color={colors.accentDeep} />
        </View>
        <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 14.5, color: colors.ink, letterSpacing: -0.2 }}>{service.name}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 9 }}>What to bring</Text>
          <View style={{ gap: 8, marginBottom: 14 }}>
            {service.documents.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 9 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.light} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 19 }}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 9, backgroundColor: service.jpRequired ? colors.warnSoft : colors.infoSoft, borderRadius: 14, padding: 12 }}>
            <Ionicons name={service.jpRequired ? 'ribbon' : 'checkmark-done'} size={16} color={service.jpRequired ? colors.moderate : colors.accentDeep} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.sub, lineHeight: 19 }}>
              <Text style={{ fontFamily: font.extra, color: colors.ink }}>{service.jpRequired ? 'JP required. ' : 'No JP needed. '}</Text>
              {service.jp}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AgencyHelpScreen() {
  const navigation = useNavigation<any>();
  const topPad = useTopPad(14);
  const route = useRoute<RouteProp<RootStackParamList, 'AgencyHelp'>>();
  const guide = agencyGuide(route.params?.slug);

  if (!guide) {
    return (
      <View style={[t.root, { alignItems: 'center', justifyContent: 'center', padding: 30 }]}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.muted }}>Agency guide not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[t.primaryBtn, { marginTop: 16, paddingHorizontal: 28 }]}><Text style={t.primaryBtnText}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Circular back, name, one muted line — the header the agency and
            line screens use. The dark glass monogram lived only here. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 22 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>{guide.short}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{guide.name}</Text>
          </View>
        </View>

        {/* hours */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 18, flexDirection: 'row', gap: 13, alignItems: 'flex-start', ...shadow.card }}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={21} color={colors.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Opening hours</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: colors.ink, marginTop: 5 }}>{guide.hours}</Text>
            {!!guide.hoursNote && <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 5 }}>{guide.hoursNote}</Text>}
          </View>
        </View>

        {/* services */}
        <Text style={SECTION}>Services &amp; what to bring</Text>
        {guide.services.map(s => <ServiceBucket key={s.name} service={s} />)}

        {/* good to know */}
        <Text style={SECTION}>Good to know</Text>
        <FaqBucket q="Tips for this agency" defaultOpen><FaqAnswer>{guide.general}</FaqAnswer></FaqBucket>

        <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.faint, lineHeight: 18, marginTop: 16, textAlign: 'center' }}>
          Requirements are a guide and can change. Confirm the latest with {guide.short} before you travel.
        </Text>
      </ScrollView>
    </View>
  );
}
