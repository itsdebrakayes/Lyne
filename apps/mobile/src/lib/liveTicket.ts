/**
 * liveTicket.ts — the ticket that follows you out of the app.
 *
 * iOS 16.2+: a Live Activity on the lock screen and in the Dynamic Island
 * (targets/live-activity), started on the first sight of a live ticket and
 * updated from then on, by the app while it is open and by the server through
 * APNs while it is not (it registers the activity's push token with the API).
 *
 * Android, and older iPhones: the ongoing "live ticket" notification
 * (lib/notifications.ts), which the server keeps current with silent data
 * pushes while the app is closed (lib/liveTicketTask.ts).
 *
 * Callers pass whatever ticket they have; repeated identical states are
 * dropped here, so it is safe to call from every poll.
 */
import { Platform } from 'react-native';
import api from './apiClient';
import { LiveActivity, TicketState } from '../../modules/live-activity/src';
import { dismissLiveTicketNotification, updateLiveTicketNotification } from './notifications';

type LiveTicket = {
  id: string;
  status: string;
  ticket_number: string;
  waiting_position?: number | null;
  position?: number | null;
  estimated_wait_minutes?: number;
  branch_name?: string | null;
  business_name?: string | null;
  service_name?: string | null;
  joined_at?: string | null;
  verification_code?: string | null;
};

const LIVE = ['waiting', 'called', 'in_service'];

let activeTicketId: string | null = null;
let aheadAtStart = 0;
let lastSent = '';
let tokenSub: { remove(): void } | null | undefined = null;

function stateOf(t: LiveTicket): TicketState {
  const status = (LIVE.includes(t.status) ? t.status : 'ended') as TicketState['status'];
  const ahead = status === 'waiting' ? Math.max(0, (t.waiting_position ?? t.position ?? 1) - 1) : 0;
  if (aheadAtStart < ahead) aheadAtStart = ahead;
  const progress = status === 'waiting'
    ? (aheadAtStart > 0 ? Math.min(0.97, (aheadAtStart - ahead) / aheadAtStart) : 0.97)
    : 1;
  return {
    status,
    ahead,
    waitMinutes: status === 'waiting' ? Math.max(0, Math.round(t.estimated_wait_minutes ?? 0)) : 0,
    progress: Math.round(progress * 100) / 100,
    code: status === 'called' ? t.verification_code ?? null : null,
  };
}

function useActivity(): boolean {
  return Platform.OS === 'ios' && LiveActivity.isSupported();
}

export async function syncLiveTicket(ticket: LiveTicket | null | undefined): Promise<void> {
  if (!ticket || !LIVE.includes(ticket.status)) {
    if (ticket && ticket.id === activeTicketId) await endLiveTicket(ticket);
    return;
  }
  if (ticket.id !== activeTicketId) {
    activeTicketId = ticket.id;
    aheadAtStart = 0;
    lastSent = '';
  }
  const state = stateOf(ticket);
  const key = JSON.stringify(state);
  if (key === lastSent) return;
  lastSent = key;

  if (useActivity()) {
    const started = await LiveActivity.start({
      ticketNumber: ticket.ticket_number,
      businessName: ticket.business_name || 'Lyne',
      branchName: ticket.branch_name || 'Your branch',
      serviceName: ticket.service_name || '',
      joinedAt: ticket.joined_at ? new Date(ticket.joined_at).getTime() : Date.now(),
    }, state).catch(() => null);
    if (started) {
      await LiveActivity.update(state).catch(() => {});
      if (!tokenSub) {
        const ticketId = ticket.id;
        tokenSub = LiveActivity.onPushToken(({ token }) => {
          api.post(`/tickets/${ticketId}/live-activity`, { push_token: token }).catch(() => {});
        });
      }
      return;
    }
  }
  await updateLiveTicketNotification({
    ticketId: ticket.id,
    ticketNumber: ticket.ticket_number,
    status: state.status as 'waiting' | 'called' | 'in_service',
    ahead: state.ahead,
    estimatedWaitMinutes: state.waitMinutes,
    branchName: ticket.branch_name ?? undefined,
  }).catch(() => {});
}

/** The ticket is over (served, left, no-show, marked incomplete): take it off the lock screen. */
export async function endLiveTicket(ticket?: LiveTicket): Promise<void> {
  const ending = ticket ? stateOf({ ...ticket, status: 'ended' }) : null;
  activeTicketId = null;
  aheadAtStart = 0;
  lastSent = '';
  tokenSub?.remove();
  tokenSub = null;
  if (Platform.OS === 'ios') await LiveActivity.end(ending, false).catch(() => {});
  await dismissLiveTicketNotification();
}
