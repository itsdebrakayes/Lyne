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
import { agencyGuide, AgencyService } from '../../lib/helpContent';
import { FaqBucket, FaqAnswer } from '../../components/FaqBucket';
import { Sheen } from '../../components/Glass';
import { RootStackParamList } from '../../navigation/AppNavigator';

function ServiceBucket({ service }: { service: AgencyService }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity')); setOpen(o => !o); };
  return (
    <View style={[t.card, { marginBottom: 10, overflow: 'hidden', ...shadow.card }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="briefcase-outline" size={16} color={colors.accentDeep} />
        </View>
        <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14.5, color: colors.ink }}>{service.name}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </TouchableOpacity>
      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 9 }}>What to bring</Text>
          <View style={{ gap: 8, marginBottom: 14 }}>
            {service.documents.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 9 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.light} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 19 }}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 9, backgroundColor: service.jpRequired ? '#fdf3e7' : '#eef8fb', borderRadius: 14, padding: 12 }}>
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
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <View style={{ borderRadius: 13, ...shadow.depth }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Sheen radius={13} />
              <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.accent }}>{guide.short}</Text>
            </View>
          </View>
          <Text numberOfLines={2} style={{ flex: 1, fontFamily: font.extra, fontSize: 18, color: colors.ink, letterSpacing: -0.3, lineHeight: 22 }}>{guide.name}</Text>
        </View>

        {/* hours */}
        <View style={[t.cardLg, { padding: 18, flexDirection: 'row', gap: 13, alignItems: 'flex-start' }]}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: '#eef8fb', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={21} color={colors.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Opening hours</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: colors.ink, marginTop: 5 }}>{guide.hours}</Text>
            {!!guide.hoursNote && <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 5 }}>{guide.hoursNote}</Text>}
          </View>
        </View>

        {/* services */}
        <View style={t.sectionRow}><Text style={t.section}>Services & what to bring</Text></View>
        {guide.services.map(s => <ServiceBucket key={s.name} service={s} />)}

        {/* good to know */}
        <View style={t.sectionRow}><Text style={t.section}>Good to know</Text></View>
        <FaqBucket q="Tips for this agency" defaultOpen><FaqAnswer>{guide.general}</FaqAnswer></FaqBucket>

        <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.faint, lineHeight: 18, marginTop: 16, textAlign: 'center' }}>
          Requirements are a guide and can change. Confirm the latest with {guide.short} before you travel.
        </Text>
      </ScrollView>
    </View>
  );
}
