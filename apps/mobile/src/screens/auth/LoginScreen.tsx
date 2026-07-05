import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors, font, inputReset, shadow } from '../../lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    setLoading(true); setError('');
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError.message === 'Invalid login credentials' ? 'That email and password don’t match. Try again.' : signInError.message);
  };

  return (
    <View style={styles.container}>
      {/* background layers must never intercept touches */}
      <LinearGradient pointerEvents="none" colors={['#0b1512', '#101d18', '#15231c']} style={StyleSheet.absoluteFill} />
      <Text pointerEvents="none" style={styles.ghost}>Q</Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <View style={styles.logoRing}><Text style={styles.logoRingText}>Q</Text></View>
            <Text style={styles.wordmark}>QME NOW</Text>
            <Text style={styles.tagline}>Skip the line, not your day.</Text>
          </View>

          <View style={styles.sheet}>
            <Text style={styles.overline}>WELCOME BACK</Text>
            <Text style={styles.title}>Sign in</Text>

            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={[styles.input, focused === 'email' && styles.inputFocused, inputReset]}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              placeholder="you@example.com"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={styles.label}>PASSWORD</Text>
            <View style={[styles.input, styles.passwordRow, focused === 'password' && styles.inputFocused]}>
              <TextInput
                style={[styles.passwordInput, inputReset]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
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
                  <View style={styles.btnChip}><Ionicons name="arrow-forward" size={17} color={colors.accentInk} /></View>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.switchText}>New to QMe Now?  <Text style={styles.switchBold}>Create an account</Text></Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footnote}>Live queues · Real wait times · Arrive on time</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101d18' },
  ghost: {
    position: 'absolute', top: -60, right: -70,
    fontFamily: font.extra, fontSize: 420, color: 'rgba(255,255,255,0.025)',
  },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 34 },
  logoRing: {
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 1.5, borderColor: 'rgba(31,194,222,0.55)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  logoRingText: { color: colors.accent, fontFamily: font.extra, fontSize: 32 },
  wordmark: { fontFamily: font.extra, fontSize: 24, color: '#fff', letterSpacing: 6 },
  tagline: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8, letterSpacing: 0.3 },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.985)', borderRadius: 32, padding: 26, paddingTop: 24,
    ...shadow.hero,
  },
  overline: { fontFamily: font.extra, fontSize: 10.5, color: colors.accentDeep, letterSpacing: 2 },
  title: { fontFamily: font.extra, fontSize: 27, color: colors.ink, letterSpacing: -0.6, marginTop: 4, marginBottom: 18 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fdf0ef', borderWidth: 1, borderColor: '#f5d8d6',
    borderRadius: 13, padding: 11, marginBottom: 14,
  },
  errorText: { flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: '#b3383d', lineHeight: 17 },
  label: { fontFamily: font.extra, fontSize: 10.5, color: colors.muted, letterSpacing: 1.4, marginBottom: 7, marginTop: 6 },
  input: {
    backgroundColor: colors.fieldBg, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 16, paddingHorizontal: 16, height: 54,
    fontFamily: font.semibold, color: colors.ink, fontSize: 15, marginBottom: 12,
  },
  inputFocused: { borderColor: colors.accentDeep, backgroundColor: '#fff' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  passwordInput: { flex: 1, height: '100%', fontFamily: font.semibold, color: colors.ink, fontSize: 15 },
  btn: {
    backgroundColor: colors.dark, borderRadius: 18, height: 58,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 22, paddingRight: 8, marginTop: 12,
  },
  btnText: { fontFamily: font.extra, color: '#fff', fontSize: 15.5 },
  btnChip: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  switchBold: { fontFamily: font.extra, color: colors.ink },
  footnote: {
    fontFamily: font.bold, fontSize: 11, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 26, letterSpacing: 0.8,
  },
});
