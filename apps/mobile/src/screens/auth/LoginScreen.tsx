import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { GlassView } from '../../components/Glass';
import { colors, font, inputReset } from '../../lib/theme';

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
      {/* neutral light source — a soft white streak from the top-right */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <GlassView tint="dark" radius={28} intensity={45} style={styles.sheet}>
            <View style={{ padding: 26, paddingVertical: 30 }}>
              <View style={styles.logo}><Text style={styles.logoText}>Q</Text></View>
              <Text style={styles.title}>Sign In</Text>
              <Text style={styles.subtitle}>Please enter your details to sign in.</Text>

              {!!error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={14} color="#ff8f8f" />
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
                placeholderTextColor="rgba(255,255,255,0.38)"
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
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={17} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity activeOpacity={0.9} style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.btnText}>Sign in</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
                <Text style={styles.switchText}>Don’t have an account?  <Text style={styles.switchBold}>Sign up</Text></Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0d0c' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 26 },
  sheet: {
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 22 }, elevation: 12,
  },
  logo: {
    width: 52, height: 52, borderRadius: 16, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  logoText: { color: colors.accent, fontFamily: font.extra, fontSize: 24 },
  title: { fontFamily: font.extra, fontSize: 24, color: '#fff', textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 7, marginBottom: 26 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(229,72,77,0.14)', borderWidth: 1, borderColor: 'rgba(229,72,77,0.28)',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 16,
  },
  errorText: { flex: 1, fontFamily: font.semibold, fontSize: 12.5, color: '#ffb4b4' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    fontFamily: font.medium, color: '#fff', fontSize: 14.5, marginBottom: 14,
  },
  inputFocused: { borderColor: 'rgba(31,194,222,0.7)', backgroundColor: 'rgba(255,255,255,0.09)' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 14 },
  passwordInput: { flex: 1, height: '100%', fontFamily: font.medium, color: '#fff', fontSize: 14.5 },
  btn: {
    backgroundColor: '#fff', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  btnText: { fontFamily: font.bold, color: colors.ink, fontSize: 15 },
  switchRow: { alignItems: 'center', marginTop: 22 },
  switchText: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  switchBold: { fontFamily: font.bold, color: '#fff' },
});
