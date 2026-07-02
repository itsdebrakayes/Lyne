import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { brandGradient } from '../../lib/mobileV3Styles';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<'login' | 'signup'>('login');

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  };

  return (
    <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>Q</Text></View>
            <Text style={styles.logoText}>QME Now</Text>
            <Text style={styles.logoSub}>Skip the wait. Join from anywhere.</Text>
          </View>

          <View style={styles.sheet}>
            {/* Tab switcher */}
            <View style={styles.tabs}>
              {(['login', 'signup'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => { setTab(t); if (t === 'signup') navigation.navigate('Signup' as never); }}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'login' ? 'Sign In' : 'Sign Up'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#a7a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#a7a3b8"
                secureTextEntry
              />

              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Sign In</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  inner:        { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  logoWrap:     { alignItems: 'center', marginBottom: 30 },
  logoMark:     { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoMarkText: { color: '#6b4eff', fontSize: 30, fontWeight: '900' },
  logoText:     { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  logoSub:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  sheet:        { backgroundColor: '#fff', borderRadius: 26, padding: 22, shadowColor: '#2a2350', shadowOpacity: 0.2, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  tabs:         { flexDirection: 'row', backgroundColor: '#f0eefa', borderRadius: 14, padding: 4, marginBottom: 22 },
  tab:          { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 11 },
  tabActive:    { backgroundColor: '#7b5fff' },
  tabText:      { color: '#7b7890', fontSize: 14, fontWeight: '700' },
  tabTextActive:{ color: '#fff' },
  form:         { gap: 8 },
  label:        { color: '#16141f', fontSize: 13, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  input:        { backgroundColor: '#f4f3f8', borderWidth: 1, borderColor: '#e7e5f0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#16141f', fontSize: 15 },
  btn:          { backgroundColor: '#7b5fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 22, shadowColor: '#6b4eff', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#fff', fontWeight: '800', fontSize: 15 },
});
