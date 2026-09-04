/**
 * KioskScreen — the self-service lobby terminal, operated by the CUSTOMER.
 *
 * This is the screen an iPad runs, mounted in a branch lobby, signed in once as
 * that branch's kiosk account and locked to this app with Guided Access. The
 * public touches it themselves; no staff member stands over it.
 *
 * It replaces the clerk console that used to live at this route. That console
 * was a different product for a different actor — a staff member adding a
 * walk-in on somebody's behalf — and it is preserved as ClerkConsoleScreen for
 * the roaming-staff case, which needs a phone rather than a terminal.
 *
 * Ported from the admin-desktop terminal (src/kiosk/KioskApp.tsx), which was
 * the design but never a working feature: its services, its branch and its
 * waiting counts were hardcoded, and issuing a ticket built a number in local
 * state without calling the API. Somebody who "took a ticket" on it joined no
 * queue at all. Everything here is live:
 *
 *   services  GET  /services?branch_id=…   name, wait, waiting count, prefix
 *   branch    the signed-in kiosk actor    org and branch name
 *   ticket    POST /tickets/walk-in        a real place in a real line
 *
 * Terminal rules that differ from the rest of the app:
 *  • Every target is finger-sized. Nobody is being precise on a wall-mounted
 *    iPad, and there is no hover state to discover anything with.
 *  • Nothing is destructive and nothing persists. Start Over is always one tap
 *    away, and the ticket screen resets itself so the next person in the lobby
 *    never inherits the last person's half-finished session.
 *  • It reads at standing distance — roughly an arm and a half away — so the
 *    type scale is far larger than a phone's.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text,
  TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/apiClient';
import { colors, font, shadow } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { haptics } from '../../lib/haptics';
import { ServiceSummary } from '../../lib/mobileData';
import { ErrorCard, SkeletonRows } from '../../components/Feedback';
import { useAuth, KioskActor } from '../../hooks/useAuth';

interface WalkInTicket {
  id: string;
  ticket_number: string;
  position: number;
  estimated_wait_minutes: number | string | null;
  guest_name: string | null;
}

type Step = 'welcome' | 'service' | 'confirm' | 'details' | 'ticket';
type Notify = 'sms' | 'screen';

const STEPS: Array<{ key: Step; label: string }> = [
  { key: 'service', label: 'Service' },
  { key: 'confirm', label: 'Wait Time' },
  { key: 'details', label: 'Your Name' },
];

/** How long the finished ticket stays up before the terminal resets itself. */
const RESET_SECONDS = 25;
/** Above this, the line is called out as longer than usual rather than shown flat. */
const BUSY_MINUTES = 40;

