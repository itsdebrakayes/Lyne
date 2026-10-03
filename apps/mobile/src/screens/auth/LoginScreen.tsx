/**
 * LoginScreen — brand-framed sign in.
 *
 * Carries the welcome screen's visual language onto auth: the shared
 * AuthMotifFrame docks a row of Lyne brand tiles to the top and bottom edges
 * and fades them into the page, around a centred Lyne lockup, the sign-in
 * form, and one black button — the same button as the intro's "Start queuing".
 * Sign up renders the identical frame, which is the point of sharing it.
 */
import React, { useMemo, useState } from 'react';
import { Image,
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../lib/ThemeProvider';
import { colors, font, shadow, inputReset } from '../../lib/theme';
import { useContentColumn } from '../../lib/stage';
import { AuthMotifFrame } from '../../components/AuthMotifFrame';
import { SocialAuthButtons } from '../../components/SocialAuthButtons';

export default function LoginScreen() {
  const column = useContentColumn();
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { scheme } = useTheme();
  const styles = useMemo(() => makeStyles(), [scheme]);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    setLoading(true); setError('');
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError.message === 'Invalid login credentials' ? 'That email and password don’t match. Try again.' : signInError.message);
  };

  return (
    <View style={styles.container}>
      <AuthMotifFrame />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* On a tablet the form holds a column instead of stretching a text
            field across a thousand points. */}
        <View style={[styles.inner, column]}>
          {/* THE BRAND LOCKUP — the real one.
              This was a rounded square containing the letter L with the word
              "Lyne" set in Manrope under it: a placeholder that outlived the
              brand kit. The kit's primary lockup is the symbol and the wordmark
              together, and the wordmark is Cormorant Italic, so setting it in
              the UI typeface was never going to be the logo however close the
              letters got.

              Two files because a single one cannot work on both grounds: the
              white-reversed version disappears on the light theme and the
              gradient version disappears on the dark one. */}
          <Image
            source={colors.bg === '#f1f3f7'
              ? require('../../../assets/lyne-logo-dark.png')
              : require('../../../assets/lyne-logo-light.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Lyne"
          />
          <Text style={styles.subtitle}>Sign in to skip the line.</Text>

          {!!error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={[styles.input, focused === 'email' && styles.inputFocused, inputReset]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            placeholder="Enter your email address"
            placeholderTextColor={colors.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <View style={[styles.input, styles.passwordRow, focused === 'password' && styles.inputFocused]}>
            <TextInput
              style={[styles.passwordInput, inputReset]}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              placeholder="Password"
              placeholderTextColor={colors.faint}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
            />
            <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.9} style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={styles.btnText}>Sign in</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.accent} />
              </>
            )}
          </TouchableOpacity>

          <SocialAuthButtons />

          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.switchText}>Don’t have an account?  <Text style={styles.switchBold}>Sign up</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },

  /* The lockup is wordmark-plus-symbol, so it is wide rather than square and
     carries the name itself — there is no separate brand text under it. */
  logo: { width: 184, height: 70, alignSelf: 'center', marginBottom: 14 },
  subtitle: { fontFamily: font.medium, fontSize: 14.5, color: colors.muted, textAlign: 'center', marginTop: 7, marginBottom: 28 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fdecec', borderWidth: 1, borderColor: '#f7cfcf',
    borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 16,
  },
  errorText: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.danger },

  input: {
    backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 17, height: 56,
    fontFamily: font.medium, color: colors.ink, fontSize: 15, marginBottom: 14,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.surface },
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 15 },
  passwordInput: { flex: 1, height: '100%', fontFamily: font.medium, color: colors.ink, fontSize: 15 },

  btn: {
    backgroundColor: colors.dark, borderRadius: 18, height: 58,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginTop: 8, ...shadow.hero,
  },
  btnText: { fontFamily: font.extra, color: '#ffffff', fontSize: 16 },

  switchRow: { alignItems: 'center', marginTop: 20 },
  switchText: { fontFamily: font.medium, fontSize: 13.5, color: colors.muted },
  switchBold: { fontFamily: font.bold, color: colors.ink },
});
