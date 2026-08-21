import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import api, { supabase } from '../../lib/apiClient';
import { colors, font, shadow, t, personInitials, inputReset, depthText } from '../../lib/theme';
import Icon, { IconName } from '../../components/Icon';
import { useTopPad } from '../../lib/insets';
import { TabBar } from '../../components/TabBar';
import { Sheen } from '../../components/Glass';
import { useTheme, ThemeMode } from '../../lib/ThemeProvider';
import { paymentsConfigured } from '../../lib/stripe';
import { isDemoBuild } from '../../lib/sectorTerms';
import { getPremiumPreview, setPremiumPreview } from '../../lib/premiumPreview';

type DocKey = 'trn' | 'national_id' | 'phone';

const DOC_SHEET: Record<DocKey, { title: string; hint: string; placeholder: string; keyboard: 'default' | 'phone-pad' | 'number-pad' }> = {
  trn: { title: 'Add your TRN', hint: 'Your 9-digit Tax Registration Number. Agencies use it to verify you faster at the counter.', placeholder: '000-000-000', keyboard: 'number-pad' },
  national_id: { title: 'Add your National ID', hint: 'Your national identification number, kept private and only shown to the agency serving you.', placeholder: 'ID number', keyboard: 'default' },
  phone: { title: 'Add your phone', hint: 'Used for queue updates if push notifications are unavailable.', placeholder: '876-000-0000', keyboard: 'phone-pad' },
};

type Row = { icon: IconName; label: string; sub: string; onPress?: () => void; badge?: string };

function ListCard({ rows }: { rows: Row[] }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 22, overflow: 'hidden', ...shadow.card }}>
      {rows.map((r, i) => (
        <TouchableOpacity
          key={r.label}
          disabled={!r.onPress}
          onPress={r.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${r.label}. ${r.sub}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, paddingHorizontal: 17, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={r.icon} size={20} color={colors.ink} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: colors.ink, letterSpacing: -0.3 }}>{r.label}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 3 }}>{r.sub}</Text>
          </View>
          {r.badge
            ? <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.accentInk }}>{r.badge}</Text></View>
            : <Icon name="chevronRight" size={18} color={colors.chevron} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 30, marginBottom: 13, marginLeft: 4 }}>{children}</Text>;
}

