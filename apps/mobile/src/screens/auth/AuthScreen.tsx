/**
 * AuthScreen — sign in and create account, as one screen.
 *
 * These were two screens, and the switch between them pushed a new one, which
 * read as being sent somewhere else. Now the switch slides and the form changes
 * in place: email and password stay exactly where they are, with anything
 * already typed, and the fields only an account needs (name, phone, date of
 * birth, TRN, confirm password) expand in around them. Switching back folds
 * them away again.
 *
 * Visual language as before: the shared AuthMotifFrame docks the Lyne brand
 * tiles to the top and bottom edges around the lockup, the form and one black
 * button. A device nobody has signed in on opens in "Create account"; see
 * lib/deviceHistory.ts.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../lib/ThemeProvider';
import { colors, font, inputReset, shadow } from '../../lib/theme';
import { useNavBarLift, useTopPad } from '../../lib/insets';
import { useContentColumn } from '../../lib/stage';
import { CalendarSheet, formatDob, toISODate } from '../../components/CalendarSheet';
import { AuthMotifFrame } from '../../components/AuthMotifFrame';
import { SocialAuthButtons } from '../../components/SocialAuthButtons';
import { AuthMode, AuthModeSwitch } from '../../components/AuthModeSwitch';
import { SignupCodeEntry } from '../../components/SignupCodeEntry';
import { clearPendingSignup, readPendingSignup, rememberPendingSignup } from '../../lib/pendingSignup';
import { setDocument } from '../../lib/documentVault';
import { formatTrn, isValidTrn } from '../../lib/trn';
import type { RootStackParamList } from '../../navigation/AppNavigator';

type Field = 'name' | 'email' | 'phone' | 'trn' | 'password' | 'confirm';

// One timing for everything that moves when the mode changes.
const LAYOUT = LinearTransition.duration(260);
const ENTER = FadeIn.duration(220);
const EXIT = FadeOut.duration(140);

export default function AuthScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Auth'>>();
  const column = useContentColumn();
  const topPad = useTopPad(72);
  const lift = useNavBarLift();
  const { signIn, signUp } = useAuth();
  const { scheme } = useTheme();
  const styles = useMemo(() => makeStyles(), [scheme]);

  const [mode, setMode] = useState<AuthMode>(route.params?.mode ?? 'signin');
  const signup = mode === 'signup';

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
     closed in between): reopen in Create account, on the code. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  useEffect(() => {
    readPendingSignup().then(e => { setPendingEmail(e); if (e) setMode('signup'); });
  }, []);

  const switchMode = (next: AuthMode) => { setError(null); setMode(next); };

  const handleSignIn = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    setLoading(true); setError(null);
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError.message === 'Invalid login credentials' ? 'That email and password don’t match. Try again.' : signInError.message);
  };

  const handleSignUp = async () => {
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
      setError(e.message || 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (field: Field) => [styles.input, focused === field && styles.inputFocused, inputReset];
  const focusProps = (field: Field) => ({ onFocus: () => setFocused(field), onBlur: () => setFocused(null) });
  const awaitingCode = signup && (confirmSent || !!pendingEmail);
  // Fields only an account needs are rendered inline (not as a nested
  // component) so typing never remounts them and drops focus.

  return (
    <View style={styles.container}>
      <AuthMotifFrame />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.inner, { paddingTop: topPad, paddingBottom: 150 + lift }, column]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View layout={LAYOUT} style={{ alignItems: 'center', marginBottom: 22 }}>
            <Image
              source={colors.bg === '#f1f3f7'
                ? require('../../../assets/lyne-logo-dark.png')
                : require('../../../assets/lyne-logo-light.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Lyne"
            />
            <Animated.Text key={`t-${mode}`} entering={ENTER} style={styles.title}>
              {signup ? 'Create your account' : 'Welcome back'}
            </Animated.Text>
            <Animated.Text key={`s-${mode}`} entering={ENTER} style={styles.subtitle}>
              {signup ? 'A few details and you’re ready to skip the line.' : 'Sign in to skip the line.'}
            </Animated.Text>
          </Animated.View>

          <Animated.View layout={LAYOUT}>
            <AuthModeSwitch mode={mode} onChange={switchMode} />
          </Animated.View>

          {awaitingCode ? (
            <Animated.View entering={ENTER} exiting={EXIT}>
              <SignupCodeEntry
                email={confirmSent ? email.trim().toLowerCase() : pendingEmail!}
                password={confirmSent ? password : undefined}
                metadata={confirmSent && dob ? { full_name: fullName.trim(), phone: phone.trim(), date_of_birth: toISODate(dob) } : undefined}
                onUseDifferentEmail={async () => { await clearPendingSignup(); setPendingEmail(null); setConfirmSent(false); }}
                onGoToSignIn={() => { setConfirmSent(false); switchMode('signin'); }}
              />
            </Animated.View>
          ) : (
            <>
              {!!error && (
                <Animated.View entering={ENTER} exiting={EXIT} layout={LAYOUT} style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={15} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </Animated.View>
              )}

              {signup && (
                <Animated.View entering={ENTER} exiting={EXIT} layout={LAYOUT}>
                <Text style={styles.label}>Full name</Text>
                <TextInput style={fieldStyle('name')} {...focusProps('name')} placeholder="e.g. Debra Samuels" placeholderTextColor={colors.faint} value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" />
                </Animated.View>
              )}

              <Animated.View layout={LAYOUT}>
                <Text style={styles.label}>Email address</Text>
                <TextInput style={fieldStyle('email')} {...focusProps('email')} placeholder="you@email.com" placeholderTextColor={colors.faint} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              </Animated.View>

              {signup && (
                <Animated.View entering={ENTER} exiting={EXIT} layout={LAYOUT}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput style={fieldStyle('phone')} {...focusProps('phone')} placeholder="876-000-0000" placeholderTextColor={colors.faint} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />

                <Text style={styles.label}>Date of birth</Text>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setCalendarOpen(true)} style={[styles.input, styles.row, calendarOpen && styles.inputFocused]}>
                  <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: dob ? colors.ink : colors.faint }}>{dob ? formatDob(dob) : 'Select your date of birth'}</Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.muted} />
                </TouchableOpacity>

                <Text style={styles.label}>TRN</Text>
                <TextInput style={fieldStyle('trn')} {...focusProps('trn')} placeholder="000-000-000" placeholderTextColor={colors.faint} value={trn} onChangeText={setTrn} keyboardType="number-pad" />
                </Animated.View>
              )}

              <Animated.View layout={LAYOUT}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.input, styles.row, focused === 'password' && styles.inputFocused]}>
                  <TextInput
                    style={[styles.passwordInput, inputReset]}
                    {...focusProps('password')}
                    placeholder={signup ? 'Min. 8 characters' : 'Your password'}
                    placeholderTextColor={colors.faint}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {signup && (
                <Animated.View entering={ENTER} exiting={EXIT} layout={LAYOUT}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput style={fieldStyle('confirm')} {...focusProps('confirm')} placeholder="Re-enter your password" placeholderTextColor={colors.faint} value={confirm} onChangeText={setConfirm} secureTextEntry={!showPassword} autoComplete="new-password" />
                </Animated.View>
              )}

              <Animated.View layout={LAYOUT}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.btn, loading && { opacity: 0.7 }]}
                  onPress={signup ? handleSignUp : handleSignIn}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Text style={styles.btnText}>{signup ? 'Create account' : 'Sign in'}</Text>
                      <Ionicons name="arrow-forward" size={17} color={colors.accent} />
                    </>
                  )}
                </TouchableOpacity>

                <SocialAuthButtons onError={setError} />

                <TouchableOpacity onPress={() => switchMode(signup ? 'signin' : 'signup')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
                  <Text style={styles.switchText}>
                    {signup ? 'Already a member?  ' : 'New to Lyne?  '}
                    <Text style={styles.switchBold}>{signup ? 'Sign in' : 'Create an account'}</Text>
                  </Text>
                </TouchableOpacity>
              </Animated.View>
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
  /* paddingBottom (set inline) clears the docked bottom motif and the Android
     nav bar; at 40 the last row ended underneath the fade. */
  inner: { paddingHorizontal: 28 },

  /* The lockup is wordmark-plus-symbol, so it is wide rather than square and
     carries the name itself. */
  logo: { width: 168, height: 64, alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: font.extra, fontSize: 24, color: colors.ink, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: font.medium, fontSize: 14.5, color: colors.muted, textAlign: 'center', marginTop: 7, maxWidth: 290 },

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
  row: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, height: '100%', fontFamily: font.medium, color: colors.ink, fontSize: 15 },

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
