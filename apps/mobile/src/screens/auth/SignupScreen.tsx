import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors, font, inputReset, shadow } from '../../lib/theme';

type Field = 'name' | 'email' | 'password' | 'confirm';

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [focused, setFocused] = useState<Field | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password) { setError('Fill in your name, email, and a password to join.'); return; }
    if (password.length < 8) { setError('Your password needs at least 8 characters.'); return; }
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setLoading(true); setError(null);
    try {
      const { error: signupError } = await signUp(email.trim(), password, fullName.trim());
      if (signupError) throw signupError;
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
      {/* background layers must never intercept touches */}
      <LinearGradient pointerEvents="none" colors={['#0b1512', '#101d18', '#15231c']} style={StyleSheet.absoluteFill} />
      <Text pointerEvents="none" style={styles.ghost}>Q</Text>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.logoWrap}>
            <View style={styles.logoRing}><Text style={styles.logoRingText}>Q</Text></View>
            <Text style={styles.wordmark}>QME NOW</Text>
          </View>

          <View style={styles.sheet}>
            <Text style={styles.overline}>BEGIN YOUR MEMBERSHIP</Text>
            <Text style={styles.title}>Create account</Text>

            {!!error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>FULL NAME</Text>
            <TextInput style={fieldStyle('name')} {...focusProps('name')} placeholder="Your name" placeholderTextColor={colors.faint} value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" />

            <Text style={styles.label}>EMAIL</Text>
            <TextInput style={fieldStyle('email')} {...focusProps('email')} placeholder="you@example.com" placeholderTextColor={colors.faint} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput style={fieldStyle('password')} {...focusProps('password')} placeholder="At least 8 characters" placeholderTextColor={colors.faint} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput style={fieldStyle('confirm')} {...focusProps('confirm')} placeholder="Repeat your password" placeholderTextColor={colors.faint} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />

            <TouchableOpacity activeOpacity={0.9} style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.btnText}>Create account</Text>
                  <View style={styles.btnChip}><Ionicons name="arrow-forward" size={17} color={colors.accentInk} /></View>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.switchText}>Already a member?  <Text style={styles.switchBold}>Sign in</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 26 },
  logoRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, borderColor: 'rgba(31,194,222,0.55)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  logoRingText: { color: colors.accent, fontFamily: font.extra, fontSize: 28 },
  wordmark: { fontFamily: font.extra, fontSize: 20, color: '#fff', letterSpacing: 5 },
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
});
