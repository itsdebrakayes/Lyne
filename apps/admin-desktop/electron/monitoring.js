/**
 * monitoring.js — Sentry for the Electron main process.
 *
 * Same contract as apps/backend/src/lib/monitoring.js and the mobile module:
 * no DSN means no init, no handlers, no network, no warning.
 *
 * TWO THINGS ARE DELIBERATE HERE.
 *
 * 1. PACKAGED BUILDS ONLY. `npm run dev` runs this same file, and a developer's
 *    own typo is not an incident. Reporting from a dev machine also pollutes
 *    the release grouping with a commit that was never shipped.
 *
 * 2. THE RENDERER REPORTS THROUGH THIS PROCESS, NOT OVER THE NETWORK.
 *    @sentry/electron's renderer SDK forwards events to main over IPC, and main
 *    is a Node process with no origin and no CORS. That matters because the
 *    packaged renderer is served from the custom app://lyne-admin origin (see
 *    main.js): a renderer talking to sentry.io directly would be a cross-origin
 *    request from a scheme Sentry's ingest has never heard of, and the obvious
 *    "fixes" for that are the ones this app spent a commit removing —
 *    webSecurity:false, or widening something. Over IPC the question does not
 *    arise, and no CSP needs loosening either.
 *
 *    The link is electron/preload.js, which imports @sentry/electron/preload.
 *    With contextIsolation on, that import is what exposes the IPC channel; the
 *    renderer silently cannot report without it.
 */
const { app } = require('electron');
const Sentry = require('@sentry/electron/main');

/* Vite replaces import.meta.env in the RENDERER bundle, not here — the main
   process is bundled separately and reads process.env at build time. Both are
   fed the same VITE_SENTRY_DSN so there is one variable to set, not two. */
const DSN = (process.env.VITE_SENTRY_DSN || process.env.SENTRY_DSN || '').trim();

const monitoringEnabled = DSN.startsWith('http') && app.isPackaged;

const SENSITIVE = /(trn|national_?id|passport|nin|verification_?code|password|token|authorization|cookie|api[-_]?key|secret|service[-_]?key|anon[-_]?key|publishable|dsn|mysql|database[-_]?url|conn(ection)?[-_]?string|email|phone|date_?of_?birth|dob|address)/i;

function scrub(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function initMonitoring() {
  if (!monitoringEnabled) return false;

  Sentry.init({
    dsn: DSN,
    environment: 'production',
    release: (process.env.VITE_SENTRY_RELEASE || '').trim() || `lyne-admin@${app.getVersion()}`,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,

    beforeSend(event) {
      if (event.request) {
        event.request = {
          method: event.request.method,
          url: typeof event.request.url === 'string' ? event.request.url.split('?')[0] : undefined,
        };
      }
      if (event.extra) event.extra = scrub(event.extra);
      if (event.contexts) event.contexts = scrub(event.contexts);
      if (event.tags) event.tags = scrub(event.tags);

      /* Frame locals are off by default in this SDK, but `includeLocalVariables`
         is one line away and a request object is a local in every route handler.
         Stripping them here means turning that on later cannot quietly start
         shipping request bodies. (Source context — the few lines around each
         frame — IS attached, and is deliberately kept: it is our own source,
         which holds no customer data, and it is what makes a trace readable.) */
      for (const value of event.exception?.values || []) {
        for (const frame of value.stacktrace?.frames || []) delete frame.vars;
      }
      /* Two opaque ids at most. The admin app signs staff in, so the email is
         right there in the session and must not ride along. */
      if (event.user) {
        event.user = {
          id: event.user.id,
          ...(event.user.tenant_id ? { tenant_id: event.user.tenant_id } : {}),
        };
      }
      return event;
    },

    /* Breadcrumbs are the quiet leak in a desktop app: every fetch URL and
       every console.log is recorded by default, and this renderer logs API
       responses while developing. */
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'console') return null;
      if (crumb.data && typeof crumb.data === 'object') crumb.data = scrub(crumb.data);
      if (typeof crumb.data?.url === 'string') crumb.data.url = crumb.data.url.split('?')[0];
      return crumb;
    },
  });

  Sentry.setTag('service', 'admin-desktop');
  Sentry.setTag('platform', process.platform);
  return true;
}

module.exports = { initMonitoring, monitoringEnabled, scrub, SENSITIVE, Sentry };
