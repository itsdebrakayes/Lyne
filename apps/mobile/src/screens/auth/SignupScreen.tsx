import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { colors, font } from '../../lib/theme';

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!fullName || !email || !password) { setError('Please fill in all fields.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    try {
      const { error: signupError } = await signUp(email, password, fullName);
      if (signupError) throw signupError;
    } catch (e: any) {
      setError(e.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>Q</Text></View>
          </View>
          <View style={styles.sheet}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join QMe Now to skip the wait</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.muted} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor={colors.muted} value={confirm} onChangeText={setConfirm} secureTextEntry />
            <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  logoWrap: { alignItems: 'center', marginBottom: 22 },
  logoMark: { width: 60, height: 60, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { color: colors.accentInk, fontFamily: font.extra, fontSize: 28 },
  sheet: { backgroundColor: colors.surface, borderRadius: 26, padding: 22 },
  title: { fontFamily: font.extra, fontSize: 26, color: colors.ink, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontFamily: font.medium, fontSize: 15, color: colors.muted, marginBottom: 24 },
  error: { fontFamily: font.bold, color: colors.danger, marginBottom: 16, fontSize: 14 },
  input: { backgroundColor: colors.fieldBg, borderRadius: 14, padding: 14, fontFamily: font.semibold, color: colors.ink, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  button: { backgroundColor: colors.dark, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 18 },
  buttonText: { fontFamily: font.extra, color: '#fff', fontSize: 16 },
  link: { fontFamily: font.medium, color: colors.muted, textAlign: 'center', fontSize: 14 },
  linkBold: { fontFamily: font.bold, color: colors.accentDeep },
});
