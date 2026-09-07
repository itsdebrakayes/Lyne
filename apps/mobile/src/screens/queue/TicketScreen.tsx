import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, font, t, type, initials } from '../../lib/theme';
import { useTopPad } from '../../lib/insets';
import { useRefresh } from '../../lib/useRefresh';
import { haptics } from '../../lib/haptics';
import api from '../../lib/apiClient';
import { TicketRecord } from '../../lib/mobileData';
import { useAuth } from '../../hooks/useAuth';
import { cancelDepartureReminder, dismissLiveTicketNotification, registerPushNotifications, scheduleQueueUpdateNotification, updateLiveTicketNotification } from '../../lib/notifications';
import Code39Barcode from '../../components/Code39Barcode';
import { Press } from '../../components/Press';
import { ErrorCard } from '../../components/Feedback';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { HoldButton } from '../../components/HoldButton';
import { LeaveReasonSheet } from '../../components/LeaveReasonSheet';
import { TicketPrinter } from '../../components/TicketPrinter';
import Icon from '../../components/Icon';
import { Ionicons } from '@expo/vector-icons';
import TicketPass from '../../components/TicketPass';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Params = RouteProp<RootStackParamList, 'Ticket'>;

const TERMINAL_META: Record<string, { label: string; tone: string; note: string }> = {
  no_show: { label: 'Place released', tone: colors.busy, note: 'The call window passed, so your spot was released. You can rejoin the queue below.' },
  left: { label: 'You left the queue', tone: colors.muted, note: 'You left this line. Join again whenever you are ready.' },
  cancelled: { label: 'Ticket cancelled', tone: colors.muted, note: 'This ticket was cancelled. You can join a new queue anytime.' },
  served: { label: 'Completed', tone: colors.light, note: 'This visit is complete. See you next time!' },
};

/** A label/value pair from the boarding pass's detail grid. */
function Cell({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <View style={{ flex: wide ? 1.4 : 1, minWidth: 0 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: colors.muted, letterSpacing: 0.5 }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 17, color: colors.ink, marginTop: 4, letterSpacing: -0.4 }}>{value}</Text>
    </View>
  );
}

