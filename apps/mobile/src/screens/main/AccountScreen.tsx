/**
 * AccountScreen — everything about the account itself, opened from the name card
 * at the top of Settings.
 *
 * Name: changes at once. Email: Supabase sends a 6-digit code to the new address
 * (and, when Secure Email Change is on, one to the current address too); the
 * change happens only when the codes check out. Password: the current password
 * proves it is you, or a code sent to your email does instead (the only way for
 * someone who signed in with Apple or Google and never set one). Either way every
 * other device is signed out.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api, { supabase } from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { colors, font, inputReset, personInitials, t } from '../../lib/theme';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import { useContentColumn } from '../../lib/stage';
import { PasswordReset } from '../../components/PasswordReset';
import { SettingsGroup, SettingsHeader } from '../../components/SettingsGroup';
import { confirmSignOutEverywhere, downloadMyData } from '../../lib/accountActions';

type Sheet = null | 'name' | 'email' | 'password' | 'passwordByCode' | 'phone';

const message = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message) || fallback;

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const topPad = useTopPad(24);
  const lift = useNavBarLift();
  const column = useContentColumn();
  const { user, refreshProfile, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [authEmail, setAuthEmail] = useState('');

  // Name / phone
  const [text, setText] = useState('');
  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailStep, setEmailStep] = useState<'enter' | 'codeNew' | 'codeCurrent'>('enter');
  const [code, setCode] = useState('');
  // Password change
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);

  useFocusEffect(useCallback(() => {
    refreshProfile().catch(() => {});
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setAuthEmail(u?.email || '');
      /* Apple or Google only: there is no password to type, so the code is the way. */
      setHasPassword(Boolean(u?.identities?.some(i => i.provider === 'email')));
    }).catch(() => {});
  }, [refreshProfile]));

  const email = user?.email || authEmail;

  const open = (which: Sheet) => {
    setError(null); setDone(null); setBusy(false); setCode('');
    if (which === 'name') setText(user?.full_name || '');
    if (which === 'phone') setText(user?.phone || '');
    if (which === 'email') { setNewEmail(''); setEmailStep('enter'); }
    if (which === 'password') { setCurrent(''); setNext(''); setConfirm(''); setShow(false); }
    setSheet(which);
  };
  const close = () => { if (!busy) setSheet(null); };

  const saveProfileField = async (field: 'full_name' | 'phone') => {
    const value = text.trim();
    if (!value) { setError(field === 'full_name' ? 'Enter your name.' : 'Enter a phone number.'); return; }
    setBusy(true); setError(null);
    try {
      await api.patch('/auth/profile', { [field]: value });
      await refreshProfile();
      setSheet(null);
    } catch (caught) { setError(message(caught, 'Could not save. Try again.')); } finally { setBusy(false); }
  };

  const startEmailChange = async () => {
    const target = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { setError('Enter a valid email address.'); return; }
    if (target === email.toLowerCase()) { setError('That is already your email.'); return; }
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ email: target });
      if (err) throw err;
      setEmailStep('codeNew'); setCode('');
    } catch (caught) { setError(message(caught, 'Could not send a code. Try again.')); } finally { setBusy(false); }
  };

  const confirmEmailCode = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return; }
    const target = newEmail.trim().toLowerCase();
    const address = emailStep === 'codeNew' ? target : email;
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: address, token: code, type: 'email_change' });
      if (err) throw err;
      const { data } = await supabase.auth.getUser();
      if ((data.user?.email || '').toLowerCase() === target) {
        await api.post('/auth/sync-user', {});   // the server copies the new email across
        await refreshProfile();
        setSheet(null);
        setDone(`Your email is now ${target}.`);
      } else {
        /* Secure Email Change: the current address must agree too. */
        setEmailStep('codeCurrent'); setCode('');
      }
    } catch (caught) {
      const m = message(caught, '');
      setError(/expired|invalid/i.test(m) ? "That code didn't work. It may have expired: start again for a new one." : m || 'Could not confirm the code.');
    } finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (!current) { setError('Enter your current password.'); return; }
    if (next.length < 8) { setError('Your new password needs at least 8 characters.'); return; }
    if (next !== confirm) { setError('Those passwords don’t match.'); return; }
    if (next === current) { setError('Choose a password different from your current one.'); return; }
    setBusy(true); setError(null);
    try {
      /* Proves it is you: a phone left unlocked is not enough to change the password. */
      const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: current });
      if (wrong) { setError('Your current password isn’t right.'); setBusy(false); return; }
      const { error: err } = await supabase.auth.updateUser({ password: next });
      if (err) throw err;
      await supabase.auth.signOut({ scope: 'others' });
      setSheet(null);
      setDone('Password changed. Your other devices have been signed out.');
    } catch (caught) { setError(message(caught, 'Could not change your password. Try again.')); } finally { setBusy(false); }
  };

  const field = [{
    backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 16, height: 54, fontFamily: font.semibold, color: colors.ink, fontSize: 15, marginTop: 12,
  }, inputReset];
  const title = { fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 } as const;
  const hint = { fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 6, lineHeight: 18 } as const;

  const buttons = (label: string, onPress: () => void) => (
    <>
    {!!error && (
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 12 }}>{error}</Text>
    )}
    <View style={{ flexDirection: 'row', gap: 11, marginTop: 18 }}>
      <TouchableOpacity onPress={close} style={[t.ghostBtn, { flex: 1, minHeight: 52 }]}>
        <Text style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={onPress} style={[t.primaryBtn, { flex: 1, minHeight: 52 }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={t.primaryBtnText}>{label}</Text>}
      </TouchableOpacity>
    </View>
    </>
  );

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={[{ paddingHorizontal: 20, paddingTop: topPad, paddingBottom: 60 + lift }, column]} showsVerticalScrollIndicator={false}>
        <SettingsHeader title="Account" onBack={() => navigation.goBack()} />

        {/* Who is signed in, the way Apple ID and most banking apps open their
            account page: the person first, then what can be changed. */}
        <View style={{ alignItems: 'center', marginTop: 22 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.semibold, fontSize: 30, color: '#fff' }}>{personInitials(user?.full_name || email || '?')}</Text>
          </View>
          <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 22, letterSpacing: -0.5, color: colors.ink, marginTop: 14 }}>{user?.full_name || 'Your account'}</Text>
          {!!email && <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, marginTop: 3 }}>{email}</Text>}
        </View>

        {!!done && (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: 16, padding: 14, marginTop: 20 }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.light} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>{done}</Text>
          </View>
        )}

        <SettingsGroup title="Personal details" rows={[
          { icon: 'person', label: 'Name', value: user?.full_name || 'Add', valueTone: user?.full_name ? 'muted' : 'accent', onPress: () => open('name') },
          { icon: 'phone', label: 'Phone', value: user?.phone || 'Add', valueTone: user?.phone ? 'muted' : 'accent', onPress: () => open('phone') },
        ]} footer="Branches see your name when they call you. Your phone is a contact number; to get texts, verify it under Text alerts in Settings." />

        <SettingsGroup title="Sign-in and security" rows={[
          { icon: 'mail', label: 'Email', value: email || 'Add', onPress: () => open('email') },
          { icon: 'key', label: 'Password', value: hasPassword ? 'Change' : 'Set one', onPress: () => open(hasPassword ? 'password' : 'passwordByCode') },
          { icon: 'logout', label: 'Sign out of all devices', tone: 'danger', busy: signingOut, onPress: () => confirmSignOutEverywhere(signOut, setSigningOut) },
        ]} footer="Changing your email or password needs your current password or a code from your email, so nobody can take over the account from an unlocked phone." />

        <SettingsGroup title="Your data" rows={[
          { icon: 'download', label: 'Download my data', sub: 'Everything Lyne holds about you, as a file you can keep', busy: exporting,
            onPress: async () => { setExporting(true); try { await downloadMyData(); } finally { setExporting(false); } } },
        ]} footer="To delete your account and everything in it, go to the bottom of Settings." />
      </ScrollView>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={close} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 + lift, maxHeight: '92%' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {sheet === 'name' && (
                <>
                  <Text style={title}>Your name</Text>
                  <Text style={hint}>How branches and staff see you.</Text>
                  <TextInput autoFocus value={text} onChangeText={setText} autoCapitalize="words" autoComplete="name" style={field} accessibilityLabel="Your name" />
                  {buttons('Save', () => saveProfileField('full_name'))}
                </>
              )}

              {sheet === 'phone' && (
                <>
                  <Text style={title}>Phone</Text>
                  <Text style={hint}>A contact number for branches. To get texts, verify it under Text alerts in Settings.</Text>
                  <TextInput autoFocus value={text} onChangeText={setText} keyboardType="phone-pad" autoComplete="tel" placeholder="876-000-0000" placeholderTextColor={colors.faint} style={field} accessibilityLabel="Phone" />
                  {buttons('Save', () => saveProfileField('phone'))}
                </>
              )}

              {sheet === 'email' && emailStep === 'enter' && (
                <>
                  <Text style={title}>Change email</Text>
                  <Text style={hint}>We will send a code to the new address. Your email changes only when you enter it.</Text>
                  <TextInput autoFocus value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="new@email.com" placeholderTextColor={colors.faint} style={field} accessibilityLabel="New email" />
                  {buttons('Send code', startEmailChange)}
                </>
              )}
              {sheet === 'email' && emailStep !== 'enter' && (
                <>
                  <Text style={title}>{emailStep === 'codeNew' ? 'Check your new email' : 'Now check your current email'}</Text>
                  <Text style={hint}>
                    {emailStep === 'codeNew'
                      ? `Enter the 6-digit code we sent to ${newEmail.trim().toLowerCase()}.`
                      : `For your security, we also sent a code to ${email}. Enter it to finish.`}
                  </Text>
                  <TextInput autoFocus value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
                    textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="000000" placeholderTextColor={colors.faint}
                    style={[field, { textAlign: 'center', fontFamily: font.extra, fontSize: 24, letterSpacing: 8 }]} accessibilityLabel="6-digit code" />
                  {buttons('Confirm', confirmEmailCode)}
                </>
              )}

              {sheet === 'password' && (
                <>
                  <Text style={title}>Change password</Text>
                  <Text style={hint}>Your other devices are signed out once it changes.</Text>
                  <TextInput value={current} onChangeText={setCurrent} secureTextEntry={!show} placeholder="Current password" placeholderTextColor={colors.faint}
                    autoComplete="current-password" textContentType="password" style={field} accessibilityLabel="Current password" />
                  <TextInput value={next} onChangeText={setNext} secureTextEntry={!show} placeholder="New password (min. 8 characters)" placeholderTextColor={colors.faint}
                    autoComplete="new-password" textContentType="newPassword" style={field} accessibilityLabel="New password" />
                  <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry={!show} placeholder="Confirm new password" placeholderTextColor={colors.faint}
                    autoComplete="new-password" textContentType="newPassword" style={field} accessibilityLabel="Confirm new password" />
                  <TouchableOpacity onPress={() => setShow(s => !s)} style={{ marginTop: 10, alignSelf: 'flex-start' }} accessibilityRole="button">
                    <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.accentDeep }}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
                  </TouchableOpacity>
                  {buttons('Change password', changePassword)}
                  <TouchableOpacity onPress={() => open('passwordByCode')} style={{ alignSelf: 'center', marginTop: 14, minHeight: 40, justifyContent: 'center' }} accessibilityRole="button">
                    <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.accentDeep }}>Forgot it? Use a code from your email</Text>
                  </TouchableOpacity>
                </>
              )}

              {sheet === 'passwordByCode' && (
                <PasswordReset signedIn initialEmail={email} onDone={() => setSheet(null)} />
              )}

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
