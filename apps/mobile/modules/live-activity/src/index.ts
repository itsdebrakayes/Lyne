/**
 * live-activity — the ticket on the iOS lock screen and in the Dynamic Island.
 *
 * iOS only (ActivityKit, 16.2+). On Android, and on older iPhones, isSupported()
 * is false and nothing else should be called; lib/liveTicket.ts handles that.
 */
import { Platform } from 'react-native';
import { EventSubscription, requireNativeModule } from 'expo-modules-core';

export interface TicketAttributes {
  ticketNumber: string;
  businessName: string;
  branchName: string;
  serviceName: string;
  /** ms since epoch */
  joinedAt: number;
}

export interface TicketState {
  status: 'waiting' | 'called' | 'in_service' | 'ended';
  ahead: number;
  waitMinutes: number;
  progress: number;
  code?: string | null;
}

interface LiveActivityNative {
  isSupported(): boolean;
  start(attrs: TicketAttributes, state: TicketState): Promise<string | null>;
  update(state: TicketState): Promise<void>;
  end(state: TicketState | null, immediately: boolean): Promise<void>;
  addListener(event: 'onPushToken', listener: (e: { activityId: string; token: string }) => void): EventSubscription;
}

const native: LiveActivityNative | null = Platform.OS === 'ios' ? requireNativeModule<LiveActivityNative>('LiveActivity') : null;

export const LiveActivity = {
  isSupported: () => (native ? native.isSupported() : false),
  start: (attrs: TicketAttributes, state: TicketState) => (native ? native.start(attrs, state) : Promise.resolve(null)),
  update: (state: TicketState) => (native ? native.update(state) : Promise.resolve()),
  end: (state: TicketState | null = null, immediately = false) => (native ? native.end(state, immediately) : Promise.resolve()),
  onPushToken: (listener: (e: { activityId: string; token: string }) => void) => native?.addListener('onPushToken', listener),
};
