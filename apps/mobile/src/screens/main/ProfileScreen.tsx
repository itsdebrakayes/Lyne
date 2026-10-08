import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../hooks/useAuth';
import { getDocument, setDocument } from '../../lib/documentVault';
import { PREMIUM_ENABLED } from '../../lib/features';
import api, { supabase } from '../../lib/apiClient';
import { colors, font, shadow, t, personInitials, inputReset, TAB_BAR_CLEARANCE } from '../../lib/theme';
import Constants from 'expo-constants';

const appVersion = Constants.expoConfig?.version || '';
import Icon, { IconName } from '../../components/Icon';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import { TabBar } from '../../components/TabBar';
import { useTheme, ThemeMode } from '../../lib/ThemeProvider';
import { useContentColumn } from '../../lib/stage';

type DocKey = 'trn' | 'national_id' | 'phone';

const DOC_SHEET: Record<DocKey, { title: string; hint: string; placeholder: string; keyboard: 'default' | 'phone-pad' | 'number-pad' }> = {
  trn: { title: 'Add your TRN', hint: 'Your 9-digit Tax Registration Number. Agencies use it to verify you faster at the counter.', placeholder: '000-000-000', keyboard: 'number-pad' },
  national_id: { title: 'Add your National ID', hint: 'Your national identification number, kept private and only shown to the agency serving you.', placeholder: 'ID number', keyboard: 'default' },
  phone: { title: 'Add your phone', hint: 'Used for queue updates if push notifications are unavailable.', placeholder: '876-000-0000', keyboard: 'phone-pad' },
};

/* App Screens Refresh 1d: the grouped-list pattern most apps use. A row is an
   icon, a label, and on the right its current value and a chevron. */
type Row = { icon: IconName; label: string; value?: string; valueTone?: 'muted' | 'accent'; dot?: boolean; onPress?: () => void };

