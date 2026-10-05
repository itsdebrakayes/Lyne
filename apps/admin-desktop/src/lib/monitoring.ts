/**
 * monitoring.ts — Sentry for the admin RENDERER.
 *
 * This does not talk to sentry.io. @sentry/electron/renderer hands events to
 * the main process over IPC and main sends them, which is the whole reason the
 * packaged app can report at all: the renderer is served from the custom
 * app://lyne-admin origin, and a direct connection from there would be a
 * cross-origin request from a scheme Sentry's ingest has never seen. Routing
 * through main means no CORS question, no CSP entry, and nothing loosened.
 *
 * The bridge is electron/preload.js, which imports @sentry/electron/preload.
 * Remove that import and this file still initialises, still looks healthy, and
 * reports nothing.
 *
 * Packaged builds only, same as the main process: `npm run dev` is not an
 * environment anybody should be alerted about.
 */
import * as Sentry from '@sentry/electron/renderer';

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || '';

/* PROD rather than a packaged-app check, because the renderer cannot see
   app.isPackaged. Vite sets this false for `npm run dev` and true for the build
   that goes into the installer, which is the same line. The main process
   enforces the real gate regardless — if it decided not to initialise, the IPC
   transport has nowhere to deliver and nothing is sent. */
export const monitoringEnabled = DSN.startsWith('http') && import.meta.env.PROD;

const SENSITIVE = /(trn|national_?id|passport|nin|verification_?code|password|token|authorization|cookie|api[-_]?key|secret|service[-_]?key|anon[-_]?key|publishable|dsn|mysql|database[-_]?url|conn(ection)?[-_]?string|email|phone|date_?of_?birth|dob|address)/i;

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
  if (!monitoringEnabled) return false;

  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      if (event.request) {
        event.request = {
          method: event.request.method,
          url: typeof event.request.url === 'string' ? event.request.url.split('?')[0] : undefined,
        };
      }
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.user) {
        event.user = {
          id: event.user.id,
          ...(event.user.tenant_id ? { tenant_id: event.user.tenant_id } : {}),
        };
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      // Console breadcrumbs carry whatever the app logged, which while
      // developing includes API responses.
      if (crumb.category === 'console') return null;
      if (crumb.data && typeof crumb.data === 'object') {
        crumb.data = scrub(crumb.data) as typeof crumb.data;
      }
      return crumb;
    },
  });

  return true;
}

/**
 * Tie errors to a signed-in administrator WITHOUT saying who they are.
 *
 * The admin session holds the staff email; only the staff row id and the
 * business id travel, which answer "how many people" and "which tenant" and
 * can be joined back from our own database if there is ever a real reason.
 */
export function identifyForMonitoring(staffId?: string | null, businessId?: string | null) {
  if (!monitoringEnabled) return;
  if (!staffId && !businessId) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    ...(staffId ? { id: staffId } : {}),
    ...(businessId ? { tenant_id: businessId } : {}),
  });
}

/** A failure we caught but should not ignore. */
export function reportHandled(error: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { extra: scrub(context || {}) as Record<string, unknown> });
}

export { Sentry };
