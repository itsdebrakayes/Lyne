/**
 * HelpScreen — the Help & Support centre (content buckets, not a chatbot).
 *
 * Two clear paths: general questions about Lyne (expandable buckets), and
 * "a specific agency?" — a list of the agencies Lyne works with, each
 * leading to its opening hours, required documents and JP requirements.
 * A contact card closes it out.
 */
import React from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import { GENERAL_FAQS, AGENCY_GUIDES } from '../../lib/helpContent';
import { FaqBucket, FaqAnswer } from '../../components/FaqBucket';
import { Sheen } from '../../components/Glass';

import { SUPPORT_EMAIL } from '../../lib/legalContent';
const SUPPORT_PHONE = '+18760000000';

export default function HelpScreen() {
  const navigation = useNavigation<any>();
  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={t.h2}>Help & Support</Text>
        </View>

        <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: colors.muted, lineHeight: 21, marginBottom: 4 }}>
          Find answers below — start with general questions about Lyne, or jump to a specific agency for hours and what to bring.
        </Text>

        {/* general */}
        <View style={t.sectionRow}><Text style={t.section}>About Lyne</Text></View>
        {GENERAL_FAQS.map(f => (
          <FaqBucket key={f.q} q={f.q}><FaqAnswer>{f.a}</FaqAnswer></FaqBucket>
        ))}

        {/* agencies */}
        <View style={[t.sectionRow, { marginBottom: 6 }]}><Text style={t.section}>Or, a specific agency?</Text></View>
        <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, lineHeight: 19, marginBottom: 14 }}>
          Tap an agency for opening hours, the documents each service needs, and whether anything must be stamped by a JP.
        </Text>
        <View style={{ gap: 12 }}>
          {AGENCY_GUIDES.map(a => (
            <TouchableOpacity key={a.slug} activeOpacity={0.85} onPress={() => navigation.navigate('AgencyHelp', { slug: a.slug })} style={[t.listRow, { ...shadow.card }]}>
              <View style={{ borderRadius: 15, ...shadow.depth }}>
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Sheen radius={15} />
                  <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.accent }}>{a.short}</Text>
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink, letterSpacing: -0.2 }}>{a.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>Hours · documents · JP requirements</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.chevron} />
            </TouchableOpacity>
          ))}
        </View>

        {/* contact */}
        <View style={t.sectionRow}><Text style={t.section}>Still need help?</Text></View>
        <View style={[t.card, { padding: 18, ...shadow.card }]}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>Contact the Lyne team</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, lineHeight: 19, marginTop: 5 }}>We reply Monday–Friday, 9:00 AM – 5:00 PM.</Text>
          <View style={{ flexDirection: 'row', gap: 11, marginTop: 16 }}>
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={[t.primaryBtn, { flex: 1, minHeight: 50 }]}>
              <Ionicons name="mail-outline" size={16} color={colors.onDark} />
              <Text style={[t.primaryBtnText, { marginLeft: 8 }]}>Email us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)} style={[t.ghostBtn, { flex: 1, minHeight: 50 }]}>
              <Ionicons name="call-outline" size={16} color={colors.ink} />
              <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink, marginLeft: 8 }}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
