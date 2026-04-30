import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>Q ME NOW</Text>
          <Text style={styles.logoSub}>Skip the wait. Join from anywhere.</Text>
        </View>

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
            placeholderTextColor="rgba(255,255,255,0.3)"
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
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
          />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  inner:        { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logoWrap:     { alignItems: 'center', marginBottom: 40 },
  logoText:     { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  logoSub:      { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
  tabs:         { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 24 },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive:    { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabText:      { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '500' },
  tabTextActive:{ color: '#fff' },
  form:         { gap: 8 },
  label:        { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 4, marginTop: 8 },
  input:        { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15 },
  btn:          { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#000', fontWeight: '700', fontSize: 15 },
});