export default function TicketScreen() {
  const topPad = useTopPad(14);
  const navigation = useNavigation<any>();
  const route = useRoute<Params>();
  const { user } = useAuth();
  const providedTicketId = route.params?.ticketId;
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /* Holds the id of the ticket they just left, so the reason can still be sent
     after the ticket query has moved on. */
  const [askWhy, setAskWhy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState<'idle' | 'enabling' | 'on' | 'denied'>('idle');
  const previous = useRef<{ status?: string; wait?: number }>({});

  const enableAlerts = async () => {
    if (alerts === 'enabling' || alerts === 'on') return;
    try {
      setAlerts('enabling');
      const token = await registerPushNotifications();
      setAlerts(token ? 'on' : 'denied');
    } catch {
      setAlerts('denied');
    }
  };

  const activeTicketQuery = useQuery({
    queryKey: ['active-ticket'],
    queryFn: () => api.get<TicketRecord | null>('/tickets/active'),
    enabled: !providedTicketId,
    refetchInterval: 5_000,
  });
  const ticketId = providedTicketId || activeTicketQuery.data?.id;
  const ticketQuery = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.get<TicketRecord>(`/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
    refetchInterval: 5_000,
  });
  const ticket = ticketQuery.data;
  const { refreshing, onRefresh } = useRefresh(activeTicketQuery.refetch, ticketQuery.refetch);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ticket) return;
    const liveStatuses = ['waiting', 'called', 'in_service'];
    if (previous.current.status && previous.current.status !== ticket.status) {
      // Buzz the phone on the two status changes that matter — being called
      // forward (the whole point of the app) and losing your place.
      if (ticket.status === 'called') haptics.success();
      else if (ticket.status === 'no_show') haptics.error();
      const title = ticket.status === 'called' ? "You're being called" : ticket.status === 'no_show' ? 'You lost your place in line' : 'Queue status updated';
      scheduleQueueUpdateNotification(title, `${ticket.branch_name || 'Your branch'}: ${ticket.status.replace('_', ' ')}`, ticket.id).catch(() => {});
      /* Pull the bell forward to meet the banner.
         The banner is local and fires the instant this 5s poll sees the change;
         the notification list is a separate query that polls every 20-30s. So
         somebody who read "You're being called", swiped it away and opened the
         bell found nothing there — the row existed on the server the whole time,
         the phone simply had not asked yet. Ask now. */
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } else if (previous.current.wait !== undefined && previous.current.wait !== ticket.estimated_wait_minutes) {
      scheduleQueueUpdateNotification('Wait time updated', `Your estimated wait is now ${ticket.estimated_wait_minutes} minutes.`, ticket.id).catch(() => {});
    }
    // Ongoing "live ticket" notification (Android sticky; iOS passive/time-sensitive)
    // mirrors the in-app pill on the lock screen and notification shade.
    if (liveStatuses.includes(ticket.status)) {
      updateLiveTicketNotification({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        status: ticket.status as 'waiting' | 'called' | 'in_service',
        ahead: Math.max(0, (ticket.waiting_position ?? ticket.position ?? 1) - 1),
        estimatedWaitMinutes: ticket.estimated_wait_minutes,
        branchName: ticket.branch_name,
      }).catch(() => {});
    } else if (previous.current.status && liveStatuses.includes(previous.current.status)) {
      dismissLiveTicketNotification();
      // The ticket has gone terminal by any route — served, no-showed, swept at
      // closing. Whatever armed the "head out" alert, it is no longer true.
      cancelDepartureReminder();
    }
    previous.current = { status: ticket.status, wait: ticket.estimated_wait_minutes };
  }, [ticket, queryClient]);

  /* Directions hand off to whatever map app the person actually uses, rather
     than embedding a map nobody asked for. Only apps that are installed are
     offered — listing Waze to somebody who does not have it is a dead option
     dressed as a choice — and the query is the branch by name, which every one
     of them resolves without us shipping coordinates. */
  const openDirections = async () => {
    const target = [ticket?.branch_name, ticket?.business_name, 'Jamaica']
      .filter(Boolean).join(', ');
    const q = encodeURIComponent(target);

    const options: Array<{ label: string; url: string }> = [];
    const candidates = [
      { label: 'Apple Maps', url: `http://maps.apple.com/?q=${q}` },
      { label: 'Google Maps', url: `comgooglemaps://?q=${q}` },
      { label: 'Waze', url: `waze://?q=${q}` },
    ];
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await Linking.canOpenURL(c.url).catch(() => false)) options.push(c);
    }
    /* Apple Maps is always present on iOS, but canOpenURL can still say no
       under an unusual configuration — falling back to the web URL means the
       button never does nothing. */
    if (!options.length) options.push({ label: 'Maps', url: `https://maps.google.com/?q=${q}` });

    if (options.length === 1) {
      Linking.openURL(options[0].url).catch(() => {});
      return;
    }
    Alert.alert(
      'Get directions',
      `Open ${ticket?.branch_name || 'this branch'} in:`,
      [
        ...options.map(o => ({ text: o.label, onPress: () => { Linking.openURL(o.url).catch(() => {}); } })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  // Leaving is irreversible — the place in line is released to the next person
  // and cannot be reclaimed — so it is confirmed rather than fired on one tap.
  const leaveQueue = async () => {
    if (!ticketId) return;
    try {
      setLeaving(true); setError('');
      await api.put(`/tickets/${ticketId}/leave`, {});

      /* Tear down everything that says "you are in a line" before navigating.
         Leaving used to do none of this: the cached ticket stayed in
         react-query for its 30s staleTime, so the tab bar's ticket button and
         the home banner kept insisting the person was still queued for half a
         minute after they had left — and the departure reminder, which had no
         identifier and so no way to be cancelled, went off later for a queue
         they were no longer in. */
      await Promise.all([
        cancelDepartureReminder(),
        dismissLiveTicketNotification(),
        queryClient.invalidateQueries({ queryKey: ['active-ticket'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
      ]);

      setConfirmLeave(false);
      /* Ask, then leave the screen — not before. They are already out of the
         line at this point, so the question costs them nothing and cannot make
         leaving feel gated. */
      setAskWhy(ticketId);
    } catch (caught: unknown) {
      setConfirmLeave(false);
      haptics.error();
      setError(caught instanceof Error ? caught.message : 'Could not leave this queue.');
    } finally {
      setLeaving(false);
    }
  };

  const rejoin = () => {
    if (ticket?.branch_id && ticket?.service_id) {
      navigation.navigate('JoinQueue', { businessId: ticket.business_id || '', branchId: ticket.branch_id, serviceId: ticket.service_id, serviceName: ticket.service_name });
    } else {
      navigation.navigate('Main');
    }
  };

  if (!providedTicketId && activeTicketQuery.isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  }

  // Empty state — the centre tab sits hollow when this is what you'd land on.
  if (!ticketId) return (
    <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <View style={{ width: 132, height: 132, borderRadius: 44, backgroundColor: 'rgba(255,255,255,.07)', alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
        <Icon name="ticketOutline" size={62} color="rgba(255,255,255,.4)" />
      </View>
      <Text style={{ fontFamily: font.extra, fontSize: 24, color: '#fff', letterSpacing: -0.8 }}>You&apos;re not in a line</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: 'rgba(255,255,255,.55)', textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 280 }}>
        Join one and your ticket lives here — your number, your code, and how long you&apos;ve got.
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('Main')}
        style={{ backgroundColor: colors.accent, borderRadius: 17, paddingVertical: 16, paddingHorizontal: 26, marginTop: 24 }}>
        <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Find a branch</Text>
      </TouchableOpacity>
    </View>
  );

  if (ticketQuery.isLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>;
  }
  if (ticketQuery.error || !ticket) {
    return (
      <View style={[t.root, { justifyContent: 'center', padding: 24 }]}>
        <ErrorCard
          title="Ticket unavailable"
          message="Your live ticket could not be loaded. Check your connection and try again."
          onRetry={() => ticketQuery.refetch()}
        />
      </View>
    );
  }

  const ahead = Math.max(0, (ticket.waiting_position ?? ticket.position ?? 1) - 1);
  const active = ['waiting', 'called', 'in_service'].includes(ticket.status);
  const called = ticket.status === 'called';
  const inService = ticket.status === 'in_service';
  const terminal = TERMINAL_META[ticket.status];
  const statusLabel = called
    ? "It's your turn. Head to the counter"
    : inService
      ? 'You are being served now'
      : ticket.status_message || (active ? 'You are in line' : terminal?.label || ticket.status.replace('_', ' '));
  const spot = ticket.waiting_position ?? ticket.position;

  return (
    <View style={{ flex: 1, backgroundColor: colors.dark }}>
      {/* The terminal does not scroll; the paper does. Keeping the header above
          the slot is what lets the ticket feed back INTO the machine when you
          scroll it up, instead of sliding under a picture of one. */}
      <View style={{ paddingHorizontal: 20, paddingTop: topPad }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="back" size={21} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontFamily: font.extra, fontSize: 18, color: '#fff', letterSpacing: -0.4 }}>Your ticket</Text>
        </View>
      </View>

      {/* Prints once, on the visit the ticket was issued — never again for the
          same ticket. This screen is checked over and over while somebody
          waits. */}
      <TicketPrinter printKey={active ? ticketId : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>

        {/* status banner — the one thing that must never be missed */}
        {(called || inService) && (
          <View style={{ backgroundColor: called ? colors.accent : colors.light, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }}>
            <Icon name="check" size={22} color="#fff" />
            <Text style={{ flex: 1, fontFamily: font.extra, fontSize: 14.5, color: '#fff' }}>{statusLabel}</Text>
          </View>
        )}

        {/* The pass, on the boarding-pass model: the journey on a dark panel,
            a perforation, and the scannable half below it. */}
        <TicketPass
          branchName={ticket.branch_name || 'Your branch'}
          serviceName={ticket.service_name || 'Your service'}
          ticketNumber={ticket.ticket_number}
          joinedAt={ticket.joined_at}
          remainingMinutes={Number(ticket.estimated_wait_minutes || 0)}
          place={spot ?? null}
          ahead={ahead}
          inLine={ticket.total_waiting ?? ahead + 1}
          status={ticket.status}
        >
          {/* The stub — the half you hand over, below the tear line. */}
          <View style={{ paddingHorizontal: 12, paddingBottom: 10, alignItems: 'center' }}>
            <Text style={{ fontFamily: font.bold, fontSize: 10, color: colors.muted, letterSpacing: 1 }}>TICKET CODE</Text>
            <Text style={{ fontFamily: font.extra, fontSize: 22, color: colors.ink, letterSpacing: 7, marginTop: 6, marginLeft: 7 }}>
              {ticket.verification_code || '—'}
            </Text>
            <View style={{ marginTop: 14 }}>
              {active && ticket.verification_code ? <Code39Barcode value={ticket.verification_code} color={colors.ink} /> : null}
            </View>
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 12, textAlign: 'center', lineHeight: 17 }}>
              Show this code at the counter when your number is called.
            </Text>

            {/* Wallet.
                The point is offline: at the counter the phone may have no
                signal, and a pass in Wallet scans from the lock screen without
                the app. Signing one needs an Apple Pass Type ID certificate and
                a Google Wallet issuer account — neither exists yet, and both
                arrive with the store enrolment. So the control is present and
                honest rather than absent or, worse, a button that fails
                silently at the counter. */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
              minHeight: 52, borderRadius: 16, paddingHorizontal: 18,
              backgroundColor: colors.surfaceAlt, alignSelf: 'stretch', justifyContent: 'center',
            }}>
              <Ionicons name="wallet-outline" size={19} color={colors.muted} />
              <Text style={{ fontFamily: font.extra, fontSize: 13.5, color: colors.muted }}>
                Add to Apple Wallet
              </Text>
            </View>
            <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: colors.muted, marginTop: 8, textAlign: 'center' }}>
              Wallet passes arrive with the App Store release.
            </Text>
          </View>
        </TicketPass>

        {/* The rows the reference puts under the pass. Each one goes somewhere
            that exists; none is a placeholder. */}
        <View style={{ backgroundColor: 'rgba(255,255,255,.07)', borderRadius: 20, marginTop: 16, overflow: 'hidden' }}>
          {([
            /* No alerts row here. The Notify button below does this job and
               shows its own state in green — two controls for one setting is
               how a screen ends up disagreeing with itself. */
            { icon: 'navigate-outline' as const, label: 'Directions',
              sub: ticket.branch_name || 'Open in Maps',
              onPress: () => openDirections() },
            { icon: 'time-outline' as const, label: 'Visit history',
              sub: 'Every line you have joined',
              onPress: () => navigation.navigate('History') },
          ]).map((row, i) => (
            <TouchableOpacity
              key={row.label}
              onPress={row.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}. ${row.sub}`}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(255,255,255,.08)',
              }}
            >
              <Ionicons name={row.icon} size={19} color={colors.accentOnDark} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 14.5, color: '#fff' }}>{row.label}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
                  {row.sub}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,.35)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* terminal note */}
        {terminal && (
          <View style={{ backgroundColor: 'rgba(255,255,255,.08)', borderRadius: 19, marginTop: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Icon name={ticket.status === 'served' ? 'check' : 'bell'} size={22} color={terminal.tone} />
            <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: 'rgba(255,255,255,.8)', lineHeight: 19 }}>{terminal.note}</Text>
          </View>
        )}

        {!!error && <Text style={{ fontFamily: font.bold, color: colors.busy, marginTop: 12, textAlign: 'center' }}>{error}</Text>}

        {/* actions */}
        <View style={{ marginTop: 22, gap: 10 }}>
          {active ? (
            /* Stacked and full width, not two halves.
               Side by side, "Notify me" and "Leave queue" each had about half a
               phone's width for a two-word label and an icon, so both sat
               cramped and neither looked like the primary. Stacked, the one you
               almost always want is the wide one on top, and leaving — which is
               irreversible — is a deliberate second reach rather than a thumb's
               width away from the thing beside it. */
            <>
              {/* Switched on, the button SETTLES into deep green and the bell
                  fills — the confirmation pattern from the mobile-stuff
                  prototype. It used to go bright green, the same green the app
                  uses for "this line is moving", so a toggle that had merely
                  been set shouted as loudly as a live figure, and white text on
                  it was thin. Deep green with a filled bell reads as done. */}
              <TouchableOpacity
                disabled={alerts === 'enabling' || alerts === 'on'}
                onPress={enableAlerts}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={alerts === 'on' ? 'Alerts are on' : 'Notify me when I am called'}
                accessibilityState={{ disabled: alerts === 'enabling' || alerts === 'on', selected: alerts === 'on' }}
                style={{
                  minHeight: 58, borderRadius: 18,
                  backgroundColor: alerts === 'on' ? colors.successDeep : colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {alerts === 'enabling' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons
                      name={alerts === 'on' ? 'notifications' : 'notifications-outline'}
                      size={18}
                      color="#fff"
                    />
                    <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>
                      {alerts === 'on' ? 'Alerts on' : 'Notify me'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Tap opens the sheet, hold leaves outright.
                  The same gesture on the same button, so the sheet teaches it:
                  you open it once, meet "Hold to leave" inside, and afterwards
                  you can do it from here without the round trip. Anyone who has
                  not learned it yet still gets the sheet and its warning, which
                  is why the shortcut costs nothing to offer. */}
              <View>
                <HoldButton
                  variant="ghost"
                  tone="danger"
                  label="Leave queue"
                  doneLabel="Left the line"
                  hint="Tap to see what you give up, or hold to leave now"
                  busy={leaving}
                  disabled={leaving}
                  /* Matches the prototype's leave button: the same height as
                     Notify beside it, and a border quiet enough that the red
                     word is what carries the warning. */
                  style={{ minHeight: 58, paddingHorizontal: 16, borderColor: 'rgba(255,255,255,.14)' }}
                  onPress={() => { haptics.warning(); setConfirmLeave(true); }}
                  onComplete={leaveQueue}
                />
              </View>
            </>
          ) : terminal && ticket.status !== 'served' ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={rejoin} style={{ flex: 1, minHeight: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Rejoin queue</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Main')} style={{ flex: 1, minHeight: 56, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>Home</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => navigation.navigate('Main')} style={{ flex: 1, minHeight: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Return home</Text>
            </TouchableOpacity>
          )}
        </View>
        {active && alerts === 'on' && <Text style={{ ...type.caption, color: colors.light, textAlign: 'center', marginTop: 12 }}>We&apos;ll ping you when you&apos;re called or the wait changes.</Text>}
        {active && alerts === 'denied' && <Text style={{ ...type.caption, color: 'rgba(255,255,255,.55)', textAlign: 'center', marginTop: 12 }}>Enable notifications in Settings to get called-up alerts.</Text>}
      </ScrollView>
      </TicketPrinter>

      <ConfirmSheet
        visible={confirmLeave}
        title="Leave this queue?"
        message={`You'll give up place ${ticket.waiting_position ?? ticket.position} for ${ticket.service_name || 'this service'}, and it goes to the next person straight away. If you change your mind you can rejoin, but you'll start again at the back of the line.`}
        confirmLabel="Hold to leave"
        cancelLabel="Stay in line"
        icon="exit-outline"
        busy={leaving}
        /* Held, not tapped. Giving up a place is the one thing in this app that
           cannot be undone — rejoining puts you at the back — so it should take
           a gesture nobody performs by accident. */
        hold
        holdDoneLabel="Left the line"
        onConfirm={leaveQueue}
        onCancel={() => setConfirmLeave(false)}
      />

      <LeaveReasonSheet
        visible={!!askWhy}
        onSkip={() => { setAskWhy(null); navigation.navigate('Main'); }}
        onPick={async (reason) => {
          /* A failure here is swallowed on purpose. They have already left the
             queue — that part succeeded and is what matters. Blocking the way
             out with "could not record your reason" would punish the person for
             answering a question we asked. */
          try { await api.put(`/tickets/${askWhy}/leave-reason`, { reason }); } catch { /* noop */ }
          setAskWhy(null);
          navigation.navigate('Main');
        }}
      />
    </View>
  );
}
