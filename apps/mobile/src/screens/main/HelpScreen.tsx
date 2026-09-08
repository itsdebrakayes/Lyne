/**
 * HelpScreen — the Help & Support centre (content buckets, not a chatbot).
 *
 * Two clear paths: general questions about Lyne (expandable buckets), and
 * "a specific agency?" — a list of the agencies Lyne works with, each
 * leading to its opening hours, required documents and JP requirements.
 * A contact card closes it out.
 */
import React, { useMemo } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import api from '../../lib/apiClient';
import Icon from '../../components/Icon';
import { GENERAL_FAQS, AGENCY_GUIDES } from '../../lib/helpContent';
import { FaqBucket, FaqAnswer } from '../../components/FaqBucket';

const SUPPORT_EMAIL = 'customersupport@uselyne.com';
const SUPPORT_PHONE = '+18760000000';

/** The same section heading Home's rails use, so the two screens read as one
 *  app: 18pt extra, tight tracking, air above it rather than a bordered row. */
const SECTION = {
  fontFamily: font.extra,
  fontSize: 18,
  color: colors.ink,
  letterSpacing: -0.5,
  marginTop: 30,
  marginBottom: 14,
} as const;

export default function HelpScreen() {
  const navigation = useNavigation<any>();
  const topPad = useTopPad(14);

  /* Which of the curated guides are about an agency that is actually on Lyne.
     The guides are a hand-written file, and a hand-written file does not know
     who has signed — so on a build with an empty database this screen listed
     three real government bodies as agencies "Lyne works with" while Home two
     taps away said there were none. The database decides; the file only
     supplies the words. Same query key as Home, so it is one request. */
  const { data: businesses = [] } = useQuery({
    queryKey: ['mobile-businesses'],
    queryFn: () => api.get<Array<{ id: string; slug?: string }>>('/businesses', false),
  });
  const guides = useMemo(() => {
    const live = new Set(businesses.map(b => String(b.slug || '')).filter(Boolean));
    return AGENCY_GUIDES.filter(g => live.has(g.slug));
  }, [businesses]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* The header every pushed screen in the app now uses: a circular back
            button, the title, and one muted line saying what the screen holds.
            This screen still had the older square-bordered button and a 24pt
            title, which is why it read as a different product. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 22 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: -0.5 }}>
              Help &amp; Support
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
              Answers, agencies, and how to reach us
            </Text>
          </View>
        </View>

        {/* general */}
        <Text style={SECTION}>About Lyne</Text>
        {GENERAL_FAQS.map(f => (
          <FaqBucket key={f.q} q={f.q}><FaqAnswer>{f.a}</FaqAnswer></FaqBucket>
        ))}

        {/* agencies — only the ones on Lyne. Nothing at all rather than a
            promise the product cannot keep. */}
        {guides.length > 0 && (
        <>
        <Text style={[SECTION, { marginBottom: 6 }]}>Or, a specific agency?</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, lineHeight: 19, marginBottom: 14 }}>
          Tap an agency for opening hours, the documents each service needs, and whether anything must be stamped by a JP.
        </Text>
        <View style={{ gap: 12 }}>
          {guides.map(a => (
            /* The same row Home uses for "Agencies near you": a 46pt
               surfaceAlt tile carrying the acronym in accent, name, one
               muted line, chevron. It was a dark glass tile here and
               nowhere else. */
            <TouchableOpacity key={a.slug} activeOpacity={0.85} onPress={() => navigation.navigate('AgencyHelp', { slug: a.slug })}
              accessibilityRole="button" accessibilityLabel={a.name}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.surface, borderRadius: 20, padding: 14, ...shadow.card }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: a.short.length >= 5 ? 11.5 : 13.5, color: colors.accent }}>{a.short}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>{a.name}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 3 }}>Hours · documents · JP requirements</Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.chevron} />
            </TouchableOpacity>
          ))}
        </View>
        </>
        )}

        {/* contact */}
        <Text style={SECTION}>Still need help?</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 20, ...shadow.card }}>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, letterSpacing: -0.3 }}>Contact the Lyne team</Text>
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
