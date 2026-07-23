import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/apiClient';
import { colors, font, t, shadow, inputReset, statusFromWait, statusMeta } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { ServiceSummary } from '../../lib/mobileData';
import { ErrorCard, SkeletonCard } from '../../components/Feedback';
import { useAuth, KioskActor } from '../../hooks/useAuth';

// The row POST /tickets/walk-in returns — enough to read the ticket back to the
// customer and print/write the number on a slip.
interface WalkInTicket {
  id: string;
  ticket_number: string;
  position: number;
  estimated_wait_minutes: number | string | null;
  guest_name: string | null;
}

const svcWait = (s: ServiceSummary) => {
  if (s.estimated_wait_minutes != null) return Math.round(Number(s.estimated_wait_minutes));
  const live = Number(s.avg_wait_minutes || 0);
  return Math.round(live > 0 ? live : Number(s.base_avg_time_minutes || 0));
};

// ── The issued-ticket confirmation the clerk reads/hands to the customer ──────
function TicketIssued({ ticket, serviceName, onAddAnother }: {
  ticket: WalkInTicket; serviceName: string; onAddAnother: () => void;
}) {
  const wait = ticket.estimated_wait_minutes == null ? null : Math.round(Number(ticket.estimated_wait_minutes));
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View style={[t.cardLg, { padding: 26, alignItems: 'center' }, shadow.floating]}>
        <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: '#e7f8ef', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark-circle" size={34} color={colors.light} />
        </View>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.muted, marginTop: 16, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          Added to the line
        </Text>
        {!!ticket.guest_name && (
          <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.ink, marginTop: 4 }}>{ticket.guest_name}</Text>
        )}

        {/* The big number — what the customer watches for on the display */}
        <Text style={{ fontFamily: font.extra, fontSize: 52, color: colors.ink, letterSpacing: -1, marginTop: 14 }}>
          {ticket.ticket_number}
        </Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: colors.sub, marginTop: 2 }}>{serviceName}</Text>

        <View style={{ flexDirection: 'row', marginTop: 22, alignSelf: 'stretch' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 22, color: colors.ink }}>#{ticket.position}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted, marginTop: 5 }}>place in line</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 22, color: colors.accentDeep }}>
              {wait == null ? '—' : `~${wait}`}<Text style={{ fontSize: 12 }}>{wait == null ? '' : 'm'}</Text>
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.muted, marginTop: 5 }}>est. wait</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={onAddAnother} style={[t.primaryBtn, { marginTop: 20 }]}>
        <Ionicons name="add" size={20} color={colors.onDark} />
        <Text style={[t.primaryBtnText, { marginLeft: 8 }]}>Add another walk-in</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function KioskScreen() {
  const topPad = useTopPad(18);
  const { kiosk, signOut } = useAuth();
  const actor = kiosk as KioskActor; // this screen only mounts when kiosk is set
  const queryClient = useQueryClient();

  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ ticket: WalkInTicket; serviceName: string } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ['kiosk-services', actor.branchId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?branch_id=${actor.branchId}`, false),
    refetchInterval: 20_000,
  });
  const services = servicesQuery.data || [];
  const selected = useMemo(() => services.find(s => s.id === serviceId) || null, [services, serviceId]);

  const addWalkIn = useMutation({
    mutationFn: () => api.post<WalkInTicket>('/tickets/walk-in', {
      service_id: serviceId,
      guest_name: name.trim(),
      guest_phone: phone.trim() || undefined,
    }),
    onSuccess: (ticket) => {
      setIssued({ ticket, serviceName: selected?.name || 'Service' });
      setName(''); setPhone(''); setServiceId(null);
      queryClient.invalidateQueries({ queryKey: ['kiosk-services', actor.branchId] });
    },
  });

  const canSubmit = name.trim().length > 0 && !!serviceId && !addWalkIn.isPending;

  const resetForNext = () => { setIssued(null); addWalkIn.reset(); };

  return (
    <View style={t.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topPad, paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── kiosk header: identity + role, sign out ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
              <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.sub, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Kiosk · {actor.branchName}
              </Text>
            </View>
            <TouchableOpacity onPress={signOut} style={[t.iconBtn, { width: 40, height: 40, borderRadius: 14 }]}>
              <Ionicons name="log-out-outline" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {issued ? (
            <TicketIssued ticket={issued.ticket} serviceName={issued.serviceName} onAddAnother={resetForNext} />
          ) : (
            <>
              <Text style={[t.h1, { marginBottom: 4 }]}>Add a walk-in</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13.5, color: colors.muted, marginBottom: 22 }}>
                Put a customer who is here at the branch into the line. They&apos;ll get a ticket number to watch for.
              </Text>

              {/* ── customer details ── */}
              <View style={[t.cardLg, { padding: 18, marginBottom: 18 }]}>
                <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>Customer</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                  placeholder="Full name"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="words"
                  style={[fieldStyle(focused === 'name'), inputReset]}
                />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                  placeholder="Phone (optional)"
                  placeholderTextColor={colors.faint}
                  keyboardType="phone-pad"
                  style={[fieldStyle(focused === 'phone'), inputReset, { marginTop: 10 }]}
                />
              </View>

              {/* ── service picker ── */}
              <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12 }}>
                Which service?
              </Text>

              {servicesQuery.isLoading && <SkeletonCard height={180} />}
              {!!servicesQuery.error && !servicesQuery.isLoading && (
                <ErrorCard title="Services unavailable" message="This branch's services could not be loaded." onRetry={() => servicesQuery.refetch()} />
              )}
              {!servicesQuery.isLoading && !servicesQuery.error && services.length === 0 && (
                <View style={[t.card, { padding: 20, alignItems: 'center' }]}>
                  <Ionicons name="time-outline" size={26} color={colors.muted} />
                  <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.ink, marginTop: 10 }}>No services open right now</Text>
                </View>
              )}

              <View style={{ gap: 10 }}>
                {services.map(s => {
                  const on = s.id === serviceId;
                  const wait = svcWait(s);
                  const meta = statusMeta(statusFromWait(wait));
                  return (
                    <TouchableOpacity
                      key={s.id}
                      activeOpacity={0.9}
                      onPress={() => setServiceId(s.id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 13,
                        padding: 15, borderRadius: 20,
                        backgroundColor: on ? colors.dark : colors.surface,
                        borderWidth: 1, borderColor: on ? colors.dark : colors.border,
                        ...(on ? shadow.depth : null),
                      }}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: on ? 'rgba(255,255,255,0.12)' : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="documents-outline" size={19} color={on ? colors.onDark : colors.accentDeep} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15.5, color: on ? colors.onDark : colors.ink }}>{s.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.dot }} />
                          <Text style={{ fontFamily: font.semibold, fontSize: 12, color: on ? 'rgba(255,255,255,0.7)' : colors.muted }}>
                            {Number(s.waiting_count || 0)} in line · ~{wait}m
                          </Text>
                        </View>
                      </View>
                      {on && (
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={16} color={colors.accentInk} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!!addWalkIn.error && (
                <View style={{ marginTop: 16 }}>
                  <ErrorCard
                    title="Couldn't add walk-in"
                    message={(addWalkIn.error as Error)?.message || 'Please try again.'}
                    onRetry={() => addWalkIn.mutate()}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={() => addWalkIn.mutate()}
                disabled={!canSubmit}
                style={[t.primaryBtn, { marginTop: 22, opacity: canSubmit ? 1 : 0.4 }]}
              >
                {addWalkIn.isPending
                  ? <ActivityIndicator color={colors.onDark} />
                  : (<>
                      <Ionicons name="add-circle-outline" size={20} color={colors.onDark} />
                      <Text style={[t.primaryBtnText, { marginLeft: 8 }]}>Add to queue</Text>
                    </>)}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function fieldStyle(active: boolean) {
  return {
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderColor: active ? colors.accent : colors.border,
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 52,
    fontFamily: font.semibold,
    fontSize: 15.5,
    color: colors.ink,
  } as const;
}
