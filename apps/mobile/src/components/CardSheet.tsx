/**
 * CardSheet — the "type your card and pay" panel (Stripe, card entry).
 *
 * Collects card number / expiry / CVC / name, tokenizes directly with Stripe
 * (paymentsConfigured gate), and hands the resulting payment_method to the
 * caller via onToken. Reused for adding a saved card and for premium checkout.
 */
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, t, inputReset } from '../lib/theme';
import { createPaymentMethod, paymentsConfigured, TokenizedCard } from '../lib/stripe';

function formatNumber(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function CardSheet({
  visible, onClose, onToken, title = 'Add a card', submitLabel = 'Save card',
}: {
  visible: boolean;
  onClose: () => void;
  onToken: (card: TokenizedCard) => Promise<void> | void;
  title?: string;
  submitLabel?: string;
}) {
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setNumber(''); setExpiry(''); setCvc(''); setName(''); setError(''); };

  const submit = async () => {
    setError('');
    const num = number.replace(/\s/g, '');
    const [mm, yy] = expiry.split('/');
    if (num.length < 13) return setError('Enter a valid card number.');
    if (!mm || !yy || yy.length < 2) return setError('Enter the expiry as MM/YY.');
    if (Number(mm) < 1 || Number(mm) > 12) return setError('That expiry month isn’t valid.');
    if (cvc.length < 3) return setError('Enter the 3-digit security code.');
    try {
      setBusy(true);
      const card = await createPaymentMethod({ number: num, exp_month: Number(mm), exp_year: Number(`20${yy.slice(-2)}`), cvc, name: name.trim() || undefined });
      await onToken(card);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process that card.');
    } finally { setBusy(false); }
  };

  const inputStyle = { backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 15, height: 52, fontFamily: font.semibold, color: colors.ink, fontSize: 15 } as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(10,16,14,.5)' }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 34 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 18 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="card-outline" size={20} color={colors.ink} />
            <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, letterSpacing: -0.4 }}>{title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="lock-closed" size={13} color={colors.muted} />
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted }}>Encrypted and sent straight to Stripe. We never see your card.</Text>
          </View>

          {!paymentsConfigured() && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fdf3e7', borderRadius: 12, padding: 12, marginTop: 14 }}>
              <Ionicons name="time-outline" size={16} color={colors.moderate} />
              <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: colors.sub }}>Card payments are launching soon. You can’t be charged yet.</Text>
            </View>
          )}

          <TextInput value={number} onChangeText={v => setNumber(formatNumber(v))} placeholder="Card number" placeholderTextColor={colors.faint} keyboardType="number-pad" style={[inputStyle, { marginTop: 16 }, inputReset]} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TextInput value={expiry} onChangeText={v => setExpiry(formatExpiry(v))} placeholder="MM/YY" placeholderTextColor={colors.faint} keyboardType="number-pad" style={[inputStyle, { flex: 1 }, inputReset]} />
            <TextInput value={cvc} onChangeText={v => setCvc(v.replace(/\D/g, '').slice(0, 4))} placeholder="CVC" placeholderTextColor={colors.faint} keyboardType="number-pad" secureTextEntry style={[inputStyle, { flex: 1 }, inputReset]} />
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="Name on card" placeholderTextColor={colors.faint} autoCapitalize="words" style={[inputStyle, { marginTop: 12 }, inputReset]} />

          {!!error && <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.danger, marginTop: 12 }}>{error}</Text>}

          <TouchableOpacity disabled={busy} onPress={submit} style={[t.primaryBtn, { marginTop: 18, minHeight: 54 }, busy && { opacity: 0.7 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="lock-closed" size={15} color={colors.onDark} />
                <Text style={t.primaryBtnText}>{submitLabel}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