const num = (v: number | string | null | undefined, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** The wait to show for a service: counter-aware if the branch gave us one. */
const waitFor = (s: ServiceSummary) =>
  Math.round(num(s.estimated_wait_minutes ?? s.avg_wait_minutes));

/* ─────────────────────────── chrome ─────────────────────────── */

function Chrome({ step, org, branch, onHome }: {
  step: Step; org: string; branch: string; onHome: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const idx = STEPS.findIndex(s => s.key === step);

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingHorizontal: 24, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: font.extra, fontSize: 18, color: colors.accentInk }}>
            {org.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 14, color: colors.ink }}>{org}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginTop: 1 }}>{branch}</Text>
        </View>
      </View>

      {/* Progress. Present only inside the three steps that form the journey —
          the welcome screen and the finished ticket are not stops on it. */}
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        {idx >= 0 && STEPS.map((s, i) => {
          const done = i < idx, on = i === idx;
          return (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: done || on ? colors.accent : colors.surfaceAlt,
                borderWidth: 1, borderColor: done || on ? colors.accent : colors.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {done
                  ? <Ionicons name="checkmark" size={14} color={colors.accentInk} />
                  : <Text style={{ fontFamily: font.extra, fontSize: 12, color: on ? colors.accentInk : colors.muted }}>{i + 1}</Text>}
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: on ? colors.ink : colors.muted }}>{s.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 13.5, color: colors.muted, fontVariant: ['tabular-nums'] }}>
          {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </Text>
        {step !== 'welcome' && (
          <TouchableOpacity
            onPress={onHome}
            accessibilityRole="button"
            accessibilityLabel="Start over"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
              paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={16} color={colors.ink} />
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.ink }}>Start Over</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Title block + scrolling body + a footer that always holds Back and Next. */
function Frame({ eyebrow, title, sub, children, onBack, primary, footNote, wide }: {
  eyebrow: string; title: string; sub?: string; children: React.ReactNode;
  onBack?: () => void;
  primary?: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean };
  footNote?: string; wide: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: wide ? 44 : 22, paddingTop: wide ? 34 : 22, paddingBottom: 14 }}>
        <Text style={{ fontFamily: font.extra, fontSize: 12, color: colors.accent, letterSpacing: 1.5 }}>
          {eyebrow.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: font.extra, fontSize: wide ? 40 : 28, color: colors.ink, letterSpacing: -0.8, marginTop: 8 }}>
          {title}
        </Text>
        {!!sub && (
          <Text style={{ fontFamily: font.semibold, fontSize: wide ? 17 : 14.5, color: colors.muted, marginTop: 8, lineHeight: wide ? 25 : 21 }}>
            {sub}
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: wide ? 44 : 22, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: wide ? 44 : 22, paddingTop: 14, paddingBottom: 22,
        borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
      }}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60,
              paddingHorizontal: 24, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
            <Text style={{ fontFamily: font.extra, fontSize: 16, color: colors.ink }}>Back</Text>
          </TouchableOpacity>
        ) : <View />}

        <View style={{ flex: 1, alignItems: 'center' }}>
          {!!footNote && (
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted, textAlign: 'center' }}>
              {footNote}
            </Text>
          )}
        </View>

        {primary ? (
          <TouchableOpacity
            onPress={primary.onPress}
            disabled={primary.disabled || primary.busy}
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            accessibilityState={{ disabled: !!(primary.disabled || primary.busy) }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60,
              paddingHorizontal: 30, borderRadius: 18,
              backgroundColor: primary.disabled ? colors.surfaceAlt : colors.accent,
              opacity: primary.busy ? 0.7 : 1,
            }}
          >
            {primary.busy
              ? <ActivityIndicator color={primary.disabled ? colors.muted : colors.accentInk} />
              : (
                <>
                  <Text style={{ fontFamily: font.extra, fontSize: 16, color: primary.disabled ? colors.muted : colors.accentInk }}>
                    {primary.label}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color={primary.disabled ? colors.muted : colors.accentInk} />
                </>
              )}
          </TouchableOpacity>
        ) : <View />}
      </View>
    </View>
  );
}

/* ─────────────────────────── screens ─────────────────────────── */

