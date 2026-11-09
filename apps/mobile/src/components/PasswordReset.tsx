/**
 * PasswordReset — forgotten password, by a six-digit code from email.
 *
 * Step one sends the code. Step two takes the code and the new password together,
 * and the server checks both (routes/auth.js, /auth/password-reset). Then the app
 * signs in with the new password, so the person lands in the app, not back on a form.
 * The first step always says the same thing, whether or not the email has an account.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';
import { colors, font, inputReset } from '../lib/theme';

const LENGTH = 6;
const RESEND_SECONDS = 60;

const message = (caught: unknown, fallback: string) => (caught instanceof Error && caught.message) || fallback;

export function PasswordReset({ initialEmail, onDone, signedIn = false }: {
  initialEmail: string;
  onDone: () => void;
  /** From Account: the email is the account's own and cannot be changed here. */
  signedIn?: boolean;
}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(initialEmail.trim());
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (to = email.trim().toLowerCase()) => {
    if (!/^\S+@\S+\.\S+$/.test(to)) { setError('Enter the email address you signed up with.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      await api.post('/auth/password-reset/start', { email: to }, false);
      if (sentTo) setNotice('A new code is on its way.');
      setSentTo(to);
      setCooldown(RESEND_SECONDS);
    } catch (caught) {
      setError(message(caught, 'Could not send a code. Try again shortly.'));
    } finally { setBusy(false); }
  };

  const finish = async () => {
    if (!sentTo || busy) return;
    if (code.length !== LENGTH) { setError('Enter the 6-digit code from the email.'); return; }
    if (password.length < 8) { setError('Your new password needs at least 8 characters.'); return; }
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setBusy(true); setError(null); setNotice(null);
    try {
      await api.post('/auth/password-reset/finish', { email: sentTo, code, password }, false);
      const { error: signInError } = await signIn(sentTo, password);
      if (signInError) { setBusy(false); onDone(); return; }
      // Signed in: the navigator swaps to the app on its own.
    } catch (caught) {
      setError(message(caught, 'Could not reset your password. Try again.'));
      setBusy(false);
    }
  };

  const field = [{
    backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 17, height: 54, fontFamily: font.medium, color: colors.ink, fontSize: 15, marginBottom: 12,
  }, inputReset];
  const label = { fontFamily: font.bold, fontSize: 13, color: colors.sub, marginBottom: 7, marginLeft: 2 } as const;
  const button = (enabled: boolean) => ({
    alignSelf: 'stretch' as const, marginTop: 8, minHeight: 54, borderRadius: 16,
    backgroundColor: enabled ? colors.dark : colors.surfaceAlt, alignItems: 'center' as const, justifyContent: 'center' as const,
  });

  return (
    <View style={{ paddingVertical: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name={sentTo ? 'mail-unread-outline' : 'key-outline'} size={26} color={colors.light} />
        </View>
        <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, textAlign: 'center', letterSpacing: -0.3 }}>
          {sentTo ? 'Choose a new password' : signedIn ? 'Change password by email' : 'Reset your password'}
        </Text>
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 20, maxWidth: 310 }}>
          {sentTo
            ? (signedIn
              ? `We sent a ${LENGTH}-digit code to ${sentTo}. Enter it with your new password.`
              : `If ${sentTo} has a Lyne account, we sent it a ${LENGTH}-digit code. Enter it with your new password.`)
            : signedIn
              ? `We will send a code to ${email}. Your other devices are signed out once the password changes.`
              : 'Enter the email you signed up with and we will send you a code.'}
        </Text>
      </View>

      {!sentTo && signedIn ? null : !sentTo ? (
        <>
          <Text style={label}>Email address</Text>
          <TextInput style={field} value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor={colors.faint}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoFocus={!email} accessibilityLabel="Email address" />
        </>
      ) : (
        <>
          <Text style={label}>Code from the email</Text>
          <TextInput ref={codeRef} style={[field, { textAlign: 'center', fontFamily: font.extra, fontSize: 24, letterSpacing: 8 }]}
            value={code} onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, LENGTH)); if (error) setError(null); }}
            autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={LENGTH}
            placeholder={'0'.repeat(LENGTH)} placeholderTextColor={colors.faint} accessibilityLabel={`${LENGTH}-digit code`} />
          <Text style={label}>New password</Text>
          <View style={[field, { flexDirection: 'row', alignItems: 'center' }]}>
            <TextInput style={[{ flex: 1, height: '100%', fontFamily: font.medium, color: colors.ink, fontSize: 15 }, inputReset]}
              value={password} onChangeText={setPassword} secureTextEntry={!show} placeholder="Min. 8 characters" placeholderTextColor={colors.faint}
              autoComplete="new-password" textContentType="newPassword" accessibilityLabel="New password" />
            <TouchableOpacity onPress={() => setShow(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={label}>Confirm new password</Text>
          <TextInput style={field} value={confirm} onChangeText={setConfirm} secureTextEntry={!show} placeholder="Re-enter your new password"
            placeholderTextColor={colors.faint} autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Confirm new password" />
        </>
      )}

      {!!error && (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 6 }}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.danger, lineHeight: 19 }}>{error}</Text>
        </View>
      )}
      {!!notice && !error && (
        <Text style={{ marginTop: 4, marginBottom: 6, fontFamily: font.semibold, fontSize: 13.5, color: colors.light }}>{notice}</Text>
      )}

      {!sentTo ? (
        <TouchableOpacity onPress={() => send()} disabled={busy} accessibilityRole="button" style={button(true)}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: '#fff' }}>Send me a code</Text>}
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity onPress={finish} disabled={busy} accessibilityRole="button" style={button(code.length === LENGTH)}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: code.length === LENGTH ? '#fff' : colors.faint }}>Save and sign in</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => send(sentTo)} disabled={cooldown > 0 || busy} accessibilityRole="button"
            style={{ alignSelf: 'center', marginTop: 16, minHeight: 40, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: cooldown > 0 ? colors.faint : colors.accentDeep }}>
              {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 6 }}>
        {sentTo && !signedIn && (
          <TouchableOpacity onPress={() => { setSentTo(null); setCode(''); setError(null); setNotice(null); }} style={{ minHeight: 40, justifyContent: 'center' }} accessibilityRole="button">
            <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted }}>Use a different email</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDone} style={{ minHeight: 40, justifyContent: 'center' }} accessibilityRole="button">
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted }}>{signedIn ? 'Cancel' : 'Back to sign in'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
