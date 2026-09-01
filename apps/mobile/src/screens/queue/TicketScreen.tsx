import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
import { TicketPrinter } from '../../components/TicketPrinter';
import Icon from '../../components/Icon';
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
  }, [ticket]);

  // Leaving is irreversible — the place in line is released to the next person
  // and cannot be reclaimed — so it is confirmed rather than fired on one tap.
  const queryClient = useQueryClient();

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
      navigation.navigate('Main');
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

        {/* the pass */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 28 }}>
          <View style={{ padding: 24, paddingBottom: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.muted, letterSpacing: 0.5 }}>
                {ticket.ticket_number}{spot ? ` · SPOT ${spot}` : ''}
              </Text>
              <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.ink }}>{initials(ticket.business_name || ticket.branch_name)}</Text>
            </View>

            {/* your number → the front of the line */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 26, marginBottom: 6 }}>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 46, color: colors.ink, letterSpacing: -2.2, lineHeight: 48 }}>{ticket.ticket_number}</Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8 }}>Your number</Text>
              </View>
              <View style={{ marginLeft: 'auto', alignItems: 'flex-end', paddingLeft: 12 }}>
                <Text style={{ fontFamily: font.extra, fontSize: 46, color: called ? colors.accent : colors.ink, letterSpacing: -2.2, lineHeight: 48 }}>
                  {called ? 'NOW' : ahead}
                </Text>
                <Text style={{ fontFamily: font.semibold, fontSize: 12.5, color: colors.muted, marginTop: 8 }}>
                  {called ? "It's your turn" : 'Ahead of you'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', marginTop: 26 }}>
              <Cell label="EST. WAIT" value={active ? `${ticket.estimated_wait_minutes}m` : '—'} />
              <Cell label="IN THIS LINE" value={ticket.total_waiting ?? ahead + 1} />
              <Cell label="STATUS" value={active ? (called ? 'Called' : inService ? 'Serving' : 'Waiting') : (terminal?.label || '—')} wide />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 22 }}>
              <Cell label="BRANCH" value={ticket.branch_name || '—'} wide />
              <Cell label="SERVICE" value={ticket.service_name || '—'} wide />
            </View>

            {/* The person, not the agency. This read "Passport Office of
                Jamaica" under a TICKET HOLDER label, which is the one line on
                a pass that has to name whoever is standing there. */}
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: colors.muted, letterSpacing: 0.5 }}>TICKET HOLDER</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.extra, fontSize: 29, color: colors.ink, letterSpacing: -1.1, marginTop: 5 }}>
                {user?.full_name || 'You'}
              </Text>
            </View>
          </View>

          {/* perforation — notches punched out of the pass in the page colour */}
          <View style={{ height: 30, marginTop: 24, justifyContent: 'center' }}>
            <View style={{ position: 'absolute', left: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.dark }} />
            <View style={{ position: 'absolute', right: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.dark }} />
            <View style={{ marginHorizontal: 18, borderTopWidth: 1.8, borderStyle: 'dashed', borderColor: '#D3D9E3' }} />
          </View>

          {/* the code you hand over */}
          <View style={{ padding: 24, paddingTop: 4, alignItems: 'center' }}>
            {active && ticket.verification_code ? <Code39Barcode value={ticket.verification_code} color={colors.ink} /> : null}
            <Text style={{ fontFamily: font.extra, fontSize: 20, color: colors.ink, letterSpacing: 8, marginTop: 13, marginLeft: 8 }}>
              {ticket.verification_code || '—'}
            </Text>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.muted, marginTop: 6, letterSpacing: 0.5 }}>SHOW THIS CODE AT THE COUNTER</Text>
          </View>
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
        <View style={{ marginTop: 22, flexDirection: 'row', gap: 12 }}>
          {active ? (
            <>
              <TouchableOpacity
                disabled={alerts === 'enabling' || alerts === 'on'}
                onPress={enableAlerts}
                style={{ flex: 1, minHeight: 56, borderRadius: 18, backgroundColor: alerts === 'on' ? colors.light : colors.accent, alignItems: 'center', justifyContent: 'center' }}
              >
                {alerts === 'enabling' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="bell" size={18} color="#fff" />
                    <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>{alerts === 'on' ? 'Alerts on' : 'Notify me'}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Tap opens the sheet, hold leaves outright.
                  The same gesture on the same button, so the sheet teaches it:
                  you open it once, meet "Hold to leave" inside, and afterwards
                  you can do it from here without the round trip. Anyone who has
                  not learned it yet still gets the sheet and its warning, which
                  is why the shortcut costs nothing to offer. */}
              <View style={{ flex: 1 }}>
                <HoldButton
                  variant="ghost"
                  tone="danger"
                  label="Leave queue"
                  doneLabel="Left the line"
                  hint="Tap to see what you give up, or hold to leave now"
                  busy={leaving}
                  disabled={leaving}
                  style={{ minHeight: 56, paddingHorizontal: 16 }}
                  onPress={() => { haptics.warning(); setConfirmLeave(true); }}
                  onComplete={leaveQueue}
                />
              </View>
            </>
          ) : terminal && ticket.status !== 'served' ? (
            <>
              <TouchableOpacity onPress={rejoin} style={{ flex: 1, minHeight: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: colors.accentInk }}>Rejoin queue</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Main')} style={{ flex: 1, minHeight: 56, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.extra, fontSize: 15, color: '#fff' }}>Home</Text>
              </TouchableOpacity>
            </>
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
    </View>
  );
}
