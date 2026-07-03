import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { colors, font } from '../../lib/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'login' | 'signup'>('login');

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields'); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) Alert.alert('Login failed', error.message);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}><Text style={styles.logoMarkText}>Q</Text></View>
            <Text style={styles.logoText}>QMe Now</Text>
            <Text style={styles.logoSub}>Skip the line, not your day.</Text>
          </View>

          <View style={styles.sheet}>
            <View style={styles.tabs}>
              {(['login', 'signup'] as const).map(tb => (
                <TouchableOpacity key={tb} style={[styles.tab, tab === tb && styles.tabActive]} onPress={() => { setTab(tb); if (tb === 'signup') navigation.navigate('Signup' as never); }}>
                  <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>{tb === 'login' ? 'Sign In' : 'Sign Up'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry />
              <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  logoWrap: { alignItems: 'center', marginBottom: 30 },
  logoMark: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoMarkText: { color: colors.accentInk, fontFamily: font.extra, fontSize: 30 },
  logoText: { fontFamily: font.extra, fontSize: 28, color: '#fff', letterSpacing: -0.8 },
  logoSub: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  sheet: { backgroundColor: colors.surface, borderRadius: 26, padding: 22 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 4, marginBottom: 22 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: colors.dark },
  tabText: { fontFamily: font.bold, fontSize: 14, color: colors.muted },
  tabTextActive: { color: '#fff' },
  form: { gap: 8 },
  label: { fontFamily: font.bold, fontSize: 13, color: colors.ink, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: font.semibold, color: colors.ink, fontSize: 15 },
  btn: { backgroundColor: colors.dark, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  btnText: { fontFamily: font.extra, color: '#fff', fontSize: 15 },
});
