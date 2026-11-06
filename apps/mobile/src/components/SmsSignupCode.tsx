/**
 * SmsSignupCode — the six-digit code from a sign-up text.
 *
 * The account does not exist yet: the server makes it the moment this code checks
 * out, then the app signs in with the password from the form. The password is sent
 * once for that, and never stored here.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import api from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';
import { colors, font, inputReset } from '../lib/theme';

export function SmsSignupCode({ phone, email, password, fullName, dob, onBack }: {
  phone: string; email: string; password: string; fullName: string; dob?: string; onBack: () => void;
}) {
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const finish = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError(null);
    try {
      await api.post('/sms/signup/finish', { phone, code, email, password, full_name: fullName, ...(dob ? { date_of_birth: dob } : {}) }, false);
      const { error: signInError } = await signIn(email, password);
      if (signInError) throw signInError;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not check your code. Try again.');
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null); setResent(false);
    try {
      await api.post('/sms/signup/start', { phone }, false);
      setResent(true);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not send another code.');
    }
  };

  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink }}>Enter the code we texted you</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, lineHeight: 20 }}>Sent to {phone}. It expires in a few minutes.</Text>
      <TextInput
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel="Six-digit code"
        placeholder="000000"
        placeholderTextColor={colors.muted}
        style={[{ height: 56, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, textAlign: 'center', fontFamily: font.extra, fontSize: 24, letterSpacing: 6, color: colors.ink }, inputReset]}
      />
      {!!error && <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.dangerInk, lineHeight: 19 }}>{error}</Text>}
      {resent && !error && <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted }}>Another code is on its way.</Text>}
      <TouchableOpacity onPress={finish} disabled={code.length !== 6 || busy} accessibilityRole="button"
        style={{ height: 54, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: code.length === 6 && !busy ? 1 : 0.5 }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: font.extra, fontSize: 16, color: '#fff' }}>Create account</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={resend} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.accent }}>Send another code</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.muted }}>Change my details</Text>
      </TouchableOpacity>
    </View>
  );
}
