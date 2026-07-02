import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { brandGradient } from '../../lib/mobileV3Styles';

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const { signUp } = useAuth();
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      setError('Please fill in all fields.'); return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.'); return;
    }
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
    <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>Q</Text></View>
          </View>
          <View style={styles.sheet}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join QME Now to skip the wait</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#a7a3b8"
              value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#a7a3b8"
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#a7a3b8"
              value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor="#a7a3b8"
              value={confirm} onChangeText={setConfirm} secureTextEntry />
            <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  inner:      { flexGrow: 1, justifyContent: 'center', padding: 22 },
  logoWrap:   { alignItems: 'center', marginBottom: 22 },
  logoMark:   { width: 60, height: 60, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { color: '#6b4eff', fontSize: 28, fontWeight: '900' },
  sheet:      { backgroundColor: '#fff', borderRadius: 26, padding: 22, shadowColor: '#2a2350', shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  title:      { fontSize: 26, fontWeight: '800', color: '#16141f', marginBottom: 6, letterSpacing: -0.5 },
  subtitle:   { fontSize: 15, color: '#7b7890', marginBottom: 24 },
  error:      { color: '#e5484d', marginBottom: 16, fontSize: 14, fontWeight: '600' },
  input:      { backgroundColor: '#f4f3f8', borderRadius: 14, padding: 14,
                color: '#16141f', fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: '#e7e5f0' },
  button:     { backgroundColor: '#7b5fff', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 18, shadowColor: '#6b4eff', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link:       { color: '#7b7890', textAlign: 'center', fontSize: 14 },
  linkBold:   { color: '#5a3ff0', fontWeight: '700' },
});
