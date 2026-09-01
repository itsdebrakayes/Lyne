/**
 * SessionScreen — registering for a sitting you have to hold a place at.
 *
 * The public half of scheduled sessions, which never existed. The backend has
 * been able to serve this since migration 027; nothing called it, so the 87
 * registrations in the demo arrived by seed and check-in had never once run.
 *
 * Why this is not the ordinary join flow: a court sitting is a capped event on
 * an announced day at an announced venue, and you must be entitled to attend.
 * So the screen asks a different question from the queue screens: not "how long
 * is the wait" but "are you on the list, and is there room".
 *
 * What registering actually buys, because the wording here matters and an
 * earlier draft of this screen got it wrong: it reserves your RIGHT TO ATTEND
 * on the day, not a position. Check-in allocates the position from whoever is
 * waiting at that moment (issueTicketSlot with the live waiting count), so
 * registering at 9am on Monday and arriving at 11am on Saturday puts you behind
 * whoever arrived at 10. Registration is a pre-layer over the queue; the queue
 * itself still forms on the day, in arrival order.
 *
 * Three steps, and the middle one is the point:
 *
 *   1. what this sitting is, where, and when to arrive
 *   2. prove you belong on it — reference, plus surname where the court asks
 *   3. hold the place, and keep the code that redeems it on the day
 *
 * The code is the whole artifact. On the day, staff check that code in and it
 * becomes an ordinary queue ticket — from that moment every existing mechanism
 * works untouched. Nothing downstream knows a session was involved.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
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
  ends_at: string;
  capacity: number;
  places_remaining: number;
  requires_eligibility: boolean;
  second_factor: 'none' | 'surname';
  arrive_minutes_before: number;
  status: string;
  business_name?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  service_name?: string | null;
  registration_closes_at?: string | null;
};

/** "Saturday 5 September" — the day is the promise, so it leads. */
export function sessionDayLabel(iso: string) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** "9:00 AM" from a SQL time. */
export function clockLabel(t?: string | null) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** What time to actually be there, which is not when it starts. */
function arriveBy(starts: string, minutesBefore: number) {
  const [h, m] = String(starts).split(':').map(Number);
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  d.setMinutes(d.getMinutes() - (minutesBefore || 0));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function SessionScreen() {
  const topPad = useTopPad(64);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Session'>>();
  const sessionId = route.params?.sessionId;

  const sessionQuery = useQuery({
    queryKey: ['public-session', sessionId],
    queryFn: () => api.get<PublicSession>(`/sessions/public/${sessionId}`),
    enabled: Boolean(sessionId),
  });
  const s = sessionQuery.data;

  const [reference, setReference] = useState('');
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const needsSurname = s?.second_factor === 'surname';
  const canSubmit = reference.trim().length > 0 && (!needsSurname || surname.trim().length > 0);

  const register = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setError(null);
    try {
      const body: Record<string, string> = { reference: reference.trim() };
      if (needsSurname) body.surname = surname.trim();
      if (name.trim()) body.name = name.trim();
      if (phone.trim()) body.phone = phone.trim();
      const res = await api.post<{ registration_code: string; places_remaining?: number }>(
        `/sessions/public/${sessionId}/register`, body
      );
      haptics.success();
      setCode(res.registration_code);
      if (typeof res.places_remaining === 'number') setRemaining(res.places_remaining);
    } catch (caught: unknown) {
      haptics.error();
      /* The API's own words. It distinguishes "not on the list" from "the window
         has closed" from "this sitting is full", and each needs a different
         action from the person — so none of them should be flattened into a
         generic failure. */
      setError(caught instanceof Error ? caught.message : 'Could not hold a place. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (sessionQuery.isLoading) return <SkeletonCard height={260} />;
    if (sessionQuery.error || !s) {
      return (
        <ErrorCard
          title="This sitting could not be loaded"
          message="It may have closed or been cancelled. Check with the court if you were expecting it."
          onRetry={() => sessionQuery.refetch()}
        />
      );
    }

    /* Held a place already — the code IS the deliverable, so nothing else
       competes with it on screen. */
    if (code) {
      return (
        <View style={{ gap: sp.l }}>
          <View style={[t.card, { alignItems: 'center', paddingVertical: 30 }]}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={26} color={colors.successInk} />
            </View>
            <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, marginTop: 14, textAlign: 'center' }}>
              Your place is held
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 6, maxWidth: 290 }}>
              Show this code when you arrive on the day. Your place in the line is taken from when you check in, so come whenever suits you inside the sitting hours.
            </Text>

            <Text style={{ fontFamily: font.extra, fontSize: 40, letterSpacing: 6, color: colors.ink, marginTop: 22 }}>
              {code}
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1, color: colors.faint, marginTop: 4 }}>
              YOUR ACCESS CODE
            </Text>
          </View>

          <View style={[t.card, { gap: 12 }]}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>Before you go</Text>
            <Detail icon="clock" label="Arrive by" value={`${arriveBy(s.starts_at, s.arrive_minutes_before)} on ${sessionDayLabel(s.session_date)}`} />
            {s.location_address ? <Detail icon="pin" label="Where" value={s.location_address} /> : null}
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>
              Arrive any time while the sitting is running — you join the line when you check in, not when you registered. If you come for the start, be there {s.arrive_minutes_before} minutes early for screening.
            </Text>
          </View>

          <Press role="button" label="Done" onPress={() => navigation.goBack()} haptic
            style={{ height: 56, borderRadius: radius.xl, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: '#fff' }}>Done</Text>
          </Press>
        </View>
      );
    }

    const full = Number(s.places_remaining) <= 0;

    return (
      <View style={{ gap: sp.l }}>
        {/* What this is */}
        <View style={[t.card, { gap: 12 }]}>
          {s.business_name ? (
            <Text style={{ fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.6, color: colors.accent }}>
              {s.business_name.toUpperCase()}
            </Text>
          ) : null}
          <Text style={{ fontFamily: font.extra, fontSize: 21, lineHeight: 27, color: colors.ink, letterSpacing: -0.4 }}>
            {s.name}
          </Text>
          {s.description ? (
            <Text style={{ fontFamily: font.medium, fontSize: 13.5, lineHeight: 20, color: colors.muted }}>
              {s.description}
            </Text>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.borderSoft }} />
          <Detail icon="ticket" label="Day" value={sessionDayLabel(s.session_date)} />
          <Detail icon="clock" label="Arrive by" value={`${arriveBy(s.starts_at, s.arrive_minutes_before)} · sitting runs ${clockLabel(s.starts_at)}–${clockLabel(s.ends_at)}`} />
          {s.location_address ? <Detail icon="pin" label="Where" value={s.location_address} /> : null}
        </View>

        {/* Room left. A capped venue's honest number, not a wait time. */}
        <View style={[t.card, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
          <View style={{ width: 44, height: 44, borderRadius: radius.m, backgroundColor: full ? colors.dangerSoft : colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="person" size={20} color={full ? colors.danger : colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink }}>
              {full ? 'This sitting is full' : `${s.places_remaining} places left`}
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
              {full
                ? 'No further places are available for this day.'
                : `of ${s.capacity} · registering holds your right to attend that day`}
            </Text>
          </View>
        </View>

        {/* Prove you belong on the list */}
        {!full ? (
          <View style={[t.card, { gap: 12 }]}>
            <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>
              {s.requires_eligibility ? 'Check you are on the list' : 'Hold your place'}
            </Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>
              {s.requires_eligibility
                ? 'Only people already listed for this sitting can register. Your reference is on your ticket or summons.'
                : 'Your reference is on your ticket or summons.'}
            </Text>

            <Field label="Ticket or summons number" value={reference} onChange={setReference}
              placeholder="e.g. TKT-2026-004182" autoCapitalize="characters" />
            {needsSurname ? (
              <Field label="Surname" value={surname} onChange={setSurname}
                placeholder="As it appears on the summons" autoCapitalize="words" />
            ) : null}
            <Field label="Your name (optional)" value={name} onChange={setName} placeholder="So staff can greet you" autoCapitalize="words" />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="876-000-0000" keyboardType="phone-pad" />

            {error ? (
              <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: colors.dangerSoft, borderRadius: radius.m, padding: 12 }}>
                <Icon name="shield" size={16} color={colors.danger} />
                <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 12.5, lineHeight: 18, color: colors.danger }}>{error}</Text>
              </View>
            ) : null}

            <Press role="button" haptic
              label={canSubmit ? 'Hold my place' : 'Enter your reference first'}
              disabled={!canSubmit || busy}
              onPress={register}
              style={{
                height: 56, borderRadius: radius.xl, marginTop: 4,
                backgroundColor: canSubmit ? colors.dark : colors.fieldBg,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9,
              }}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={{ fontFamily: font.extra, fontSize: 15.5, color: canSubmit ? '#fff' : colors.faint }}>
                    Hold my place
                  </Text>
                  {canSubmit ? <Icon name="arrowRight" size={17} color={colors.accent} /> : null}
                </>
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
            {code ? 'Registered' : 'Register to attend'}
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

/* Local card token — the shared `t.card` carries a margin these do not want. */
const t = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadow.card,
  },
} as const;
