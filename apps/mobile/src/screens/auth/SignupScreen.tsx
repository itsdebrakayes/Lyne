/**
 * SignupScreen — brand-framed registration.
 *
 * Same visual language as sign in (white canvas, Lyne brand-tile mosaic framing
 * the top and bottom, Lyne lockup, black button), but as a scrolling form
 * that collects everything a branch needs up front: name, email, phone, date
 * of birth (in-app calendar), password + confirmation, and TRN.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image,
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../lib/ThemeProvider';
import { colors, font, shadow, inputReset } from '../../lib/theme';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import { useContentColumn } from '../../lib/stage';
import { CalendarSheet, formatDob, toISODate } from '../../components/CalendarSheet';
import { AuthMotifFrame } from '../../components/AuthMotifFrame';
import { SocialAuthButtons } from '../../components/SocialAuthButtons';
import { AuthModeSwitch } from '../../components/AuthModeSwitch';
import { SignupCodeEntry } from '../../components/SignupCodeEntry';
import { clearPendingSignup, readPendingSignup, rememberPendingSignup } from '../../lib/pendingSignup';
import { setDocument } from '../../lib/documentVault';
import { formatTrn, isValidTrn } from '../../lib/trn';


type Field = 'name' | 'email' | 'phone' | 'trn' | 'password' | 'confirm';

export default function SignupScreen() {
  const column = useContentColumn();
  const topPad = useTopPad(72);
  const lift = useNavBarLift();
  const navigation = useNavigation<any>();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [trn, setTrn] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  /* An account created here earlier that still needs its code (the app was
     closed in between): reopen on the code screen. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  useEffect(() => { readPendingSignup().then(setPendingEmail); }, []);
  const { scheme } = useTheme();
  const styles = useMemo(() => makeStyles(), [scheme]);

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim()) { setError('Add your name, email and phone number to continue.'); return; }
    if (!dob) { setError('Choose your date of birth.'); return; }
    if (!password) { setError('Create a password to secure your account.'); return; }
    if (password.length < 8) { setError('Your password needs at least 8 characters.'); return; }
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    if (!trn.trim()) { setError('Add your TRN. Branches use it to verify you.'); return; }
    if (!isValidTrn(trn)) { setError('A TRN is nine digits, like 123-456-789.'); return; }
    setLoading(true); setError(null);
    try {
      /* The TRN is not sent anywhere. It used to ride along as account
         metadata, which put it on Supabase's servers despite the privacy
         policy's promise that it stays on the phone. It goes to the device
         keychain instead, where the TRN screen reads it. */
      const { error: signupError, needsConfirmation } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        date_of_birth: toISODate(dob),
      });
      if (signupError) throw signupError;
      await setDocument('trn', formatTrn(trn.trim()));
      if (needsConfirmation) {
        await rememberPendingSignup(email.trim().toLowerCase());
        setConfirmSent(true);
      }
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
      <AuthMotifFrame />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[[styles.inner, { paddingBottom: 150 + lift }], { paddingTop: topPad }, column]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* brand lockup */}
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            {/* The real lockup, as on sign-in — see the note there. */}
            <Image
              source={colors.bg === '#f1f3f7'
                ? require('../../../assets/lyne-logo-dark.png')
                : require('../../../assets/lyne-logo-light.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Lyne"
            />
            <Text style={styles.brand}>Create your account</Text>
            <Text style={styles.subtitle}>A few details and you’re ready to skip the line.</Text>
          </View>

          <AuthModeSwitch current="signup" />

          {confirmSent || pendingEmail ? (
            <SignupCodeEntry
              email={confirmSent ? email.trim().toLowerCase() : pendingEmail!}
              password={confirmSent ? password : undefined}
              metadata={confirmSent && dob ? { full_name: fullName.trim(), phone: phone.trim(), date_of_birth: toISODate(dob) } : undefined}
              onUseDifferentEmail={async () => { await clearPendingSignup(); setPendingEmail(null); setConfirmSent(false); }}
              onGoToSignIn={() => navigation.replace('Auth')}
            />
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

          <Text style={styles.label}>TRN</Text>
          <TextInput style={fieldStyle('trn')} {...focusProps('trn')} placeholder="000-000-000" placeholderTextColor={colors.faint} value={trn} onChangeText={setTrn} keyboardType="number-pad" />

          <Text style={styles.label}>Password</Text>
          <View style={[styles.input, styles.pickerRow, focused === 'password' && styles.inputFocused]}>
            <TextInput style={[{ flex: 1, height: '100%', fontFamily: font.medium, color: colors.ink, fontSize: 15 }, inputReset]} {...focusProps('password')} placeholder="Min. 8 characters" placeholderTextColor={colors.faint} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="new-password" />
            <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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

          <SocialAuthButtons onError={setError} />

          <TouchableOpacity onPress={() => navigation.replace('Auth')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.switchText}>Already a member?  <Text style={styles.switchBold}>Sign in</Text></Text>
          </TouchableOpacity>
          </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarSheet visible={calendarOpen} value={dob} onClose={() => setCalendarOpen(false)} onSelect={(d) => { setDob(d); setCalendarOpen(false); }} />
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  /* paddingBottom clears the docked bottom motif — at 40 the last row of the
     form ended underneath the fade instead of above it. */
  inner: { paddingHorizontal: 28, paddingTop: 118, paddingBottom: 150 },

  logo: { width: 160, height: 60, alignSelf: 'center', marginBottom: 12 },
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
