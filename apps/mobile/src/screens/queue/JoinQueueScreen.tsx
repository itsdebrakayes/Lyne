/**
 * JoinQueueScreen — Smart intake form for joining a queue.
 *
 * Flow:
 *  1. Fetch the service's required_fields list from the backend
 *  2. Load the user's saved profile (from useAuth)
 *  3. Pre-fill all fields that the profile already covers
 *  4. Only render input fields for values MISSING from the profile
 *     OR that are service-specific extras (e.g. "reason_for_visit")
 *  5. On submit: merge profile data + any extra answers → POST /api/tickets
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/apiClient';
import { useAuth } from '../../hooks/useAuth';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'JoinQueue'>;

// Standard profile fields — pre-filled from profile, never re-asked if present
const PROFILE_KEYS = [
  'full_name', 'phone', 'date_of_birth', 'address',
  'national_id', 'trn', 'employer', 'occupation',
] as const;

interface ExtraField {
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  type?: 'text' | 'number' | 'date';
}

interface ServiceInfo {
  id: string;
  name: string;
  description?: string;
  avg_wait_minutes?: number;
  intake_schema?: ExtraField[];
  required_profile_fields?: string[];
}

interface QueueInfo {
  id: string;
  waiting_count: number;
  estimated_wait_minutes: number;
}

export default function JoinQueueScreen() {
  const route = useRoute<Params>();
  const nav   = useNavigation<any>();
  const { businessId, branchId, serviceId, serviceName } = route.params;
  const { user } = useAuth();

  const { data: service, isLoading: loadingService } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => api.get<ServiceInfo>(`/services/${serviceId}`),
  });

  const { data: queueInfo } = useQuery({
    queryKey: ['queue-info', branchId, serviceId],
    queryFn: () => api.get<QueueInfo>(`/queues/live?branch_id=${branchId}&service_id=${serviceId}`),
    refetchInterval: 15_000,
  });

  // Service-specific fields NOT covered by the profile
  const extraFields: ExtraField[] = useMemo(() => {
    if (!service) return [];
    return (service.intake_schema || []).filter(f => !PROFILE_KEYS.includes(f.key as any));
  }, [service]);

  // Profile fields this service requires but user hasn't filled yet
  const missingProfileFields: string[] = useMemo(() => {
    if (!service || !user) return [];
    const required = service.required_profile_fields || [];
    return required.filter(key => !(user as any)[key]);
  }, [service, user]);

  const [extraAnswers, setExtraAnswers]     = useState<Record<string, string>>({});
  const [missingAnswers, setMissingAnswers] = useState<Record<string, string>>({});

  const hasAnythingToFill = extraFields.length > 0 || missingProfileFields.length > 0;

  const joinMutation = useMutation({
    mutationFn: () => {
      const profileData: Record<string, string> = {};
      PROFILE_KEYS.forEach(k => {
        const val = (user as any)?.[k];
        if (val) profileData[k] = val;
      });
      const form_data = { ...profileData, ...missingAnswers, ...extraAnswers };
      return api.post<{ id: string; ticket_number: string }>('/tickets', {
        business_id: businessId,
        branch_id:   branchId,
        service_id:  serviceId,
        form_data,
      });
    },
    onSuccess: (ticket) => nav.navigate('Ticket', { ticketId: ticket.id }),
    onError: (e: Error) => Alert.alert('Could not join queue', e.message),
  });

  const handleJoin = () => {
    const missingRequired = extraFields
      .filter(f => f.required && !extraAnswers[f.key]?.trim())
      .map(f => f.label);
    const missingProfileRequired = missingProfileFields.filter(k => !missingAnswers[k]?.trim());
    if (missingRequired.length > 0 || missingProfileRequired.length > 0) {
      Alert.alert('Required fields missing', 'Please fill in all required fields before joining.');
      return;
    }
    joinMutation.mutate();
  };

  if (loadingService) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.loadingText}>Loading service details…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Join Queue</Text>
        <Text style={styles.serviceName}>{serviceName || service?.name}</Text>
        {service?.description && <Text style={styles.serviceDesc}>{service.description}</Text>}

        {/* Live queue stats */}
        {queueInfo && (
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statVal}>{queueInfo.waiting_count}</Text>
              <Text style={styles.statLbl}>Ahead of you</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statVal}>~{queueInfo.estimated_wait_minutes} min</Text>
              <Text style={styles.statLbl}>Est. wait</Text>
            </View>
          </View>
        )}

        {/* Pre-fill confirmation */}
        {user && !hasAnythingToFill && (
          <View style={styles.prefillBanner}>
            <Text style={styles.prefillIcon}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefillTitle}>Ready to join</Text>
              <Text style={styles.prefillSub}>
                Your profile details will be submitted automatically — no extra information needed.
              </Text>
            </View>
          </View>
        )}

        {/* Missing profile fields */}
        {missingProfileFields.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>A few details needed</Text>
            <Text style={styles.sectionNote}>
              These will be saved to your profile for next time.
            </Text>
            {missingProfileFields.map(key => (
              <View key={key}>
                <Text style={styles.fieldLabel}>{formatFieldLabel(key)}</Text>
                <TextInput
                  style={styles.input}
                  value={missingAnswers[key] || ''}
                  onChangeText={v => setMissingAnswers(prev => ({ ...prev, [key]: v }))}
                  placeholder={getFieldPlaceholder(key)}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType={key === 'trn' ? 'numeric' : 'default'}
                />
              </View>
            ))}
          </View>
        )}

        {/* Service-specific extra fields */}
        {extraFields.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{serviceName} — Additional Information</Text>
            {extraFields.map(f => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}{f.required ? ' *' : ''}</Text>
                <TextInput
                  style={styles.input}
                  value={extraAnswers[f.key] || ''}
                  onChangeText={v => setExtraAnswers(prev => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder || ''}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                />
              </View>
            ))}
          </View>
        )}

        {/* What happens next */}
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>What happens next</Text>
          <Text style={styles.nextStep}>1. You'll receive a ticket number instantly</Text>
          <Text style={styles.nextStep}>2. Watch your position update in real time</Text>
          <Text style={styles.nextStep}>3. You'll be notified when it's your turn</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, joinMutation.isPending && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={joinMutation.isPending}
        >
          {joinMutation.isPending
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.btnText}>Confirm & Join Queue</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatFieldLabel(key: string): string {
  const map: Record<string, string> = {
    full_name: 'Full Name', phone: 'Phone Number', date_of_birth: 'Date of Birth',
    address: 'Address', national_id: 'National ID / Passport', trn: 'TRN',
    employer: 'Employer', occupation: 'Occupation',
  };
  return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getFieldPlaceholder(key: string): string {
  const map: Record<string, string> = {
    full_name: 'e.g. Marcus Thompson', phone: 'e.g. 876-555-0123',
    date_of_birth: 'YYYY-MM-DD', address: 'e.g. 12 Hope Road, Kingston 6',
    national_id: 'e.g. 123456789', trn: 'e.g. 123-456-789',
    employer: 'e.g. Ministry of Finance', occupation: 'e.g. Accountant',
  };
  return map[key] ?? '';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content:   { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 60 },

  loadingWrap: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },

  back:        { marginBottom: 24 },
  backText:    { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:       { fontSize: 26, fontWeight: '700', color: '#fff' },
  serviceName: { fontSize: 18, fontWeight: '600', color: '#60a5fa', marginTop: 4 },
  serviceDesc: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, alignItems: 'center' },
  statVal:  { color: '#60a5fa', fontSize: 20, fontWeight: '800' },
  statLbl:  { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  prefillBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    borderRadius: 14, padding: 16, marginBottom: 24,
  },
  prefillIcon:  { fontSize: 20, color: '#6ee7b7' },
  prefillTitle: { color: '#6ee7b7', fontWeight: '700', fontSize: 14 },
  prefillSub:   { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3, lineHeight: 18 },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  sectionNote: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12, lineHeight: 18 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: '#fff', fontSize: 15,
  },

  nextCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 28, gap: 10 },
  nextLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  nextStep:  { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  btn:         { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#000', fontWeight: '700', fontSize: 16 },
});
