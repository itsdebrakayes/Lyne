/**
 * liveTicketTask.ts — Android's ongoing ticket notification, kept current
 * while the app is closed.
 *
 * The server sends a silent data push ("live-ticket") to the customer's
 * Android devices whenever their line moves (apps/backend/src/utils/
 * liveUpdates.js). This task receives it in the background and redraws the
 * ongoing notification, so the shade shows "3 ahead" without opening the app.
 * iOS gets the same updates through its Live Activity instead.
 *
 * Defined at module load: TaskManager requires the task to exist before the
 * JS runtime is asked to run it, so App.tsx imports this file first.
 */
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { dismissLiveTicketNotification, updateLiveTicketNotification } from './notifications';

export const LIVE_TICKET_TASK = 'lyne-live-ticket';

type LivePayload = {
  type?: string;
  ticketId?: string;
  ticketNumber?: string;
  branchName?: string;
  status?: string;
  ahead?: number;
  waitMinutes?: number;
};

/** Expo delivers data pushes in a few shapes depending on platform and state. */
function readPayload(data: unknown): LivePayload | null {
  const d = data as Record<string, any> | undefined;
  const candidates = [d?.data, d?.notification?.request?.content?.data, d?.notification?.data, d];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c.body === 'string') {
      try { const parsed = JSON.parse(c.body); if (parsed?.type === 'live-ticket') return parsed; } catch { /* not JSON */ }
    }
    if (typeof c.dataString === 'string') {
      try { const parsed = JSON.parse(c.dataString); if (parsed?.type === 'live-ticket') return parsed; } catch { /* not JSON */ }
    }
    if (c.type === 'live-ticket') return c as LivePayload;
  }
  return null;
}

if (Platform.OS === 'android') {
  TaskManager.defineTask(LIVE_TICKET_TASK, async ({ data, error }) => {
    if (error) return;
    const p = readPayload(data);
    if (!p || !p.ticketId || !p.ticketNumber) return;
    if (p.status === 'ended') { await dismissLiveTicketNotification(); return; }
    if (p.status !== 'waiting' && p.status !== 'called' && p.status !== 'in_service') return;
    await updateLiveTicketNotification({
      ticketId: p.ticketId,
      ticketNumber: p.ticketNumber,
      status: p.status,
      ahead: Number(p.ahead) || 0,
      estimatedWaitMinutes: Number(p.waitMinutes) || 0,
      branchName: p.branchName,
    });
  });
}

export async function registerLiveTicketTask(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try { await Notifications.registerTaskAsync(LIVE_TICKET_TASK); } catch { /* already registered */ }
}
