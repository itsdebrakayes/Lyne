/**
 * LoginScreen — brand-framed sign in.
 *
 * Carries the welcome screen's visual language onto auth: a white canvas with
 * the Lyne brand-tile mosaic bleeding in from the top and bottom edges (you see
 * half of it at each end), fading into white around a centred Lyne lockup,
 * the sign-in form, and one black button — the same forest button as the
 * intro's "Start queuing".
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../lib/ThemeProvider';
import { colors, font, shadow, inputReset } from '../../lib/theme';
import { QueueScene } from '../../components/QueueScene';



export default function LoginScreen() {
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
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.scene} pointerEvents="none"><QueueScene height={180} /></View>
        <View style={styles.inner}>
          {/* brand lockup */}
          <View style={styles.logo}><Text style={styles.logoText}>L</Text></View>
          <Text style={styles.brand}>Lyne</Text>
          <Text style={styles.subtitle}>Sign in to hold your place.</Text>

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

          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={styles.switchText}>Don’t have an account?  <Text style={styles.switchBold}>Sign up</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  /* Was `justifyContent: 'center'`, which left the form floating with large
     dead regions above and below. It now sits on a raised sheet anchored to the
     bottom edge, with the queue scene above it. */
  scene: { flex: 1, justifyContent: 'flex-end', minHeight: 150 },
  inner: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 30, paddingTop: 30, paddingBottom: 34,
    ...shadow.hero,
  },

  logo: {
    width: 52, height: 52, borderRadius: 18,
    backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, ...shadow.card,
  },
  logoText: { color: colors.accent, fontFamily: font.extra, fontSize: 26 },
  brand: { fontFamily: font.extra, fontSize: 26, color: colors.ink, letterSpacing: -0.6 },
  subtitle: { fontFamily: font.medium, fontSize: 14.5, color: colors.muted, marginTop: 6, marginBottom: 24 },

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

  switchRow: { alignItems: 'center', marginTop: 24 },
  switchText: { fontFamily: font.medium, fontSize: 13.5, color: colors.muted },
  switchBold: { fontFamily: font.bold, color: colors.ink },
});
