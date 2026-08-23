/**
 * SignupScreen — brand-framed registration.
 *
 * Same visual language as sign in (white canvas, Lyne brand-tile mosaic framing
 * the top and bottom, Lyne lockup, black button), but as a scrolling form
 * that collects everything a branch needs up front: name, email, phone, date
 * of birth (in-app calendar), and password + confirmation.
 *
 * No TRN here. It used to be required at signup — "branches use it to verify
 * you" — and stored on the server, where no branch endpoint ever read it. It
 * is optional now, added later if the customer wants it, and kept in the
 * device keychain: see lib/documentVault.ts.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../lib/ThemeProvider';
import { colors, font, shadow, inputReset } from '../../lib/theme';
import { CalendarSheet, formatDob, toISODate } from '../../components/CalendarSheet';

type Tile = { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string };
const TOP_TILES: Tile[] = [
  { icon: 'ticket', bg: colors.dark, fg: colors.accent },
  { icon: 'time-outline', bg: '#ffffff', fg: colors.accentDeep },
  { icon: 'barcode-outline', bg: colors.accent, fg: colors.accentInk },
  { icon: 'location', bg: colors.dark, fg: '#ffffff' },
  { icon: 'notifications', bg: '#ffffff', fg: colors.accentDeep },
];
const BOTTOM_TILES: Tile[] = [
  { icon: 'qr-code-outline', bg: colors.dark, fg: '#ffffff' },
  { icon: 'people-outline', bg: colors.accent, fg: colors.accentInk },
  { icon: 'sparkles', bg: '#ffffff', fg: colors.accentDeep },
  { icon: 'navigate', bg: colors.dark, fg: colors.accent },
  { icon: 'checkmark-done', bg: colors.accent, fg: colors.accentInk },
];

function MotifRow({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 13, transform: [{ rotate: '-7deg' }] }}>
      {tiles.map((tile, index) => (
        <View key={index} style={{ width: 78, height: 78, borderRadius: 23, backgroundColor: tile.bg, alignItems: 'center', justifyContent: 'center', borderWidth: tile.bg === '#ffffff' ? 1 : 0, borderColor: colors.border, ...shadow.card }}>
          <Ionicons name={tile.icon} size={29} color={tile.fg} />
        </View>
      ))}
    </View>
  );
}

type Field = 'name' | 'email' | 'phone' | 'password' | 'confirm';

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const { scheme } = useTheme();
  const styles = useMemo(() => makeStyles(), [scheme]);

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim()) { setError('Add your name, email and phone number to continue.'); return; }
    if (!dob) { setError('Choose your date of birth.'); return; }
    if (!password) { setError('Create a password to secure your account.'); return; }
    if (password.length < 8) { setError('Your password needs at least 8 characters.'); return; }
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setLoading(true); setError(null);
    try {
      const { error: signupError, needsConfirmation } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        date_of_birth: toISODate(dob),
      });
      if (signupError) throw signupError;
      if (needsConfirmation) setConfirmSent(true);
    } catch (e: any) {
      setError(e.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (field: Field) => [styles.input, focused === field && styles.inputFocused, inputReset];
  const focusProps = (field: Field) => ({ onFocus: () => setFocused(field), onBlur: () => setFocused(null) });

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* top motif */}
          <View style={styles.topMotif} pointerEvents="none"><MotifRow tiles={TOP_TILES} /></View>

          {/* brand lockup */}
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            <View style={styles.logo}><Text maxFontSizeMultiplier={1.2} style={styles.logoText}>L</Text></View>
            <Text style={styles.brand}>Create your account</Text>
            <Text style={styles.subtitle}>A few details and you’re ready to skip the line.</Text>
          </View>

          {confirmSent ? (
            <View style={{ alignItems: 'center', paddingVertical: 18 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#e6f7ee', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="mail-unread-outline" size={26} color={colors.light} />
              </View>
              <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, textAlign: 'center', letterSpacing: -0.3 }}>Confirm your email</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 300 }}>We sent a confirmation link to {email.trim().toLowerCase()}. Tap it to activate your account, then sign in.</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={[styles.btn, { alignSelf: 'stretch', marginTop: 24 }]}>
                <Text style={styles.btnText}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          {!!error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Full name</Text>
          <TextInput style={fieldStyle('name')} {...focusProps('name')} placeholder="e.g. Debra Samuels" placeholderTextColor={colors.faint} value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" />

          <Text style={styles.label}>Email address</Text>
          <TextInput style={fieldStyle('email')} {...focusProps('email')} placeholder="you@email.com" placeholderTextColor={colors.faint} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

          <Text style={styles.label}>Phone number</Text>
          <TextInput style={fieldStyle('phone')} {...focusProps('phone')} placeholder="876-000-0000" placeholderTextColor={colors.faint} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />

          <Text style={styles.label}>Date of birth</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => setCalendarOpen(true)} style={[styles.input, styles.pickerRow, calendarOpen && styles.inputFocused]}>
            <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: dob ? colors.ink : colors.faint }}>{dob ? formatDob(dob) : 'Select your date of birth'}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          </TouchableOpacity>

          <Text style={styles.label}>Password</Text>
          <View style={[styles.input, styles.pickerRow, focused === 'password' && styles.inputFocused]}>
            <TextInput style={[{ flex: 1, height: '100%', fontFamily: font.medium, color: colors.ink, fontSize: 15 }, inputReset]} {...focusProps('password')} placeholder="Min. 8 characters" placeholderTextColor={colors.faint} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="new-password" />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword(s => !s)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm password</Text>
          <TextInput style={fieldStyle('confirm')} {...focusProps('confirm')} placeholder="Re-enter your password" placeholderTextColor={colors.faint} value={confirm} onChangeText={setConfirm} secureTextEntry={!showPassword} autoComplete="new-password" />

          <TouchableOpacity activeOpacity={0.9} style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.btnText}>Create account</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.accent} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.switchText}>Already a member?  <Text style={styles.switchBold}>Sign in</Text></Text>
          </TouchableOpacity>
          </>
          )}

          {/* bottom motif */}
          <View style={styles.bottomMotif} pointerEvents="none"><MotifRow tiles={BOTTOM_TILES} /></View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarSheet visible={calendarOpen} value={dob} onClose={() => setCalendarOpen(false)} onSelect={(d) => { setDob(d); setCalendarOpen(false); }} />
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  inner: { paddingHorizontal: 28, paddingTop: 118, paddingBottom: 40 },

  topMotif: { position: 'absolute', top: -30, left: -30, right: -30, alignItems: 'center', opacity: 0.9 },
  bottomMotif: { alignItems: 'center', marginTop: 30, opacity: 0.9 },

  logo: {
    width: 58, height: 58, borderRadius: 20, alignSelf: 'center',
    backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, ...shadow.card,
  },
  logoText: { color: colors.accent, fontFamily: font.extra, fontSize: 26 },
  brand: { fontFamily: font.extra, fontSize: 24, color: colors.ink, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: font.medium, fontSize: 14.5, color: colors.muted, textAlign: 'center', marginTop: 7, maxWidth: 280 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fdecec', borderWidth: 1, borderColor: '#f7cfcf',
    borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 16,
  },
  errorText: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.danger },

  label: { fontFamily: font.bold, fontSize: 13, color: colors.sub, marginBottom: 7, marginLeft: 2 },
  input: {
    backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 17, height: 54,
    fontFamily: font.medium, color: colors.ink, fontSize: 15, marginBottom: 15,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.surface },
  pickerRow: { flexDirection: 'row', alignItems: 'center' },

  btn: {
    backgroundColor: colors.dark, borderRadius: 18, height: 58,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginTop: 10, ...shadow.hero,
  },
  btnText: { fontFamily: font.extra, color: '#ffffff', fontSize: 16 },

  switchRow: { alignItems: 'center', marginTop: 22 },
  switchText: { fontFamily: font.medium, fontSize: 13.5, color: colors.muted },
  switchBold: { fontFamily: font.bold, color: colors.ink },
});
