/**
 * DeleteAccountScreen — in-app account deletion.
 *
 * App Store Guideline 5.1.1(v): an app that lets you create an account must let
 * you delete it from inside the app. Not deactivation, and not "email support".
 *
 * The screen states plainly what goes and what stays before asking, then
 * requires the word DELETE to be typed, because this cannot be undone.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, shadow, t } from '../../lib/theme';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';

const CONFIRM_WORD = 'DELETE';

const REMOVED = [
  'Your name, email and phone number',
  'Any ID or TRN you saved, and the photos of them',
  'Your saved businesses and recent searches',
  'Your notifications and this device’s reminders',
  'Any saved payment method',
  'Your visit history',
  'Your sign-in record',
];

const KEPT = [
  'Businesses you have already visited keep a record of that visit for their own reporting. After deletion it is no longer linked to you, your name, or anything that identifies you.',
];

function Bullet({ text, tone }: { text: string; tone: 'removed' | 'kept' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 9 }}>
      <Ionicons
        name={tone === 'removed' ? 'close-circle' : 'information-circle'}
        size={16}
        color={tone === 'removed' ? colors.danger : colors.muted}
        style={{ marginTop: 1.5 }}
      />
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export default function DeleteAccountScreen() {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const ready = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const runDeletion = async () => {
    setError('');
    setDeleting(true);
    try {
      await api.delete('/auth/account');
      // The account is gone server-side; clear the local session so the app
      // returns to the signed-out state rather than holding a dead token.
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your account could not be deleted. Nothing was changed.');
      setDeleting(false);
    }
  };

  const confirm = () => Alert.alert(
    'Delete your account?',
    'This removes your account and personal information immediately. It cannot be undone.',
    [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: runDeletion },
    ],
  );

  return (
    <View style={t.root}>
      <ScrollView contentContainerStyle={t.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={t.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={t.h2}>Delete account</Text>
        </View>

        <View style={[t.card, { padding: 18, ...shadow.card }]}>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginBottom: 12 }}>What gets deleted</Text>
          {REMOVED.map((item) => <Bullet key={item} text={item} tone="removed" />)}
        </View>

        <View style={[t.card, { padding: 18, marginTop: 16, ...shadow.card }]}>
          <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink, marginBottom: 12 }}>What stays</Text>
          {KEPT.map((item) => <Bullet key={item} text={item} tone="kept" />)}
        </View>

        <View style={[t.card, { padding: 18, marginTop: 16, ...shadow.card }]}>
          <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.sub, lineHeight: 20 }}>
            Deletion happens straight away and cannot be undone. If you are in a queue right now, leave it first.
          </Text>
          <Text style={{ fontFamily: font.extra, fontSize: 12.5, color: colors.ink, marginTop: 16, marginBottom: 8 }}>
            Type {CONFIRM_WORD} to confirm
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={colors.faint}
            accessibilityLabel={`Type ${CONFIRM_WORD} to confirm account deletion`}
            style={{
              borderWidth: 1,
              borderColor: ready ? colors.danger : colors.border,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontFamily: font.bold,
              fontSize: 15,
              color: colors.ink,
              letterSpacing: 1.5,
            }}
          />
        </View>

        {error ? (
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.danger, marginTop: 14, lineHeight: 19 }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={confirm}
          disabled={!ready || deleting}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || deleting }}
          style={{
            marginTop: 20,
            backgroundColor: ready ? colors.danger : colors.surfaceAlt,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: deleting ? 0.7 : 1,
          }}
        >
          {deleting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontFamily: font.extra, fontSize: 15, color: ready ? '#fff' : colors.muted }}>Delete my account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 14, alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.muted }}>Keep my account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
