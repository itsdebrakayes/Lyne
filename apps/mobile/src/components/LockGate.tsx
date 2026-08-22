/**
 * LockGate — optional Face ID / biometric lock on app open.
 *
 * When App Lock is enabled (Privacy & Security), the app requires a biometric
 * unlock at launch before revealing anything. If no biometrics are enrolled we
 * fail open (never lock the user out of their own account).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../lib/theme';

export const APP_LOCK_KEY = 'qme.app-lock';

export function LockGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');

  const attempt = async () => {
    const enabled = (await AsyncStorage.getItem(APP_LOCK_KEY)) === '1';
    if (!enabled) { setState('open'); return; }
    const [hasHw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    if (!hasHw || !enrolled) { setState('open'); return; }
    setState('locked');
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Lyne' });
    setState(res.success ? 'open' : 'locked');
  };

  useEffect(() => { attempt(); }, []);

  if (state === 'open') return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Ionicons name="lock-closed" size={30} color={colors.accent} />
      </View>
      <Text style={{ fontFamily: font.extra, fontSize: 20, color: '#fff', letterSpacing: -0.3 }}>Lyne is locked</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,.6)', marginTop: 8, textAlign: 'center' }}>Unlock with Face ID to continue.</Text>
      {state === 'locked' ? (
        <TouchableOpacity onPress={attempt} style={{ marginTop: 26, backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="scan" size={17} color={colors.accentInk} />
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Unlock</Text>
        </TouchableOpacity>
      ) : (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      )}
    </View>
  );
}
