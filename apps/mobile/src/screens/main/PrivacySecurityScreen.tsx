/**
 * PrivacySecurityScreen — app lock (Face ID), session control, and a plain
 * statement of how Lyne handles data. Built for a market where digital trust is
 * the whole sell.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { APP_LOCK_KEY } from '../../components/LockGate';

function Row({ icon, title, sub, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; right: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSoft }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={colors.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
      </View>
      {right}
    </View>
  );
}

export default function PrivacySecurityScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
  const [appLock, setAppLock] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(APP_LOCK_KEY).then(v => setAppLock(v === '1'));
    Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()])
      .then(([hw, enrolled]) => setBioAvailable(hw && enrolled));
  }, []);

  const toggleAppLock = async (next: boolean) => {
    if (next && !bioAvailable) {
      Alert.alert('Set up Face ID first', 'Add Face ID or a passcode in your device settings, then turn on App Lock.');
      return;
    }
    if (next) {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to turn on App Lock' });
      if (!res.success) return;
    }
    setAppLock(next);
    AsyncStorage.setItem(APP_LOCK_KEY, next ? '1' : '0').catch(() => {});
  };

  const signOutEverywhere = () => Alert.alert(
    'Sign out of all devices',
    'This ends every active session. You’ll need to sign in again everywhere.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out all', style: 'destructive', onPress: async () => {
      try { setSigningOut(true); await api.post('/auth/force-signout', {}); } catch { /* still sign out locally */ }
      finally { setSigningOut(false); await signOut(); }
    } }],
  );

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={t.iconBtn}><Ionicons name="chevron-back" size={20} color={colors.ink} /></TouchableOpacity>
          <Text style={t.h2}>Privacy & security</Text>
        </View>

        <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 }}>Security</Text>
        <View style={[t.card, { overflow: 'hidden', ...shadow.card }]}>
          <Row
            icon="lock-closed-outline"
            title="App Lock"
            sub={bioAvailable ? 'Require Face ID each time you open Lyne' : 'Set up Face ID / a passcode on your device to use this'}
            right={<Switch value={appLock} onValueChange={toggleAppLock} trackColor={{ true: colors.accent, false: colors.border }} />}
          />
          <Row
            icon="finger-print-outline"
            title="Protect documents"
            sub="Saved ID/TRN can require Face ID to view — toggle it when you add each document"
            right={<Ionicons name="checkmark-circle" size={20} color={colors.light} />}
          />
        </View>

        <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 28, marginBottom: 12, marginLeft: 4 }}>Sessions</Text>
        <TouchableOpacity onPress={signOutEverywhere} disabled={signingOut} style={[t.card, { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, ...shadow.card }]}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Sign out of all devices</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>End every active session everywhere</Text>
          </View>
          {signingOut ? <ActivityIndicator color={colors.danger} /> : <Ionicons name="chevron-forward" size={18} color={colors.chevron} />}
        </TouchableOpacity>

        <Text style={{ fontFamily: font.extra, fontSize: 11.5, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 28, marginBottom: 12, marginLeft: 4 }}>Your data</Text>
        <View style={[t.card, { padding: 18, ...shadow.card }]}>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 20 }}>
            Your card details never touch our servers — they’re handled directly by Stripe. Your ID and TRN are shared only with the agency serving you, to verify you at the counter, and can be locked behind Face ID. We never sell your data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
