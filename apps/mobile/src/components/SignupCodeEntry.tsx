/**
 * SignupCodeEntry — the six-digit code from the confirmation email.
 *
 * Entering it signs the person in on this device: no going back to the sign-in
 * form to retype what they chose a minute ago. The email also has a link; if
 * they tap that instead (on this phone or another), returning to the app tries
 * the password still held in memory from the sign-up form, so they arrive
 * signed in either way. That password is never stored and never leaves the
 * screen except in the sign-in request itself.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { colors, font, inputReset } from '../lib/theme';
import { clearPendingSignup } from '../lib/pendingSignup';

const LENGTH = 6;
const RESEND_SECONDS = 60;

export function SignupCodeEntry({
  email, password, metadata, onUseDifferentEmail, onGoToSignIn,
}: {
  email: string;
  /** Present only while the form that created the account is still mounted. */
  password?: string;
  metadata?: Record<string, string>;
  onUseDifferentEmail: () => void;
  onGoToSignIn: () => void;
}) {
  const { verifySignupCode, resendSignupCode, signIn } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* Confirmed through the link instead? Coming back to the app is the moment
     to find out: a password sign-in only succeeds once the email is confirmed. */
  useEffect(() => {
    if (!password) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || busy) return;
      const { error: signInError } = await signIn(email, password);
      if (!signInError) await clearPendingSignup();
    });
    return () => sub.remove();
  }, [email, password, busy, signIn]);

  const submit = async (value = code) => {
    if (value.length !== LENGTH || busy) return;
    setBusy(true); setError(null); setNotice(null);
    const { error: verifyError } = await verifySignupCode(email, value, metadata);
    if (verifyError) {
      const expired = /expired|invalid/i.test(verifyError.message);
      setError(expired
        ? "That code didn't work. It may have expired: send a new one and use the latest email."
        : verifyError.message || 'That code did not work. Try again.');
      setCode('');
      setBusy(false);
      inputRef.current?.focus();
      return;
    }
    await clearPendingSignup();
    // Signed in: the navigator swaps to the app on its own.
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setError(null);
    const { error: resendError } = await resendSignupCode(email);
    if (resendError) { setError(resendError.message || 'Could not send a new code. Try again shortly.'); return; }
    setNotice('A new code is on its way.');
    setCooldown(RESEND_SECONDS);
  };

  return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Ionicons name="mail-unread-outline" size={26} color={colors.light} />
      </View>
      <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, textAlign: 'center', letterSpacing: -0.3 }}>Enter the code we emailed you</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 310 }}>
        We sent a {LENGTH}-digit code to {email}. Enter it here and you are signed in.
      </Text>

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, LENGTH);
          setCode(digits);
          if (error) setError(null);
          if (digits.length === LENGTH) submit(digits);
        }}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        placeholder={'0'.repeat(LENGTH)}
        placeholderTextColor={colors.faint}
        accessibilityLabel={`${LENGTH}-digit confirmation code`}
        style={[{
          alignSelf: 'stretch', marginTop: 24, height: 64, borderRadius: 16, borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border, backgroundColor: colors.fieldBg,
          textAlign: 'center', fontFamily: font.extra, fontSize: 30, letterSpacing: 10, color: colors.ink,
        }, inputReset]}
      />

      {!!error && (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 12 }}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.danger, lineHeight: 19 }}>{error}</Text>
        </View>
      )}
      {!!notice && !error && (
        <Text style={{ alignSelf: 'stretch', marginTop: 12, fontFamily: font.semibold, fontSize: 13.5, color: colors.light }}>{notice}</Text>
      )}

      <TouchableOpacity
        onPress={() => submit()}
        disabled={code.length !== LENGTH || busy}
        accessibilityRole="button"
        style={{ alignSelf: 'stretch', marginTop: 20, minHeight: 54, borderRadius: 16, backgroundColor: code.length === LENGTH ? colors.dark : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text style={{ fontFamily: font.bold, fontSize: 15.5, color: code.length === LENGTH ? '#fff' : colors.faint }}>Confirm and sign in</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={resend} disabled={cooldown > 0} style={{ marginTop: 18, minHeight: 40, justifyContent: 'center' }} accessibilityRole="button">
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: cooldown > 0 ? colors.faint : colors.accentDeep }}>
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: 22, marginTop: 6 }}>
        <TouchableOpacity onPress={onUseDifferentEmail} style={{ minHeight: 40, justifyContent: 'center' }} accessibilityRole="button">
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted }}>Use a different email</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onGoToSignIn} style={{ minHeight: 40, justifyContent: 'center' }} accessibilityRole="button">
          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.muted }}>Already confirmed? Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
