/**
 * SessionScreen — hold a place at a session, and check yourself in on the day.
 *
 * Brought back on 22 October 2026 (it was removed on 1 September) with self
 * check-in and appointments, for the bank demos. A session is an announced,
 * capped window: Saturday banking, a loan clinic for approved applicants, a day
 * of booked appointments, a court sitting. Staff can still do all of this at
 * the desk; this screen is the same thing for the person with the phone.
 *
 * Three things a person can do here, in the order they happen:
 *
 *   1. hold a place: prove you are on the list where there is one, and get a code
 *   2. on the day, check in with that code and get an ordinary ticket
 *   3. if staff registered you, type the code they gave you and check in
 *
 * What a place buys, because the words matter: without an appointment time it
 * reserves the RIGHT TO ATTEND, and your place in the line is taken when you
 * check in. With one (migration 042) you are called at your time, ahead of
 * walk-ins, if you check in from 15 minutes before it to 10 minutes after. The
 * API decides which; this screen shows its own sentence for it.
 *
 * Wording comes from the organisation's sector terms, so a bank asks for a
 * booking reference and a court for a ticket number. Nothing here asks for an
 * account or card number.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, inputReset, radius, shadow, sp } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { haptics } from '../../lib/haptics';
import api from '../../lib/apiClient';
import Icon from '../../components/Icon';
import { Press } from '../../components/Press';
import { ErrorCard, SkeletonCard } from '../../components/Feedback';
import { RootStackParamList } from '../../navigation/AppNavigator';

export type PublicSession = {
  id: string;
  name: string;
  description?: string | null;
  session_date: string;
  starts_at: string;
  ends_at?: string | null;
  capacity: number;
  places_remaining: number;
  requires_eligibility: boolean;
  second_factor: 'none' | 'surname';
  arrive_minutes_before?: number | null;
  appointment_window?: { early: number; late: number };
  status: string;
  sector?: string | null;
  business_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  service_name?: string | null;
  terms?: { identifier?: { label: string; hint: string } | null } | null;
};

type MyRegistration = {
  registration_id: string;
  registration_code: string;
  reference?: string | null;
  appointment_time?: string | null;
  registration_status: 'registered' | 'checked_in' | 'no_show' | 'cancelled';
  queue_ticket_id?: string | null;
  session: { id: string };
};

type CheckInResult = {
  ticket?: { id: string; ticket_number: string };
  appointment?: { message?: string | null } | null;
};

/** "Saturday 24 October" — the day is the promise, so it leads. */
export function sessionDayLabel(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "9:00 AM" from a SQL time. */
export function clockLabel(t?: string | null, shiftMinutes = 0) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const d = new Date(); d.setHours(h, (m || 0) + shiftMinutes, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** What to call the reference, in the organisation's own words. */
function referenceWords(s?: PublicSession) {
  const id = s?.terms?.identifier;
  if (id?.label) return { label: id.label, hint: id.hint || '' };
  if (s?.sector === 'banking') return { label: 'Booking or approval reference', hint: 'It is on your booking or approval message, e.g. PA-26-1041' };
  return { label: 'Your reference', hint: 'It is on the message or letter you were sent' };
}

export default function SessionScreen() {
  const topPad = useTopPad(64);
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProp<RootStackParamList, 'Session'>>();
  const sessionId = route.params?.sessionId;

  const sessionQuery = useQuery({
    queryKey: ['public-session', sessionId],
    queryFn: () => api.get<PublicSession>(`/sessions/public/${sessionId}`, false),
    enabled: Boolean(sessionId),
  });
  const s = sessionQuery.data;

  /* A place this account already holds here. Failures are silent: a guest has
     no list, and the form below still works without it. */
  const mineQuery = useQuery({
    queryKey: ['my-sessions'],
    queryFn: () => api.get<MyRegistration[]>('/sessions/mine'),
    retry: 0,
  });
  const held = useMemo(
    () => (mineQuery.data || []).find((r) => r.session?.id === sessionId) || null,
    [mineQuery.data, sessionId],
  );

  const [reference, setReference] = useState('');
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'register' | 'checkin' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [justIssued, setJustIssued] = useState<{ code: string; appointment: string | null } | null>(null);

  const words = referenceWords(s);
  const needsSurname = s?.second_factor === 'surname';
  const canRegister = reference.trim().length > 0 && (!needsSurname || surname.trim().length > 0);
  const isToday = s ? String(s.session_date).slice(0, 10) === todayISO() : false;
  const early = s?.appointment_window?.early ?? 15;
  const late = s?.appointment_window?.late ?? 10;

  const holding = justIssued
    ? { code: justIssued.code, appointment: justIssued.appointment, status: 'registered' as const, ticketId: null }
    : held
      ? {
        code: held.registration_code,
        appointment: held.appointment_time || null,
        status: held.registration_status,
        ticketId: held.queue_ticket_id || null,
      }
      : null;

  const register = async () => {
    if (!canRegister || busy) return;
    setBusy('register'); setError(null);
    try {
      const body: Record<string, string> = { reference: reference.trim() };
      if (needsSurname) body.surname = surname.trim();
      if (name.trim()) body.name = name.trim();
      if (phone.trim()) body.phone = phone.trim();
      const res = await api.post<{ registration_code: string; appointment_time?: string | null }>(
        `/sessions/public/${sessionId}/register`, body,
      );
      haptics.success();
      setJustIssued({ code: res.registration_code, appointment: res.appointment_time || null });
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['public-session', sessionId] });
    } catch (caught: unknown) {
      haptics.error();
      /* The API's own words: "not on the list", "window closed" and "full" each
         need a different action, so none is flattened into a generic failure. */
      setError(caught instanceof Error ? caught.message : 'Could not hold a place. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const checkIn = async (value: string) => {
    const typed = value.trim();
    if (!typed || busy) return;
    setBusy('checkin'); setCheckInError(null);
    try {
      const res = await api.post<CheckInResult>(`/sessions/public/${sessionId}/check-in`, { code: typed });
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['active-ticket'] });
      if (res.ticket?.id) {
        navigation.replace('Ticket', { ticketId: res.ticket.id });
      }
    } catch (caught: unknown) {
      haptics.error();
      /* Early for an appointment comes back with the time check-in opens. */
      setCheckInError(caught instanceof Error ? caught.message : 'Could not check you in. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const body = () => {
    if (sessionQuery.isLoading) return <SkeletonCard height={260} />;
    if (sessionQuery.error || !s) {
      return (
        <ErrorCard
          title="This session could not be loaded"
          message={`It may have closed or been cancelled. Check with ${s?.business_name || 'the organisation'} if you were expecting it.`}
          onRetry={() => sessionQuery.refetch()}
        />
      );
    }

    const full = Number(s.places_remaining) <= 0;
    const open = s.status === 'open';

    return (
      <View style={{ gap: sp.l }}>
        {/* What this is */}
        <View style={[c.card, { gap: 12 }]}>
          {s.business_name ? (
            <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.6, color: colors.accent }}>
              {s.business_name.toUpperCase()}
            </Text>
          ) : null}
          <Text style={{ fontFamily: font.extra, fontSize: 21, lineHeight: 27, color: colors.ink, letterSpacing: -0.4 }}>
            {s.name}
          </Text>
          {s.description ? (
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 20, color: colors.muted }}>{s.description}</Text>
          ) : null}
          <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
          <Detail icon="ticket" label="Day" value={`${sessionDayLabel(s.session_date)}${isToday ? ' (today)' : ''}`} />
          <Detail icon="clock" label="Hours" value={`${clockLabel(s.starts_at)}${s.ends_at ? `–${clockLabel(s.ends_at)}` : ''}`} />
          {s.location_name || s.location_address ? (
            <Detail icon="pin" label="Where" value={[s.location_name, s.location_address].filter(Boolean).join(' · ')} />
          ) : null}
        </View>

        {/* The place you hold, and checking in with it. The code is the thing. */}
        {holding ? (
          <View style={[c.card, { alignItems: 'center', paddingVertical: 26, gap: 4 }]}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: holding.status === 'checked_in' ? colors.infoSoft : colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={24} color={holding.status === 'checked_in' ? colors.accent : colors.successInk} />
            </View>
            <Text style={{ fontFamily: font.extra, fontSize: 19, color: colors.ink, marginTop: 10, textAlign: 'center' }}>
              {holding.status === 'checked_in' ? 'You are checked in' : 'Your place is held'}
            </Text>
            {holding.appointment ? (
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accent, marginTop: 2 }}>
                Appointment at {clockLabel(holding.appointment)}
              </Text>
            ) : null}
            <Text style={{ fontFamily: font.extra, fontSize: 34, letterSpacing: 5, color: colors.ink, marginTop: 16 }}>
              {holding.code}
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1, color: colors.faint }}>YOUR CHECK-IN CODE</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: 12, maxWidth: 300 }}>
              {holding.status === 'checked_in'
                ? 'Your ticket is live. Open it to see your place in line.'
                : holding.appointment
                  ? `Check in from ${clockLabel(holding.appointment, -early)} to ${clockLabel(holding.appointment, late)} and you will be called at your time, ahead of walk-ins. Later than that, you join the line in the usual order.`
                  : 'Check in when you arrive. Your place in the line is taken from when you check in, so come any time during the session hours.'}
            </Text>

            {holding.status === 'checked_in' && holding.ticketId ? (
              <Press role="button" haptic label="Open my ticket"
                onPress={() => navigation.navigate('Ticket', { ticketId: holding.ticketId })}
                style={[c.button, { marginTop: 16, alignSelf: 'stretch' }]}>
                <Text style={c.buttonText}>Open my ticket</Text>
              </Press>
            ) : null}
            {holding.status === 'registered' ? (
              isToday ? (
                <Press role="button" haptic label="Check in now" disabled={busy === 'checkin'}
                  onPress={() => checkIn(holding.code)}
                  style={[c.button, { marginTop: 16, alignSelf: 'stretch' }]}>
                  {busy === 'checkin' ? <ActivityIndicator color="#fff" /> : <Text style={c.buttonText}>I'm here · check in now</Text>}
                </Press>
              ) : (
                <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.faint, marginTop: 14 }}>
                  Check-in opens on {sessionDayLabel(s.session_date)}.
                </Text>
              )
            ) : null}
            {checkInError ? <Problem text={checkInError} /> : null}
          </View>
        ) : null}

        {/* Room left, and holding a place. */}
        {!holding && open ? (
          <View style={[c.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
            <View style={{ width: 44, height: 44, borderRadius: radius.m, backgroundColor: full ? colors.dangerSoft : colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="person" size={20} color={full ? colors.danger : colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink }}>
                {full ? 'This session is full' : `${s.places_remaining} places left`}
              </Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                {full ? 'No further places are available.' : `of ${s.capacity}`}
              </Text>
            </View>
          </View>
        ) : null}

        {!holding && open && !full ? (
          <View style={[c.card, { gap: 12 }]}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>
              {s.requires_eligibility ? 'Check you are on the list' : 'Hold your place'}
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>
              {s.requires_eligibility
                ? `Only people on ${s.business_name || 'the organisation'}'s list for this session can register. If you have an appointment, its time comes with you.`
                : 'Hold a place now and check in when you arrive.'}
            </Text>
            <Field label={words.label} value={reference} onChange={setReference} placeholder={words.hint} autoCapitalize="characters" />
            {needsSurname ? (
              <Field label="Surname" value={surname} onChange={setSurname} placeholder="As it appears on your booking" autoCapitalize="words" />
            ) : null}
            <Field label="Your name (optional)" value={name} onChange={setName} placeholder="So staff can greet you" autoCapitalize="words" />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="876-000-0000" keyboardType="phone-pad" />
            {error ? <Problem text={error} /> : null}
            <Press role="button" haptic
              label={canRegister ? 'Hold my place' : `Enter your ${words.label.toLowerCase()} first`}
              disabled={!canRegister || busy === 'register'}
              onPress={register}
              style={[c.button, { marginTop: 4, backgroundColor: canRegister ? colors.dark : colors.fieldBg }]}>
              {busy === 'register' ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={[c.buttonText, { color: canRegister ? '#fff' : colors.faint }]}>Hold my place</Text>
                  {canRegister ? <Icon name="arrowRight" size={17} color={colors.accent} /> : null}
                </>
              )}
            </Press>
          </View>
        ) : null}

        {/* Registered at the desk, or on another phone: check in with the code
            you were given. Only on the day, which is when the API allows it. */}
        {!holding && isToday ? (
          <View style={[c.card, { gap: 12 }]}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Already have a code?</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>
              If you were booked by phone or at the desk, type the code you were given to check yourself in.
            </Text>
            <Field label="Check-in code" value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="e.g. PBK-1030" autoCapitalize="characters" />
            {checkInError ? <Problem text={checkInError} /> : null}
            <Press role="button" haptic label="Check in" disabled={!code.trim() || busy === 'checkin'}
              onPress={() => checkIn(code)}
              style={[c.button, { backgroundColor: code.trim() ? colors.dark : colors.fieldBg }]}>
              {busy === 'checkin' ? <ActivityIndicator color="#fff" /> : (
                <Text style={[c.buttonText, { color: code.trim() ? '#fff' : colors.faint }]}>I'm here · check in</Text>
              )}
            </Press>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: sp.screen, paddingTop: topPad, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: sp.l }}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card }}>
            <Icon name="back" size={19} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 22, color: colors.ink, letterSpacing: -0.5 }}>
            {holding ? 'Your booking' : 'Book and check in'}
          </Text>
        </View>
        {body()}
      </ScrollView>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 11, alignItems: 'flex-start' }}>
      <Icon name={icon} size={16} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.5, color: colors.faint }}>{label.toUpperCase()}</Text>
        <Text style={{ fontFamily: font.semibold, fontSize: 13.5, lineHeight: 19, color: colors.ink, marginTop: 1 }}>{value}</Text>
      </View>
    </View>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: colors.dangerSoft, borderRadius: radius.m, padding: 12, alignSelf: 'stretch', marginTop: 4 }}>
      <Icon name="shield" size={16} color={colors.danger} />
      <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, lineHeight: 18, color: colors.danger }}>{text}</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, autoCapitalize, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  autoCapitalize?: 'none' | 'words' | 'characters'; keyboardType?: 'phone-pad';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.4, color: colors.muted }}>{label}</Text>
      <TextInput
        style={[{
          backgroundColor: colors.fieldBg, borderWidth: 1,
          borderColor: focused ? colors.accent : colors.border,
          borderRadius: radius.l, paddingHorizontal: 15, height: 52,
          fontFamily: font.medium, fontSize: 15, color: colors.ink,
        }, inputReset]}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize={autoCapitalize || 'none'}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

/* Local tokens — the shared `t.card` carries a margin these do not want. */
const c = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
  button: {
    height: 56, borderRadius: radius.xl, backgroundColor: colors.dark,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9,
  },
  buttonText: { fontFamily: font.extra, fontSize: 15.5, color: '#fff' },
} as const;
