/**
 * LoginScreen — brand-framed sign in.
 *
 * Carries the welcome screen's visual language onto auth: a white canvas with
 * the QMe brand-tile mosaic bleeding in from the top and bottom edges (you see
 * half of it at each end), fading into white around a centred QMe Now lockup,
 * the sign-in form, and one black button — the same forest button as the
 * intro's "Start queuing".
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../lib/ThemeProvider';
import { colors, font, shadow, inputReset } from '../../lib/theme';

type Tile = { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string };

// Two rows of brand tiles — one frames the top edge, one the bottom.
const TOP_TILES: Tile[] = [
  { icon: 'ticket', bg: colors.dark, fg: colors.accent },
  { icon: 'time-outline', bg: '#ffffff', fg: colors.accentDeep },
  { icon: 'barcode-outline', bg: colors.accent, fg: colors.accentInk },
  { icon: 'location', bg: colors.dark, fg: '#ffffff' },
  { icon: 'notifications', bg: '#ffffff', fg: colors.accentDeep },
];
const BOTTOM_TILES: Tile[] = [
  { icon: 'qr-code-outline', bg: colors.dark, fg: '#ffffff' },
  { icon: 'people-outline', bg: colors.accent, fg: colors.accentInk },
  { icon: 'sparkles', bg: '#ffffff', fg: colors.accentDeep },
  { icon: 'navigate', bg: colors.dark, fg: colors.accent },
  { icon: 'checkmark-done', bg: colors.accent, fg: colors.accentInk },
];

function MotifRow({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 13, transform: [{ rotate: '-7deg' }] }}>
      {tiles.map((tile, index) => (
        <View
          key={index}
          style={{
            width: 84, height: 84, borderRadius: 25, backgroundColor: tile.bg,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: tile.bg === '#ffffff' ? 1 : 0, borderColor: colors.border,
            ...shadow.card,
          }}
        >
          <Ionicons name={tile.icon} size={31} color={tile.fg} />
        </View>
      ))}
    </View>
  );
}

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
      {/* top motif — brand tiles bleeding off the top edge, fading into white */}
      <View style={styles.topMotif} pointerEvents="none"><MotifRow tiles={TOP_TILES} /></View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', colors.surface]}
        locations={[0, 0.82]}
        style={styles.topFade}
      />

      {/* bottom motif — mirrored off the bottom edge */}
      <View style={styles.bottomMotif} pointerEvents="none"><MotifRow tiles={BOTTOM_TILES} /></View>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.surface, 'rgba(255,255,255,0)']}
        locations={[0.18, 1]}
        style={styles.bottomFade}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          {/* brand lockup */}
          <View style={styles.logo}><Text style={styles.logoText}>Q</Text></View>
          <Text style={styles.brand}>QMe Now</Text>
          <Text style={styles.subtitle}>Sign in to skip the line.</Text>

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
  container: { flex: 1, backgroundColor: colors.surface },

  topMotif: { position: 'absolute', top: -46, left: -44, right: -44, alignItems: 'center' },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 210 },
  bottomMotif: { position: 'absolute', bottom: -46, left: -44, right: -44, alignItems: 'center' },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 210 },

  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },

  logo: {
    width: 58, height: 58, borderRadius: 20, alignSelf: 'center',
    backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, ...shadow.card,
  },
  logoText: { color: colors.accent, fontFamily: font.extra, fontSize: 26 },
  brand: { fontFamily: font.extra, fontSize: 24, color: colors.ink, textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontFamily: font.medium, fontSize: 14.5, color: colors.muted, textAlign: 'center', marginTop: 7, marginBottom: 28 },

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
  inputFocused: { borderColor: colors.accent, backgroundColor: '#ffffff' },
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
