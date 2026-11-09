/**
 * PrivacySecurityScreen — app lock (Face ID), session control, the data
 * download, and a plain statement of how Lyne handles data. Built for a market
 * where digital trust is the whole sell. Same grouped rows as Settings.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, font, t } from '../../lib/theme';
import { useAuth } from '../../hooks/useAuth';
import { APP_LOCK_KEY } from '../../components/LockGate';
import { SettingsGroup, SettingsHeader } from '../../components/SettingsGroup';
import { confirmSignOutEverywhere, downloadMyData } from '../../lib/accountActions';

/* Face ID is Apple's name; on Android the same lock is a fingerprint or the screen lock. */
const IOS = Platform.OS === 'ios';
const BIO = IOS ? 'Face ID' : 'your fingerprint';

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
      Alert.alert(IOS ? 'Set up Face ID first' : 'Set up a screen lock first',
        IOS ? 'Add Face ID or a passcode in your device settings, then turn on App Lock.' : 'Add a fingerprint or a screen lock in your phone settings, then turn on App Lock.');
      return;
    }
    if (next) {
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to turn on App Lock' });
      if (!res.success) return;
    }
    setAppLock(next);
    AsyncStorage.setItem(APP_LOCK_KEY, next ? '1' : '0').catch(() => {});
  };

  const [exporting, setExporting] = useState(false);

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false}>
        <SettingsHeader title="Privacy and security" onBack={() => navigation.goBack()} />

        <SettingsGroup title="Security" rows={[
          { icon: 'lock', label: 'App Lock',
            sub: bioAvailable ? `Ask for ${BIO} each time Lyne opens` : IOS ? 'Set up Face ID or a passcode on this phone first' : 'Set up a fingerprint or screen lock on this phone first',
            right: <Switch value={appLock} onValueChange={toggleAppLock} trackColor={{ true: colors.accent, false: colors.border }} accessibilityLabel="App Lock" /> },
          { icon: 'shield', label: 'Protect documents', sub: `Each saved ID or TRN can ask for ${BIO} before it shows. Turn it on when you add one.` },
        ]} />

        <SettingsGroup title="Sessions" rows={[
          { icon: 'logout', label: 'Sign out of all devices', sub: 'Ends every session, including this one', tone: 'danger', busy: signingOut,
            onPress: () => confirmSignOutEverywhere(signOut, setSigningOut) },
        ]} />

        <SettingsGroup title="Your data" rows={[
          { icon: 'download', label: 'Download my data', sub: 'Everything Lyne holds about you, as a file you can keep', busy: exporting,
            onPress: async () => { setExporting(true); try { await downloadMyData(); } finally { setExporting(false); } } },
        ]} />

        <View style={{ marginTop: 26, padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft }}>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.ink, marginBottom: 6 }}>How Lyne treats your data</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 20 }}>
            Your ID and TRN stay on this phone and are never sent to Lyne; you show them at the counter yourself, and they can be locked behind {BIO}. Deleting your account erases what Lyne holds about you. We never sell your data.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
