/**
 * ProfileScreen — User profile and intake form data.
 *
 * This screen doubles as the user's personal information store.
 * All fields saved here are used to pre-fill join-queue intake forms
 * so users never have to re-enter standard information.
 *
 * Fields stored:
 *  - full_name, email (from Supabase Auth — read-only display)
 *  - phone, date_of_birth, address
 *  - national_id (National ID / Passport)
 *  - trn (Tax Registration Number — used by TAJ services)
 *  - employer, occupation (used by NHT services)
 *
 * On save: PATCH /api/auth/profile → MySQL users table
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/apiClient';

interface ProfileFields {
  full_name: string;
  phone: string;
  date_of_birth: string;
  address: string;
  national_id: string;
  trn: string;
  employer: string;
  occupation: string;
}

const EMPTY: ProfileFields = {
  full_name: '', phone: '', date_of_birth: '',
  address: '', national_id: '', trn: '',
  employer: '', occupation: '',
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [fields, setFields] = useState<ProfileFields>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty]   = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (user) {
      setFields({
        full_name:     user.full_name              || '',
        phone:         (user as any).phone         || '',
        date_of_birth: (user as any).date_of_birth || '',
        address:       (user as any).address       || '',
        national_id:   user.national_id            || '',
        trn:           user.trn                    || '',
        employer:      (user as any).employer      || '',
        occupation:    (user as any).occupation    || '',
      });
    }
  }, [user]);

  const update = (key: keyof ProfileFields, val: string) => {
    setFields(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/profile', fields);
      setDirty(false);
      setSaved(true);
      Alert.alert('Saved', 'Your profile has been updated. Forms will be pre-filled automatically.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'ME';

  const profileComplete = !!(fields.full_name && fields.phone && fields.national_id);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.full_name || 'My Profile'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.profileBadge, profileComplete && styles.profileBadgeComplete]}>
            <Text style={[styles.profileBadgeText, profileComplete && styles.profileBadgeTextComplete]}>
              {profileComplete
                ? '✓ Profile complete — forms pre-filled automatically'
                : 'Complete your profile to speed up queue joining'}
            </Text>
          </View>
        </View>

        {/* ── Personal Information ── */}
        <Text style={styles.sectionLabel}>Personal Information</Text>

        <Text style={styles.fieldLabel}>Full Name</Text>
        <TextInput style={styles.input} value={fields.full_name}
          onChangeText={v => update('full_name', v)}
          placeholder="e.g. Marcus Thompson"
          placeholderTextColor="rgba(255,255,255,0.2)" autoCapitalize="words" />

        <Text style={styles.fieldLabel}>Phone Number</Text>
        <TextInput style={styles.input} value={fields.phone}
          onChangeText={v => update('phone', v)}
          placeholder="e.g. 876-555-0123"
          placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="phone-pad" />

        <Text style={styles.fieldLabel}>Date of Birth</Text>
        <TextInput style={styles.input} value={fields.date_of_birth}
          onChangeText={v => update('date_of_birth', v)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="rgba(255,255,255,0.2)" />

        <Text style={styles.fieldLabel}>Address</Text>
        <TextInput style={[styles.input, styles.inputMultiline]} value={fields.address}
          onChangeText={v => update('address', v)}
          placeholder="e.g. 12 Hope Road, Kingston 6"
          placeholderTextColor="rgba(255,255,255,0.2)" multiline numberOfLines={2} />

        {/* ── Government IDs ── */}
        <Text style={styles.sectionLabel}>Government IDs</Text>
        <Text style={styles.sectionNote}>
          Stored securely and used to pre-fill TAJ, NHT, and PICA forms automatically.
        </Text>

        <Text style={styles.fieldLabel}>National ID / Passport Number</Text>
        <TextInput style={styles.input} value={fields.national_id}
          onChangeText={v => update('national_id', v)}
          placeholder="e.g. 123456789"
          placeholderTextColor="rgba(255,255,255,0.2)" autoCapitalize="characters" />

        <Text style={styles.fieldLabel}>TRN (Tax Registration Number)</Text>
        <TextInput style={styles.input} value={fields.trn}
          onChangeText={v => update('trn', v)}
          placeholder="e.g. 123-456-789"
          placeholderTextColor="rgba(255,255,255,0.2)" keyboardType="numeric" />

        {/* ── Employment ── */}
        <Text style={styles.sectionLabel}>Employment</Text>
        <Text style={styles.sectionNote}>Used by NHT and housing-related services.</Text>

        <Text style={styles.fieldLabel}>Employer</Text>
        <TextInput style={styles.input} value={fields.employer}
          onChangeText={v => update('employer', v)}
          placeholder="e.g. Ministry of Finance"
          placeholderTextColor="rgba(255,255,255,0.2)" autoCapitalize="words" />

        <Text style={styles.fieldLabel}>Occupation</Text>
        <TextInput style={styles.input} value={fields.occupation}
          onChangeText={v => update('occupation', v)}
          placeholder="e.g. Accountant"
          placeholderTextColor="rgba(255,255,255,0.2)" autoCapitalize="words" />

        {/* Save button */}
        {dirty && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
        )}

        {saved && !dirty && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>
              ✓ Profile saved — forms will be pre-filled when you join a queue
            </Text>
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content:   { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 },

  avatarWrap: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#a78bfa', fontSize: 28, fontWeight: '700' },
  name:  { color: '#fff', fontSize: 20, fontWeight: '700' },
  email: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 12 },

  profileBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  profileBadgeComplete: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.28)',
  },
  profileBadgeText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
  profileBadgeTextComplete: { color: '#6ee7b7' },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 28, marginBottom: 4,
  },
  sectionNote: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12, lineHeight: 18 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: '#fff', fontSize: 15,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top', paddingTop: 12 },

  saveBtn: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },

  savedBanner: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    borderRadius: 12, padding: 14, marginTop: 16,
  },
  savedBannerText: { color: '#6ee7b7', fontSize: 13, textAlign: 'center' },

  signOutBtn: {
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 32,
  },
  signOutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
});
