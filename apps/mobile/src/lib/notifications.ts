/// <reference path="../types/expo-location.d.ts" />
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import api from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
      body: `Leave soon to reach ${input.branchName} before your queue is called.`,
      data: { ticketId: input.ticketId, branchName: input.branchName },
    },
    trigger: { seconds: secondsUntilReminder },
  });
}

export async function scheduleQueueUpdateNotification(title: string, body: string, ticketId?: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { ticketId } },
    trigger: null,
  });
}