function Group({ title, rows }: { title?: string; rows: Row[] }) {
  return (
    <View>
      {title ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.sub, marginTop: 24, marginBottom: 8, marginLeft: 16 }}>{title}</Text> : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <TouchableOpacity
            key={r.label}
            disabled={!r.onPress}
            onPress={r.onPress}
            accessibilityRole="button"
            accessibilityLabel={r.value ? `${r.label}, ${r.value}` : r.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, minHeight: 50 }}
          >
            <Icon name={r.icon} size={19} color={colors.sub} />
            <View style={{ flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 16, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}>
              <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.ink }}>{r.label}</Text>
              {r.dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light }} /> : null}
              {r.value ? (
                <Text numberOfLines={1} style={{ maxWidth: 170, fontFamily: font.medium, fontSize: 15, color: r.valueTone === 'accent' ? colors.accent : colors.muted }}>{r.value}</Text>
              ) : null}
              {r.onPress ? <Icon name="chevronRight" size={16} color={colors.chevron} /> : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const column = useContentColumn();
  const topPad = useTopPad(24);
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const { user, signOut, refreshProfile } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
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

  const [notifState, setNotifState] = useState<'On' | 'Off'>('Off');
  const [emailVerified, setEmailVerified] = useState(false);
  useFocusEffect(useCallback(() => {
    Notifications.getPermissionsAsync().then(p => setNotifState(p.granted ? 'On' : 'Off')).catch(() => {});
    supabase.auth.getSession().then(({ data }) => setEmailVerified(Boolean(data.session?.user?.email_confirmed_at))).catch(() => {});
  }, []));

  const name = user?.full_name || 'Your account';
  const email = user?.email || '—';
  // v5 is one blue and neutrals, so the old per-category pastels (blue TRN,
  // green ID) are gone — two documents are not two categories, and the colour
  // was carrying no meaning.
  /* Read from the keychain, not from the profile. user.trn / user.national_id
     are always empty — the API refuses those fields on purpose — so this row
     said "Add TRN" no matter how many times somebody saved one. */
  const [vaultDocs, setVaultDocs] = useState<{ trn?: string; national_id?: string }>({});
  const loadVault = useCallback(async () => {
    const [trn, national_id] = await Promise.all([getDocument('trn'), getDocument('national_id')]);
    setVaultDocs({ trn: trn || undefined, national_id: national_id || undefined });
  }, []);
  useFocusEffect(useCallback(() => { loadVault(); }, [loadVault]));

  const docs: Array<{ key: string; docKey: DocKey; value?: string; icon: IconName; ok: string; missing: string }> = [
    // Phone is a contact detail, not a document — it already has its own row
    // under Personal Details, and listing it twice under two different
    // labels ("Not added yet" / "Add phone") read as two separate things.
    { key: 'TRN', docKey: 'trn', value: vaultDocs.trn, icon: 'document', ok: 'On file', missing: 'Add TRN' },
    { key: 'National ID', docKey: 'national_id', value: vaultDocs.national_id, icon: 'financial', ok: 'On file', missing: 'Add ID' },
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
      if (editingDoc === 'phone') {
        await api.patch('/auth/profile', { phone: docValue.trim() });
        await refreshProfile();
      } else {
        // Identification never goes to the server — see lib/documentVault.ts.
        await setDocument(editingDoc, docValue.trim());
        await loadVault();
      }
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
      <ScrollView contentContainerStyle={[{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: TAB_BAR_CLEARANCE + lift }, column]} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 32, letterSpacing: -0.8, lineHeight: 35, color: colors.ink }}>Settings</Text>

        {/* profile */}
        <TouchableOpacity onPress={openEmailSheet} accessibilityRole="button" accessibilityLabel={`${name}, ${email}`}
          style={{ marginTop: 20, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 18, color: '#fff' }}>{personInitials(name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 17, color: colors.ink }}>{name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted, marginTop: 2 }}>{email}</Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.chevron} />
        </TouchableOpacity>

        {/* premium */}
        {PREMIUM_ENABLED && (
          <TouchableOpacity onPress={() => navigation.navigate('Premium')} accessibilityRole="button"
            style={{ marginTop: 12, backgroundColor: colors.dark, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 15, color: '#fff' }}>Lyne Premium</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
                {Number(user?.is_premium || 0) ? 'Active. Manage your plan or restore it' : 'Busy-hour forecasts and Line Helper'}
              </Text>
            </View>
            <View style={{ height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.dark }}>{Number(user?.is_premium || 0) ? 'Manage' : 'Try free'}</Text>
            </View>
          </TouchableOpacity>
        )}

        <Group title="Personal details" rows={[
          { icon: 'phone', label: 'Phone', value: user?.phone || 'Add', valueTone: user?.phone ? 'muted' : 'accent', onPress: () => openDocSheet('phone', user?.phone) },
          { icon: 'mail', label: 'Email', value: emailVerified ? 'Verified' : 'Unverified', onPress: openEmailSheet },
        ]} />

        <Group title="Documents" rows={docs.map(d => ({
          icon: d.icon, label: d.key, value: d.value ? 'On file' : 'Add', valueTone: d.value ? 'muted' as const : 'accent' as const, dot: Boolean(d.value),
          onPress: () => navigation.navigate('DocumentCapture', { field: d.docKey as 'national_id' | 'trn' }),
        }))} />

        <Group title="App" rows={[
          { icon: 'bell', label: 'Notifications', value: notifState, onPress: () => navigation.navigate('Notifications') },
          { icon: 'appearance', label: 'Appearance', value: themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light', onPress: () => setAppearanceOpen(true) },
          { icon: 'shield', label: 'Privacy and security', onPress: () => navigation.navigate('PrivacySecurity') },
          { icon: 'clock', label: 'Queue history', value: `${history.length} ${history.length === 1 ? 'visit' : 'visits'}`, onPress: () => navigation.navigate('History') },
        ]} />

        {/* Both stores require the privacy policy to be readable inside the app. */}
        <Group title="Support" rows={[
          { icon: 'help', label: 'Help and support', onPress: () => navigation.navigate('Help') },
          { icon: 'document', label: 'Privacy policy and terms', onPress: () => navigation.navigate('Legal') },
        ]} />

        {/* Log out and Delete account: last, in red, and Delete opens a sheet
            that says exactly what goes before anything is removed. */}
        <View style={{ marginTop: 24, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden' }}>
          <TouchableOpacity onPress={signOut} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, minHeight: 50 }}>
            <Ionicons name="log-out-outline" size={19} color={colors.dangerInk} />
            <View style={{ flex: 1, minHeight: 50, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
              <Text style={{ fontFamily: font.medium, fontSize: 15, color: colors.dangerInk }}>Log out</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setDeleteConfirm(''); setDeleteError(''); setDeleteOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityHint="Opens a confirmation. Deletion is permanent."
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, minHeight: 50 }}
          >
            <Ionicons name="trash-outline" size={19} color={colors.dangerInk} />
            <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.dangerInk }}>Delete account</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', fontFamily: font.medium, fontSize: 12, color: colors.faint, marginTop: 16 }}>Lyne {appVersion}</Text>
      </ScrollView>
      <TabBar active="Profile" />

      {/* delete confirmation */}
      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => !deleting && setDeleteOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(6,12,20,.55)' }} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 + lift }}>
            <Text style={{ fontFamily: font.extra, fontSize: 21, color: colors.ink, letterSpacing: -0.5 }}>Delete your account?</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, marginTop: 10, lineHeight: 20 }}>
              This cannot be undone. We erase your profile, saved agencies, visit history, notifications, and any
              document you scanned, including TRN, National ID or passport details, and you are signed out. Agencies
              keep an anonymous record that a visit happened, with nothing that identifies you.
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
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 + lift }}>
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
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 + lift }}>
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
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 + lift }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />
            <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>Appearance</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 6 }}>Choose how Lyne looks. “System” follows your phone.</Text>
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