export default function ProfileScreen() {
  const topPad = useTopPad(24);
  const navigation = useNavigation<any>();
  const { user, signOut, refreshProfile } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [premiumPreview, setPremiumPreviewState] = useState(false);
  useEffect(() => { getPremiumPreview().then(setPremiumPreviewState); }, []);
  const togglePremiumPreview = (on: boolean) => { setPremiumPreviewState(on); setPremiumPreview(on).catch(() => {}); };
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const name = user?.full_name || 'Your account';
  const email = user?.email || '—';
  // v5 is one blue and neutrals, so the old per-category pastels (blue TRN,
  // green ID) are gone — two documents are not two categories, and the colour
  // was carrying no meaning.
  const docs: Array<{ key: string; docKey: DocKey; value?: string; icon: IconName; ok: string; missing: string }> = [
    // Phone is a contact detail, not a document — it already has its own row
    // under Personal Details, and listing it twice under two different
    // labels ("Not added yet" / "Add phone") read as two separate things.
    { key: 'TRN', docKey: 'trn', value: user?.trn, icon: 'document', ok: 'On file', missing: 'Add TRN' },
    { key: 'National ID', docKey: 'national_id', value: user?.national_id, icon: 'financial', ok: 'On file', missing: 'Add ID' },
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

  // Deletion is permanent and immediate, so it is gated on typing the word
  // rather than on a single tap — the same bar the rest of the industry uses for
  // actions that cannot be undone.
  const deleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE to confirm.');
      return;
    }
    try {
      setDeleting(true);
      setDeleteError('');
      await api.delete('/auth/account');
      setDeleteOpen(false);
      // Sign out locally so the app cannot keep acting as an account that no
      // longer exists on the server.
      await signOut();
    } catch (caught: unknown) {
      setDeleteError(caught instanceof Error ? caught.message : 'Could not delete your account. Nothing was removed.');
    } finally {
      setDeleting(false);
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
      <ScrollView contentContainerStyle={[t.content, { paddingTop: topPad }]} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 28 }}>
          <Text style={t.h2}>Account</Text>
        </View>

        {/* profile */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ borderRadius: 44, ...shadow.depth }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', overflow: 'hidden' }}>
              <Sheen radius={44} />
              <Text style={{ fontFamily: font.extra, fontSize: 30, color: '#fff', ...depthText }}>{personInitials(name)}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: font.extra, fontSize: 21, color: colors.ink, letterSpacing: -0.4, marginTop: 13 }}>{name}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>{email}</Text>
        </View>

        {/* personal details */}
        <SectionLabel>Personal details</SectionLabel>
        <ListCard rows={[
          { icon: 'phone', label: 'Phone', sub: user?.phone || 'Not added yet', onPress: () => openDocSheet('phone', user?.phone) },
          { icon: 'mail', label: 'Email', sub: email, onPress: openEmailSheet },
        ]} />

        {/* documents */}
        <SectionLabel>My documents</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {docs.map(d => (
            <TouchableOpacity
              key={d.key}
              activeOpacity={0.85}
              onPress={() => d.docKey === 'phone' ? openDocSheet('phone', user?.phone) : navigation.navigate('DocumentCapture', { field: d.docKey as 'national_id' | 'trn' })}
              style={[t.card, { flex: 1, padding: 15, borderRadius: 20, ...shadow.card }]}
            >
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: d.value ? colors.infoSoft : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden' }}>
                <Sheen radius={14} strength={0.6} />
                <Icon name={d.icon} size={20} color={d.value ? colors.accent : colors.muted} />
              </View>
              <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>{d.key}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: d.value ? colors.light : colors.moderate }} />
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted }}>{d.value ? d.ok : d.missing}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* add another document — grayed placeholder for extra doc types */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => Alert.alert('More document types coming', 'Passport and driver’s licence capture — with secure, Face ID-protected storage — are on the way. For now you can add your National ID and TRN above.')}
          style={{ marginTop: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surfaceAlt, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name="plus" size={19} color={colors.muted} />
          <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.muted }}>Add another document</Text>
        </TouchableOpacity>

        {/* account & activity */}
        <SectionLabel>Account & activity</SectionLabel>
        <ListCard rows={[
          { icon: 'clock', label: 'Queue history', sub: `${history.length} ${history.length === 1 ? 'visit' : 'visits'}`, onPress: () => navigation.navigate('History') },
          { icon: 'bell', label: 'Notifications', sub: 'Queue & peak-hour alerts', onPress: () => navigation.navigate('Notifications') },
          { icon: 'appearance', label: 'Appearance', sub: themeMode === 'system' ? 'System default' : themeMode === 'dark' ? 'Dark' : 'Light', onPress: () => setAppearanceOpen(true) },
          { icon: 'financial', label: 'Payment methods', sub: 'Manage cards', onPress: () => navigation.navigate('PaymentMethods') },
          { icon: 'shield', label: 'Privacy & security', sub: 'App lock, sessions, data', onPress: () => navigation.navigate('PrivacySecurity') },
          { icon: 'help', label: 'Help & support', sub: 'FAQs, contact us', onPress: () => navigation.navigate('Help') },
        ]} />

        {/* Demo-only. Gated on the release flag, not on payments being
            unconfigured — see isDemoBuild(). */}
        {isDemoBuild() && !paymentsConfigured() && (
          <>
            <SectionLabel>Demo controls</SectionLabel>
            <View style={[t.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, ...shadow.card }]}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="eye-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Preview Premium</Text>
                <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>Toggle to demo the free vs premium experience</Text>
              </View>
              <Switch value={premiumPreview} onValueChange={togglePremiumPreview} trackColor={{ true: colors.accent, false: colors.border }} />
            </View>
          </>
        )}

        <TouchableOpacity onPress={signOut} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>Log out</Text>
        </TouchableOpacity>

        {/* Danger zone. Deliberately last, visually separated, and worded so the
            consequence is unmissable BEFORE the sheet opens — someone should
            never reach the confirmation unsure of what it does. */}
        <SectionLabel>Delete account</SectionLabel>
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.sub, lineHeight: 19 }}>
            Deleting your account is permanent. We erase your profile, your saved agencies, your visit history,
            your notifications, your saved cards, and every document you scanned — including any TRN, National ID
            or passport details we hold. Any line you are currently in is given up.
          </Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.sub, lineHeight: 19, marginTop: 10 }}>
            Agencies keep an anonymous record that a visit happened, for their own service statistics. It carries
            nothing that identifies you.
          </Text>
          <TouchableOpacity
            onPress={() => { setDeleteConfirm(''); setDeleteError(''); setDeleteOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Delete my account permanently"
            style={{ backgroundColor: colors.dangerSoft, borderRadius: 15, paddingVertical: 15, alignItems: 'center', marginTop: 16 }}
          >
            <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.danger }}>Delete my account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <TabBar active="Profile" />

      {/* delete confirmation */}
      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => !deleting && setDeleteOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(6,12,20,.55)' }} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 21, color: colors.ink, letterSpacing: -0.5 }}>Delete your account?</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, marginTop: 10, lineHeight: 20 }}>
              This cannot be undone. Everything listed above is erased straight away, and you will be signed out.
              To confirm, type <Text style={{ fontFamily: font.extra, color: colors.ink }}>DELETE</Text> below.
            </Text>
            <TextInput
              value={deleteConfirm}
              onChangeText={(v) => { setDeleteConfirm(v); if (deleteError) setDeleteError(''); }}
              placeholder="DELETE"
              placeholderTextColor={colors.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[{ backgroundColor: colors.fieldBg, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, marginTop: 18, fontFamily: font.extra, fontSize: 16, color: colors.ink, letterSpacing: 2 }, inputReset]}
            />
            {!!deleteError && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 10 }}>{deleteError}</Text>}
            <TouchableOpacity
              onPress={deleteAccount}
              disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
              style={{ backgroundColor: colors.danger, borderRadius: 17, paddingVertical: 17, alignItems: 'center', marginTop: 18, opacity: deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE' ? 0.45 : 1 }}
            >
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>Delete everything</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDeleteOpen(false)} disabled={deleting} style={{ paddingVertical: 15, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: colors.ink }}>Keep my account</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon name="mail" size={26} color={colors.light} />
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

      {/* appearance picker */}
      <Modal visible={appearanceOpen} transparent animationType="slide" onRequestClose={() => setAppearanceOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => setAppearanceOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>Appearance</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 6 }}>Choose how QMe Now looks. “System” follows your phone.</Text>
            <View style={{ marginTop: 16, gap: 10 }}>
              {([
                { key: 'system', label: 'System default', icon: 'phone-portrait-outline' },
                { key: 'light', label: 'Light', icon: 'sunny-outline' },
                { key: 'dark', label: 'Dark', icon: 'moon-outline' },
              ] as Array<{ key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }>).map(o => {
                const sel = themeMode === o.key;
                return (
                  <TouchableOpacity key={o.key} activeOpacity={0.85} onPress={() => setThemeMode(o.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16, borderWidth: 1.5, borderColor: sel ? colors.accent : colors.border, backgroundColor: sel ? colors.fieldBg : colors.surface }}>
                    <Ionicons name={o.icon} size={19} color={sel ? colors.accentDeep : colors.ink} />
                    <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: colors.ink }}>{o.label}</Text>
                    {sel && <Icon name="check" size={21} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