function Welcome({ org, branch, onStart, wide }: {
  org: string; branch: string; onStart: () => void; wide: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onStart}
      accessibilityRole="button"
      accessibilityLabel={`Welcome to ${org}, ${branch}. Touch anywhere to begin.`}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}
    >
      <Text style={{ fontFamily: font.extra, fontSize: wide ? 15 : 12.5, color: colors.accent, letterSpacing: 2.4 }}>
        WELCOME TO
      </Text>
      <Text style={{
        fontFamily: font.extra, fontSize: wide ? 74 : 40, color: colors.ink,
        letterSpacing: -1.6, textAlign: 'center', marginTop: 18, lineHeight: wide ? 78 : 44,
      }}>
        {org}
      </Text>
      <Text style={{ fontFamily: font.semibold, fontSize: wide ? 21 : 16, color: colors.muted, marginTop: 16 }}>
        {branch}
      </Text>

      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: wide ? 52 : 36,
        backgroundColor: colors.accent, borderRadius: 999,
        paddingVertical: wide ? 24 : 18, paddingHorizontal: wide ? 46 : 32,
        ...shadow.hero,
      }}>
        <Text style={{ fontFamily: font.extra, fontSize: wide ? 24 : 17, color: colors.accentInk }}>
          Touch Anywhere To Begin
        </Text>
        <Ionicons name="arrow-forward" size={wide ? 26 : 20} color={colors.accentInk} />
      </View>

      <View style={{ flexDirection: 'row', gap: wide ? 60 : 28, marginTop: wide ? 62 : 40 }}>
        {[['3', 'Quick Steps'], ['~1', 'Minute To Join'], ['Free', 'Text Updates']].map(([big, small]) => (
          <View key={small} style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: font.extra, fontSize: wide ? 34 : 24, color: colors.ink }}>{big}</Text>
            <Text style={{ fontFamily: font.semibold, fontSize: wide ? 15 : 12.5, color: colors.muted, marginTop: 4 }}>{small}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function ChooseService({ services, onPick, onBack, wide }: {
  services: ServiceSummary[]; onPick: (id: string) => void; onBack: () => void; wide: boolean;
}) {
  return (
    <Frame
      wide={wide}
      eyebrow="Step 1 of 3"
      title="What Are You Here For?"
      sub="Choose the service you need. The wait shown is live."
      onBack={onBack}
      footNote="Not sure? Choose General Enquiries and someone will point you the right way."
    >
      <View style={{ gap: 12 }}>
        {services.map(s => {
          const wait = waitFor(s);
          const busy = wait >= BUSY_MINUTES;
          const waiting = num(s.waiting_count);
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => { haptics.select(); onPick(s.id); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}. ${waiting} waiting, about ${wait} minutes.`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 92,
                backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1,
                borderColor: colors.border, paddingHorizontal: 18, paddingVertical: 16,
                ...shadow.card,
              }}
            >
              <View style={{
                width: 62, height: 62, borderRadius: 17, backgroundColor: colors.surfaceAlt,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accent, letterSpacing: 0.4 }}>
                  {(s.ticket_prefix || s.name.slice(0, 3)).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.extra, fontSize: wide ? 21 : 17, color: colors.ink, letterSpacing: -0.3 }}>
                  {s.name}
                </Text>
                {!!s.description && (
                  <Text numberOfLines={2} style={{ fontFamily: font.semibold, fontSize: wide ? 15 : 13, color: colors.muted, marginTop: 3, lineHeight: 19 }}>
                    {s.description}
                  </Text>
                )}
              </View>

              <View style={{ alignItems: 'flex-end', minWidth: 84 }}>
                <Text style={{
                  fontFamily: font.extra, fontSize: wide ? 30 : 24,
                  color: busy ? colors.busy : colors.ink, letterSpacing: -0.6,
                }}>
                  {wait}<Text style={{ fontSize: wide ? 16 : 13, color: colors.muted }}> min</Text>
                </Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                  {waiting} waiting
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Frame>
  );
}

function Confirm({ svc, onBack, onNext, wide }: {
  svc: ServiceSummary; onBack: () => void; onNext: () => void; wide: boolean;
}) {
  const wait = waitFor(svc);
  const waiting = num(svc.waiting_count);
  const open = num(svc.active_counters);
  const seenBy = new Date(Date.now() + wait * 60000);

  const Row = ({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: wide ? 17 : 14.5, color: colors.ink, lineHeight: 24 }}>
        {children}
      </Text>
    </View>
  );

  return (
    <Frame
      wide={wide}
      eyebrow="Step 2 of 3"
      title={svc.name}
      sub="Here's what the line looks like right now."
      onBack={onBack}
      primary={{ label: 'Join This Line', onPress: onNext }}
    >
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
        <View style={{
          backgroundColor: colors.dark, borderRadius: 24, padding: wide ? 34 : 24,
          alignItems: 'center', justifyContent: 'center', minWidth: wide ? 260 : undefined,
          ...shadow.hero,
        }}>
          <Text style={{ fontFamily: font.extra, fontSize: wide ? 84 : 58, color: '#fff', letterSpacing: -2.4 }}>
            {wait}<Text style={{ fontSize: wide ? 28 : 20, color: 'rgba(255,255,255,.6)' }}> min</Text>
          </Text>
          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: 'rgba(255,255,255,.6)', letterSpacing: 1.4, marginTop: 8 }}>
            ESTIMATED WAIT
          </Text>
        </View>

        <View style={{
          flex: 1, gap: 16, backgroundColor: colors.surface, borderRadius: 24,
          borderWidth: 1, borderColor: colors.border, padding: wide ? 28 : 20, justifyContent: 'center',
        }}>
          <Row icon="people-outline">
            <Text style={{ fontFamily: font.extra }}>{waiting} {waiting === 1 ? 'person' : 'people'}</Text> ahead of you
          </Row>
          <Row icon="time-outline">
            Seen at about <Text style={{ fontFamily: font.extra }}>{seenBy.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
          </Row>
          {open > 0 && (
            <Row icon="checkmark-circle-outline">
              <Text style={{ fontFamily: font.extra }}>{open}</Text> {open === 1 ? 'window is' : 'windows are'} serving this line
            </Row>
          )}
          {wait >= BUSY_MINUTES && (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 16, padding: 16 }}>
              <Text style={{ fontFamily: font.semibold, fontSize: wide ? 15.5 : 13.5, color: colors.ink, lineHeight: 21 }}>
                This line is longer than usual today. You're welcome to join — we'll text you so you
                don't have to stand and wait.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Frame>
  );
}

function Details({
  name, setName, phone, setPhone, notify, setNotify, onBack, onDone, busy, error, wide,
}: {
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  notify: Notify | null; setNotify: (v: Notify) => void;
  onBack: () => void; onDone: () => void; busy: boolean; error: string; wide: boolean;
}) {
  const ready = name.trim().length > 1
    && (notify === 'screen' || (notify === 'sms' && phone.replace(/\D/g, '').length >= 7));

  const field = {
    minHeight: 68, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 18, justifyContent: 'center' as const,
  };

  return (
    <Frame
      wide={wide}
      eyebrow="Step 3 of 3"
      title="Who Should We Call?"
      sub="Your name is called out and shown on the screen when it's your turn."
      onBack={onBack}
      primary={{ label: 'Get My Ticket', onPress: onDone, disabled: !ready, busy }}
      footNote={!ready ? 'Enter your name, then choose how you want to be told' : undefined}
    >
      <View style={{ gap: 16 }}>
        <View>
          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted, letterSpacing: 1.2, marginBottom: 8 }}>
            YOUR NAME
          </Text>
          {/* The web terminal drew its own keyboard because a lobby PC has no
              keyboard at all. An iPad raises the system one, which is bigger,
              handles every language the device does, and is the keyboard the
              person already knows. */}
          <TextInput
            value={name}
            onChangeText={t => setName(t.slice(0, 40))}
            placeholder="Touch to type"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Your name"
            style={[field, { fontFamily: font.extra, fontSize: wide ? 24 : 19, color: colors.ink }]}
          />
        </View>

        <View>
          <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted, letterSpacing: 1.2, marginBottom: 8 }}>
            HOW SHOULD WE TELL YOU?
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {([
              { key: 'sms' as const, icon: 'chatbubble-outline' as const, title: 'Text Me', sub: 'Wait anywhere nearby' },
              { key: 'screen' as const, icon: 'tv-outline' as const, title: 'Watch The Screen', sub: 'Stay in the lobby' },
            ]).map(opt => {
              const on = notify === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setNotify(opt.key)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${opt.title}. ${opt.sub}`}
                  style={{
                    flex: 1, minHeight: 110, borderRadius: 20, borderWidth: on ? 2 : 1,
                    borderColor: on ? colors.accent : colors.border,
                    backgroundColor: on ? colors.surfaceAlt : colors.surface,
                    padding: 18, gap: 6, justifyContent: 'center',
                  }}
                >
                  <Ionicons name={opt.icon} size={26} color={on ? colors.accent : colors.muted} />
                  <Text style={{ fontFamily: font.extra, fontSize: wide ? 19 : 16, color: colors.ink }}>{opt.title}</Text>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted }}>{opt.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {notify === 'sms' && (
          <View>
            <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: colors.muted, letterSpacing: 1.2, marginBottom: 8 }}>
              MOBILE NUMBER
            </Text>
            <TextInput
              value={phone}
              onChangeText={t => setPhone(t.slice(0, 14))}
              placeholder="876-000-0000"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              accessibilityLabel="Mobile number"
              style={[field, { fontFamily: font.extra, fontSize: wide ? 24 : 19, color: colors.ink }]}
            />
          </View>
        )}

        {!!error && (
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.danger }}>{error}</Text>
        )}
      </View>
    </Frame>
  );
}

