/**
 * PhoneAlertsCard — add or change a phone number, and choose to get texts.
 *
 * The number goes through Supabase: updateUser({ phone }) texts a code, and
 * verifyOtp with type 'phone_change' proves it. Never signInWithOtp: a phone number
 * adds to an account here, it does not make one. Texts stay off until the person
 * turns them on, and turning them off here is how an account says stop.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { supabase } from '../lib/apiClient';
import { colors, font, inputReset } from '../lib/theme';

type Pref = { available: boolean; phone: string | null; verified: boolean; opt_in: boolean };

/** Supabase's limits say what happened in their words; these say what to do. */
function friendly(caught: unknown) {
  const e = caught as { code?: string; status?: number; message?: string };
  if (e?.status === 429 || e?.code === 'over_sms_send_rate_limit' || /rate limit|too many/i.test(e?.message || '')) {
    return 'Too many codes have been sent. Wait an hour and try again.';
  }
  if (/already/i.test(e?.message || '')) return 'That number is already on another account.';
  return e?.message || 'Something went wrong. Try again.';
}

const toE164 = (typed: string) => {
  const d = typed.replace(/\D/g, '');
  if (d.length === 7) return `+1876${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  return null;
};

export function PhoneAlertsCard() {
  const qc = useQueryClient();
  const pref = useQuery({ queryKey: ['sms-preference'], queryFn: () => api.get<Pref>('/sms/preference') });
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const d = pref.data;
  if (!d?.available) return null;

  const send = async () => {
    const e164 = toE164(phone);
    if (!e164) { setError('Enter a Jamaican mobile number, like 876-555-0100.'); return; }
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ phone: e164 });
      if (err) throw err;
      setSentTo(e164);
    } catch (caught) { setError(friendly(caught)); } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!sentTo || code.length !== 6) return;
    setBusy(true); setError(null);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: 'phone_change' });
      if (err) throw err;
      await api.put('/sms/preference', { opt_in: true });
      setEditing(false); setSentTo(null); setCode(''); setPhone('');
      await qc.invalidateQueries({ queryKey: ['sms-preference'] });
    } catch (caught) { setError(friendly(caught)); } finally { setBusy(false); }
  };

  const toggle = async (on: boolean) => {
    setError(null);
    try {
      await api.put('/sms/preference', { opt_in: on });
      await qc.invalidateQueries({ queryKey: ['sms-preference'] });
    } catch (caught) { setError(friendly(caught)); }
  };

  const field = [{ height: 50, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontFamily: font.semibold, fontSize: 16, color: colors.ink }, inputReset];

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginTop: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.extra, fontSize: 17, color: colors.ink }}>Text alerts</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, lineHeight: 19 }}>
        Get a text when you are called, if the branch offers it. Standard rates may apply, and you can turn this off here at any time.
      </Text>

      {d.verified && d.phone && !editing ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.ink }}>{d.phone}</Text>
            <Switch value={d.opt_in} onValueChange={toggle} accessibilityLabel="Text alerts" />
          </View>
          <TouchableOpacity onPress={() => setEditing(true)} accessibilityRole="button">
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.accent }}>Change number</Text>
          </TouchableOpacity>
        </>
      ) : sentTo ? (
        <>
          <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.ink }}>Enter the code sent to {sentTo}</Text>
          <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
            textContentType="oneTimeCode" autoComplete="sms-otp" accessibilityLabel="Six-digit code" style={field} />
          <TouchableOpacity onPress={verify} disabled={busy || code.length !== 6} accessibilityRole="button"
            style={{ height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: code.length === 6 ? 1 : 0.5 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>Verify</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="876-000-0000"
            placeholderTextColor={colors.muted} accessibilityLabel="Mobile number" style={field} />
          <TouchableOpacity onPress={send} disabled={busy} accessibilityRole="button"
            style={{ height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>Send a code</Text>}
          </TouchableOpacity>
        </>
      )}
      {!!error && <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.dangerInk, lineHeight: 19 }}>{error}</Text>}
    </View>
  );
}
