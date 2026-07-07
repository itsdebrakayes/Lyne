import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { GlassView } from '../../components/Glass';
import { colors, font, inputReset } from '../../lib/theme';

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
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <GlassView tint="dark" radius={28} intensity={45} style={styles.sheet}>
            <View style={{ padding: 26, paddingVertical: 30 }}>
              <View style={styles.logo}><Text style={styles.logoText}>Q</Text></View>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>A few details and you’re ready to skip the line.</Text>

              {!!error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={14} color="#ff8f8f" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TextInput style={fieldStyle('name')} {...focusProps('name')} placeholder="Full name" placeholderTextColor="rgba(255,255,255,0.38)" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" />
              <TextInput style={fieldStyle('email')} {...focusProps('email')} placeholder="Enter your email address" placeholderTextColor="rgba(255,255,255,0.38)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <TextInput style={fieldStyle('password')} {...focusProps('password')} placeholder="Password (min. 8 characters)" placeholderTextColor="rgba(255,255,255,0.38)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
              <TextInput style={fieldStyle('confirm')} {...focusProps('confirm')} placeholder="Confirm password" placeholderTextColor="rgba(255,255,255,0.38)" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />

              <TouchableOpacity activeOpacity={0.9} style={[styles.btn, loading && { opacity: 0.7 }]} onPress={handleSignup} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.btnText}>Create account</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={styles.switchRow} hitSlop={{ top: 8, bottom: 8 }}>
                <Text style={styles.switchText}>Already a member?  <Text style={styles.switchBold}>Sign in</Text></Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0d0c' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 40 },
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
  btn: {
    backgroundColor: '#fff', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  btnText: { fontFamily: font.bold, color: colors.ink, fontSize: 15 },
  switchRow: { alignItems: 'center', marginTop: 22 },
  switchText: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  switchBold: { fontFamily: font.bold, color: '#fff' },
});
