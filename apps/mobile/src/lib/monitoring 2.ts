/**
 * monitoring.ts — Sentry wiring.
 *
 * Deliberately a no-op until a DSN is configured, so the app is safe to run and
 * ship before the Sentry account exists: no DSN means no init, no network, no
 * crash on boot. Set EXPO_PUBLIC_SENTRY_DSN (or `extra.sentryDsn`) to turn it on.
 *
 * What is sent is scoped on purpose. This app holds TRN and National ID numbers,
 * so `sendDefaultPii` stays off and a scrubber strips anything that looks like
 * an identifier or a token before the event leaves the device. A crash reporter
 * that quietly ships government IDs to a third party would be a worse problem
 * than the crash.
 */
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

const extra = (Constants.expoConfig?.extra || {}) as { sentryDsn?: string };
const DSN = (process.env.EXPO_PUBLIC_SENTRY_DSN || extra.sentryDsn || '').trim();

export const monitoringEnabled = DSN.startsWith('http');

/** Keys whose values must never leave the device. */
const SENSITIVE = /(trn|national_?id|passport|nin|verification_?code|password|token|authorization|api[-_]?key|secret)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function initMonitoring() {
  if (!monitoringEnabled) return;

  Sentry.init({
    dsn: DSN,
    // Never attach emails, usernames or IP addresses automatically.
    sendDefaultPii: false,
    // Full traces on a queue app would be mostly noise and mostly cost; a
    // sample is enough to spot a slow screen.
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
    beforeSend(event) {
      if (event.request) event.request = scrub(event.request) as typeof event.request;
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      // The user id is useful for "how many people hit this"; the rest is not.
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

/**
 * Tie errors to a user WITHOUT sending who they are. The id alone answers the
 * only question that matters operationally — how many distinct people hit this
 * — and it can be joined back to a person from our own database if we ever
 * genuinely need to.
 */
export function identifyForMonitoring(userId?: string | null) {
  if (!monitoringEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Report a handled error with context, for failures we catch but shouldn't ignore. */
export function reportHandled(error: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { extra: scrub(context || {}) as Record<string, unknown> });
}

export { Sentry };
