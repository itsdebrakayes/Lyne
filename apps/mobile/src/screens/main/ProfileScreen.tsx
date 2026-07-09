import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import api, { supabase } from '../../lib/apiClient';
import { colors, font, shadow, t, categoryTints, initials, inputReset, depthText } from '../../lib/theme';
import { TabBar } from '../../components/TabBar';
import { Sheen } from '../../components/Glass';

type DocKey = 'trn' | 'national_id' | 'phone';

const DOC_SHEET: Record<DocKey, { title: string; hint: string; placeholder: string; keyboard: 'default' | 'phone-pad' | 'number-pad' }> = {
  trn: { title: 'Add your TRN', hint: 'Your 9-digit Tax Registration Number. Agencies use it to verify you faster at the counter.', placeholder: '000-000-000', keyboard: 'number-pad' },
  national_id: { title: 'Add your National ID', hint: 'Your national identification number, kept private and only shown to the agency serving you.', placeholder: 'ID number', keyboard: 'default' },
  phone: { title: 'Add your phone', hint: 'Used for queue updates if push notifications are unavailable.', placeholder: '876-000-0000', keyboard: 'phone-pad' },
};

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress?: () => void; badge?: string };

function ListCard({ rows }: { rows: Row[] }) {
  return (
    <View style={[t.card, { overflow: 'hidden', ...shadow.card }]}>
      {rows.map((r, i) => (
        <TouchableOpacity key={r.label} disabled={!r.onPress} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingHorizontal: 17, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={r.icon} size={17} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{r.label}</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>{r.sub}</Text>
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
  return <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 32, marginBottom: 13, marginLeft: 4 }}>{children}</Text>;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut, refreshProfile } = useAuth();
  const { data: history = [] } = useQuery({ queryKey: ['visit-history-count'], queryFn: () => api.get<Array<{ id: string }>>('/history') });
  const [editingDoc, setEditingDoc] = useState<DocKey | null>(null);
  const [docValue, setDocValue] = useState('');
  const [docSaving, setDocSaving] = useState(false);
  const [docError, setDocError] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const name = user?.full_name || 'Your account';
  const email = user?.email || '—';
  const docs: Array<{ key: string; docKey: DocKey; value?: string; tint: { fg: string; bg: string }; icon: keyof typeof Ionicons.glyphMap; ok: string; missing: string }> = [
    { key: 'TRN', docKey: 'trn', value: user?.trn, tint: categoryTints.blue, icon: 'document-text-outline', ok: 'On file', missing: 'Add TRN' },
    { key: 'National ID', docKey: 'national_id', value: user?.national_id, tint: categoryTints.green, icon: 'card-outline', ok: 'On file', missing: 'Add ID' },
    { key: 'Phone', docKey: 'phone', value: user?.phone, tint: categoryTints.orange, icon: 'call-outline', ok: 'On file', missing: 'Add phone' },
  ];

  const openDocSheet = (docKey: DocKey, current?: string) => {
    setDocValue(current || '');
    setDocError('');
    setEditingDoc(docKey);
  };

  const saveDoc = async () => {
    if (!editingDoc || !docValue.trim()) { setDocError('Enter a value to save.'); return; }
    try {
      setDocSaving(true);
      setDocError('');
      await api.patch('/auth/profile', { [editingDoc]: docValue.trim() });
      await refreshProfile();
      setEditingDoc(null);
    } catch (caught: unknown) {
      setDocError(caught instanceof Error ? caught.message : 'Could not save. Try again.');
    } finally {
      setDocSaving(false);
    }
  };

  const openEmailSheet = () => { setEmailValue(user?.email || ''); setEmailError(''); setEmailSent(false); setEmailOpen(true); };
  const saveEmail = async () => {
    const next = emailValue.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) { setEmailError('Enter a valid email address.'); return; }
    if (next === (user?.email || '').toLowerCase()) { setEmailError('That’s already your email.'); return; }
    try {
      setEmailSaving(true);
      setEmailError('');
      // Supabase sends a confirmation link to the new address; the change only
      // takes effect once it's confirmed, so we surface that instead of a save.
      const { error: updErr } = await supabase.auth.updateUser({ email: next });
      if (updErr) throw updErr;
      setEmailSent(true);
    } catch (caught: unknown) {
      setEmailError(caught instanceof Error ? caught.message : 'Could not update email. Try again.');
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 28 }}>
          <Text style={t.h2}>Account</Text>
        </View>

        {/* profile */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ borderRadius: 44, ...shadow.depth }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', overflow: 'hidden' }}>
              <Sheen radius={44} />
              <Text style={{ fontFamily: font.extra, fontSize: 30, color: '#fff', ...depthText }}>{initials(name)}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: font.extra, fontSize: 21, color: colors.ink, letterSpacing: -0.4, marginTop: 13 }}>{name}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>{email}</Text>
        </View>

        {/* personal details */}
        <SectionLabel>Personal details</SectionLabel>
        <ListCard rows={[
          { icon: 'call-outline', label: 'Phone', sub: user?.phone || 'Not added yet', onPress: () => openDocSheet('phone', user?.phone) },
          { icon: 'mail-outline', label: 'Email', sub: email, onPress: openEmailSheet },
        ]} />

        {/* documents */}
        <SectionLabel>My documents</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {docs.map(d => (
            <TouchableOpacity key={d.key} activeOpacity={0.85} onPress={() => openDocSheet(d.docKey, d.value)} style={[t.card, { flex: 1, padding: 15, borderRadius: 20, ...shadow.card }]}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: d.tint.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 11, overflow: 'hidden' }}>
                <Sheen radius={12} strength={0.6} />
                <Ionicons name={d.icon} size={17} color={d.tint.fg} />
              </View>
              <Text style={{ fontFamily: font.extra, fontSize: 13, color: colors.ink }}>{d.key}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.value ? colors.light : colors.moderate }} />
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>{d.value ? d.ok : d.missing}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* account & activity */}
        <SectionLabel>Account & activity</SectionLabel>
        <ListCard rows={[
          { icon: 'time-outline', label: 'Queue history', sub: `${history.length} ${history.length === 1 ? 'visit' : 'visits'}`, onPress: () => navigation.navigate('History') },
          { icon: 'notifications-outline', label: 'Notifications', sub: 'Queue & peak-hour alerts', onPress: () => navigation.navigate('Notifications') },
          { icon: 'card-outline', label: 'Payment methods', sub: 'Manage cards' },
          { icon: 'shield-checkmark-outline', label: 'Privacy & security', sub: 'Passcode, data' },
          { icon: 'help-circle-outline', label: 'Help & support', sub: 'FAQs, contact us', onPress: () => navigation.navigate('Help') },
        ]} />

        <TouchableOpacity onPress={signOut} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: '#f3d3d5', borderRadius: 18, padding: 15, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.danger }}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
      <TabBar active="Profile" />

      {/* document edit sheet */}
      <Modal visible={!!editingDoc} transparent animationType="slide" onRequestClose={() => setEditingDoc(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => setEditingDoc(null)} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
          {editingDoc && (
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />
              <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>{DOC_SHEET[editingDoc].title}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 }}>{DOC_SHEET[editingDoc].hint}</Text>
              <TextInput
                autoFocus
                value={docValue}
                onChangeText={setDocValue}
                placeholder={DOC_SHEET[editingDoc].placeholder}
                placeholderTextColor={colors.faint}
                keyboardType={DOC_SHEET[editingDoc].keyboard}
                style={[{ backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54, fontFamily: font.semibold, color: colors.ink, fontSize: 15, marginTop: 16 }, inputReset]}
              />
              {!!docError && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 10 }}>{docError}</Text>}
              <View style={{ flexDirection: 'row', gap: 11, marginTop: 18 }}>
                <TouchableOpacity onPress={() => setEditingDoc(null)} style={[t.ghostBtn, { flex: 1, minHeight: 52 }]}>
                  <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={docSaving} onPress={saveDoc} style={[t.primaryBtn, { flex: 1, minHeight: 52 }]}>
                  {docSaving ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* email change sheet */}
      <Modal visible={emailOpen} transparent animationType="slide" onRequestClose={() => setEmailOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => setEmailOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />
            {emailSent ? (
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#e6f7ee', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Ionicons name="mail-unread-outline" size={24} color={colors.light} />
                </View>
                <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4, textAlign: 'center' }}>Confirm your new email</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 8, lineHeight: 19, textAlign: 'center' }}>We sent a confirmation link to {emailValue.trim().toLowerCase()}. Your email updates once you tap it.</Text>
                <TouchableOpacity onPress={() => setEmailOpen(false)} style={[t.primaryBtn, { alignSelf: 'stretch', minHeight: 52, marginTop: 20 }]}>
                  <Text style={t.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>Change email</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 }}>This is your sign-in email. We’ll send a confirmation link to the new address before it changes.</Text>
                <TextInput
                  autoFocus
                  value={emailValue}
                  onChangeText={setEmailValue}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[{ backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, height: 54, fontFamily: font.semibold, color: colors.ink, fontSize: 15, marginTop: 16 }, inputReset]}
                />
                {!!emailError && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 10 }}>{emailError}</Text>}
                <View style={{ flexDirection: 'row', gap: 11, marginTop: 18 }}>
                  <TouchableOpacity onPress={() => setEmailOpen(false)} style={[t.ghostBtn, { flex: 1, minHeight: 52 }]}>
                    <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={emailSaving} onPress={saveEmail} style={[t.primaryBtn, { flex: 1, minHeight: 52 }]}>
                    {emailSaving ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>Send link</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