function Ticket({ ticket, serviceName, notify, onDone, wide }: {
  ticket: WalkInTicket; serviceName: string; notify: Notify | null;
  onDone: () => void; wide: boolean;
}) {
  const [left, setLeft] = useState(RESET_SECONDS);
  useEffect(() => {
    const id = setInterval(() => setLeft(s => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  /* Reset from an effect watching the counter, not from inside the tick — a
     setState-during-interval that calls a parent updater mid-render is how a
     terminal ends up resetting twice and losing the next person's first tap. */
  useEffect(() => { if (left === 0) onDone(); }, [left, onDone]);

  const wait = Math.round(num(ticket.estimated_wait_minutes));

  return (
    <ScrollView contentContainerStyle={{ padding: wide ? 44 : 22, flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 22, alignItems: 'stretch' }}>
        <View style={{
          flex: wide ? 1 : undefined, backgroundColor: colors.dark, borderRadius: 28,
          padding: wide ? 40 : 28, alignItems: 'center', ...shadow.hero,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="checkmark-circle" size={26} color={colors.accent} />
            <Text style={{ fontFamily: font.extra, fontSize: wide ? 19 : 16, color: '#fff' }}>You're In The Line</Text>
          </View>

          <Text style={{
            fontFamily: font.extra, fontSize: wide ? 90 : 60, color: '#fff',
            letterSpacing: -2.6, marginTop: 18,
          }}>
            {ticket.ticket_number}
          </Text>
          {!!ticket.guest_name && (
            <Text style={{ fontFamily: font.bold, fontSize: wide ? 22 : 17, color: 'rgba(255,255,255,.72)', marginTop: 6 }}>
              {ticket.guest_name}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: wide ? 54 : 34, marginTop: 26 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: font.extra, fontSize: wide ? 34 : 26, color: '#fff' }}>{ticket.position}</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>Place In Line</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: font.extra, fontSize: wide ? 34 : 26, color: '#fff' }}>~{wait} min</Text>
              <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>Estimated Wait</Text>
            </View>
          </View>

          <Text style={{ fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,.55)', marginTop: 22 }}>
            {serviceName}
          </Text>
        </View>

        <View style={{ flex: wide ? 1 : undefined, justifyContent: 'center', gap: 16 }}>
          <Text style={{ fontFamily: font.extra, fontSize: wide ? 32 : 24, color: colors.ink, letterSpacing: -0.6 }}>
            Keep This Number
          </Text>
          <Text style={{ fontFamily: font.semibold, fontSize: wide ? 17 : 14.5, color: colors.muted, lineHeight: 24 }}>
            {notify === 'sms'
              ? "We'll text you a few minutes before you're called, so you can wait nearby."
              : 'Watch the screens in the lobby — your number and name appear when it\'s your turn.'}
          </Text>

          <View style={{
            flexDirection: 'row', gap: 12, backgroundColor: colors.surfaceAlt,
            borderRadius: 18, padding: 18, alignItems: 'flex-start',
          }}>
            <Ionicons name="time-outline" size={20} color={colors.accent} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, lineHeight: 20 }}>
              If you miss your call, go to the front desk — you won't lose your place straight away.
            </Text>
          </View>

          <TouchableOpacity
            onPress={onDone}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Done, next person"
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              minHeight: 66, borderRadius: 20, backgroundColor: colors.accent,
            }}
          >
            <Ionicons name="refresh" size={20} color={colors.accentInk} />
            <Text style={{ fontFamily: font.extra, fontSize: 17, color: colors.accentInk }}>Done — Next Person</Text>
          </TouchableOpacity>

          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.muted, textAlign: 'center' }}>
            Returning to the start in {left}s
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────── terminal ─────────────────────────── */

export default function KioskScreen() {
  const topPad = useTopPad(0);
  const { width } = useWindowDimensions();
  /* One breakpoint, and it is about reading distance rather than device class:
     a tablet on a stand is read from further away than a phone in a hand, so
     the type and the targets both grow. */
  const wide = width >= 700;

  const { kiosk } = useAuth();
  /* kiosk CAN be null for one frame — signing out clears it before this screen
     unmounts, and reading branchId off a cast-away null put a red screen in
     front of somebody standing in a branch. Hooks all still run. */
  const actor = kiosk as KioskActor | null;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('welcome');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notify, setNotify] = useState<Notify | null>(null);
  const [issued, setIssued] = useState<{ ticket: WalkInTicket; serviceName: string } | null>(null);
  const [error, setError] = useState('');

  const servicesQuery = useQuery({
    queryKey: ['kiosk-services', actor?.branchId],
    queryFn: () => api.get<ServiceSummary[]>(`/services?branch_id=${actor!.branchId}`, false),
    enabled: Boolean(actor?.branchId),
    refetchInterval: 20_000,
  });
  const services = servicesQuery.data || [];
  const selected = useMemo(
    () => services.find(s => s.id === serviceId) || null,
    [services, serviceId],
  );

  const reset = useCallback(() => {
    setStep('welcome'); setServiceId(null); setName(''); setPhone('');
    setNotify(null); setIssued(null); setError('');
  }, []);

  const issue = useMutation({
    mutationFn: () => api.post<WalkInTicket>('/tickets/walk-in', {
      service_id: serviceId,
      guest_name: name.trim(),
      guest_phone: notify === 'sms' ? phone.trim() || undefined : undefined,
    }),
    onSuccess: (ticket) => {
      haptics.success();
      setIssued({ ticket, serviceName: selected?.name || 'Service' });
      setStep('ticket');
      queryClient.invalidateQueries({ queryKey: ['kiosk-services', actor?.branchId] });
    },
    onError: (caught: unknown) => {
      haptics.error();
      setError(caught instanceof Error ? caught.message : 'Could not join the line. Try again.');
    },
  });

  if (!actor) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const org = actor.businessName || 'Welcome';
  const branch = actor.branchName || '';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topPad }}
    >
      <Chrome step={step} org={org} branch={branch} onHome={reset} />

      {step === 'welcome' && (
        <Welcome org={org} branch={branch} wide={wide} onStart={() => setStep('service')} />
      )}

      {step === 'service' && (
        servicesQuery.isLoading ? (
          <View style={{ padding: wide ? 44 : 22 }}><SkeletonRows count={5} /></View>
        ) : servicesQuery.error ? (
          <View style={{ padding: wide ? 44 : 22 }}>
            <ErrorCard
              title="Services unavailable"
              message="This terminal could not reach the branch. A staff member can still add you at the desk."
              onRetry={() => servicesQuery.refetch()}
            />
          </View>
        ) : (
          <ChooseService
            services={services}
            wide={wide}
            onBack={reset}
            onPick={(id) => { setServiceId(id); setStep('confirm'); }}
          />
        )
      )}

      {step === 'confirm' && selected && (
        <Confirm svc={selected} wide={wide} onBack={() => setStep('service')} onNext={() => setStep('details')} />
      )}

      {step === 'details' && (
        <Details
          name={name} setName={setName}
          phone={phone} setPhone={setPhone}
          notify={notify} setNotify={setNotify}
          busy={issue.isPending} error={error} wide={wide}
          onBack={() => { setError(''); setStep('confirm'); }}
          onDone={() => { setError(''); issue.mutate(); }}
        />
      )}

      {step === 'ticket' && issued && (
        <Ticket
          ticket={issued.ticket}
          serviceName={issued.serviceName}
          notify={notify}
          wide={wide}
          onDone={reset}
        />
      )}
    </KeyboardAvoidingView>
  );
}
