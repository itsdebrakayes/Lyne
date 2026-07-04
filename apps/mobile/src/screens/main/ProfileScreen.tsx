import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/apiClient';
import { colors, font, t, categoryTints, initials } from '../../lib/theme';
import { TabBar } from '../../components/TabBar';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress?: () => void; badge?: string };

function ListCard({ rows }: { rows: Row[] }) {
  return (
    <View style={[t.card, { overflow: 'hidden' }]}>
      {rows.map((r, i) => (
        <TouchableOpacity key={r.label} disabled={!r.onPress} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, paddingHorizontal: 16, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={r.icon} size={17} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>{r.label}</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.muted }}>{r.sub}</Text>
          </View>
          {r.badge
            ? <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.extra, fontSize: 11, color: colors.accentInk }}>{r.badge}</Text></View>
            : <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.chevron }}>›</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 10, marginLeft: 4 }}>{children}</Text>;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { data: history = [] } = useQuery({ queryKey: ['visit-history-count'], queryFn: () => api.get<Array<{ id: string }>>('/history') });

  const name = user?.full_name || 'Your account';
  const email = user?.email || '—';
  const docs = [
    { key: 'TRN', value: user?.trn, tint: categoryTints.blue, icon: 'document-text-outline' as const, ok: 'On file', missing: 'Add TRN' },
    { key: 'National ID', value: user?.national_id, tint: categoryTints.green, icon: 'card-outline' as const, ok: 'Verified', missing: 'Add ID' },
    { key: 'Phone', value: user?.phone, tint: categoryTints.orange, icon: 'call-outline' as const, ok: 'On file', missing: 'Add phone' },
  ];

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <Text style={t.h2}>Account</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={t.iconBtn}><Ionicons name="settings-outline" size={18} color={colors.ink} /></TouchableOpacity>
        </View>

        {/* profile */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 30, color: colors.accentInk }}>{initials(name)}</Text>
          </View>
          <Text style={{ fontFamily: font.extra, fontSize: 21, color: colors.ink, letterSpacing: -0.4, marginTop: 13 }}>{name}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>{email}</Text>
        </View>

        {/* personal details */}
        <SectionLabel>Personal details</SectionLabel>
        <ListCard rows={[
          { icon: 'call-outline', label: 'Phone', sub: user?.phone || 'Not added yet' },
          { icon: 'mail-outline', label: 'Email', sub: email },
        ]} />

        {/* documents */}
        <SectionLabel>My documents</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 11 }}>
          {docs.map(d => (
            <View key={d.key} style={[t.card, { flex: 1, padding: 14, borderRadius: 18 }]}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: d.tint.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 11 }}>
                <Ionicons name={d.icon} size={17} color={d.tint.fg} />
              </View>
              <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink }}>{d.key}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.value ? colors.light : colors.moderate }} />
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: colors.muted }}>{d.value ? d.ok : d.missing}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* account & activity */}
        <SectionLabel>Account & activity</SectionLabel>
        <ListCard rows={[
          { icon: 'time-outline', label: 'Queue history', sub: `${history.length} ${history.length === 1 ? 'visit' : 'visits'}`, onPress: () => navigation.navigate('History') },
          { icon: 'notifications-outline', label: 'Notifications', sub: 'Queue & peak-hour alerts', onPress: () => navigation.navigate('Notifications') },
          { icon: 'card-outline', label: 'Payment methods', sub: 'Manage cards' },
          { icon: 'shield-checkmark-outline', label: 'Privacy & security', sub: 'Passcode, data' },
          { icon: 'help-circle-outline', label: 'Help & support', sub: 'FAQs, contact us' },
        ]} />

        <TouchableOpacity onPress={signOut} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: '#f3d3d5', borderRadius: 18, padding: 15, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.danger }}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
      <TabBar active="Profile" />
    </View>
  );
}
