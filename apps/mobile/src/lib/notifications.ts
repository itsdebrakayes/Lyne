import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import api from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android: queue updates are the whole point of the app — max importance so
// they heads-up over other apps, plus a persistent "live ticket" channel that
// mirrors the in-app active-ticket pill (Android's version of a Live Activity).
// iOS Live Activities (lock screen + Dynamic Island) additionally need an EAS
// dev build with an ActivityKit widget extension — see design-specs/queue-notifications.html.
export async function ensureNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('queue-alerts', {
    name: 'Queue alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 240, 120, 240],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('live-ticket', {
    name: 'Live ticket',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

const LIVE_TICKET_ID = 'live-ticket';

type LiveTicketInput = {
  ticketId: string;
  ticketNumber: string;
  status: 'waiting' | 'called' | 'in_service';
  ahead: number;
  estimatedWaitMinutes: number;
  branchName?: string;
};

/**
 * Keep one persistent, silently-updating notification while the user is in
 * line — like a media/Uber ongoing notification. Replaced in place on every
 * position change; dismissed when the ticket goes terminal.
 */
export async function updateLiveTicketNotification(input: LiveTicketInput) {
  const { status } = input;
  const title = status === 'called'
    ? `${input.ticketNumber} — it's your turn!`
    : status === 'in_service'
      ? `${input.ticketNumber} · being served`
      : `Ticket ${input.ticketNumber} · ${input.ahead} ahead`;
  const body = status === 'called'
    ? 'Head to the counter and show your code'
    : `${input.branchName || 'Your branch'} · ~${input.estimatedWaitMinutes} min`;

  await ensureNotificationChannels();
  return Notifications.scheduleNotificationAsync({
    identifier: LIVE_TICKET_ID,
    content: {
      title,
      body,
      data: { ticketId: input.ticketId, live: true },
      ...(Platform.OS === 'android' ? {
        sticky: status !== 'called',
        color: '#1fc2de',
        channelId: status === 'called' ? 'queue-alerts' : 'live-ticket',
      } : {
        interruptionLevel: status === 'called' ? 'timeSensitive' : 'passive',
      }),
    } as Notifications.NotificationContentInput,
    trigger: null,
  });
}

export async function dismissLiveTicketNotification() {
  await Notifications.dismissNotificationAsync(LIVE_TICKET_ID).catch(() => {});
}

type DepartureReminderInput = {
  ticketId?: string;
  branchName: string;
  branchLatitude?: number;
  branchLongitude?: number;
  estimatedWaitMinutes: number;
  leadTimeMinutes?: number;
};

function projectId() {
  return Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
}

export async function registerPushNotifications() {
  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = existing.status === 'granted'
    ? existing.status
    : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') return null;

  const id = projectId();
  const token = id
    ? (await Notifications.getExpoPushTokenAsync({ projectId: id })).data
    : (await Notifications.getExpoPushTokenAsync()).data;

  await api.post('/notifications/register-device', {
    expo_push_token: token,
    platform: Platform.OS,
    device_name: Constants.deviceName || null,
  });

  return token;
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return r * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

export async function scheduleDepartureReminder(input: DepartureReminderInput) {
  if (input.branchLatitude === undefined || input.branchLongitude === undefined) return null;

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const km = distanceKm(
    current.coords.latitude,
    current.coords.longitude,
    input.branchLatitude,
    input.branchLongitude
  );

  const travelMinutes = Math.max(5, Math.ceil((km / 30) * 60));
  const leadTime = input.leadTimeMinutes ?? 10;
  const secondsUntilReminder = Math.max(60, (input.estimatedWaitMinutes - travelMinutes - leadTime) * 60);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to head out',
      // Neutral on the lock screen — the branch name is in the app, where it
      // sits behind authentication. See PUSH_TITLES in backend routes/tickets.js.
      body: 'Leave soon to arrive before your turn. Open Lyne for the details.',
      data: { ticketId: input.ticketId, branchName: input.branchName },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilReminder,
      repeats: false,
    },
  });
}

export async function scheduleQueueUpdateNotification(title: string, body: string, ticketId?: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { ticketId } },
    trigger: null,
  });
}
