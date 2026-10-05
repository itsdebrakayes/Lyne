/**
 * monitoring.js — Sentry wiring for the API and anything else that runs in Node.
 *
 * Mirrors apps/mobile/src/lib/monitoring.ts deliberately: same enable rule, same
 * scrubber shape, same "no DSN means genuinely nothing happens". Two services
 * reporting into one project are only useful if they agree on what an event
 * looks like.
 *
 * NO DSN MEANS OFF. Not "off but warns", not "off but installs handlers" — the
 * init returns before Sentry is touched, so a box without a DSN behaves exactly
 * as it did before this file existed. That matters because the DSN is set per
 * environment and the common case during development is not having one.
 *
 * WHAT LEAVES THIS PROCESS is the narrow part. The API holds TRNs, National ID
 * numbers, dates of birth, phone numbers, Supabase service keys and database
 * credentials. A crash reporter that shipped any of those to a third party
 * would be a worse incident than the crash it was reporting, so:
 *
 *   - sendDefaultPii is off, so no IP addresses, headers or bodies by default;
 *   - request bodies are dropped outright rather than scrubbed, because a
 *     scrubber can only redact the keys it knows and a body is attacker- and
 *     developer-controlled;
 *   - headers are reduced to an allowlist, so a new header cannot leak by
 *     being added somewhere else;
 *   - the user is reduced to two opaque ids, which answer the only question
 *     that matters operationally — how many distinct people and which tenant.
 */
const Sentry = require('@sentry/node');

const DSN = (process.env.SENTRY_DSN || '').trim();

/** The single switch. Everything in this file checks it first. */
const monitoringEnabled = DSN.startsWith('http');

/* Keys whose values must never leave this process. Extends the mobile list with
   the things only a server holds: database and Supabase credentials, and the
   personal fields the API reads but the app never stores. */
const SENSITIVE = /(trn|national_?id|passport|nin|verification_?code|password|token|authorization|cookie|api[-_]?key|secret|service[-_]?key|anon[-_]?key|publishable|dsn|mysql|database[-_]?url|conn(ection)?[-_]?string|email|phone|date_?of_?birth|dob|address)/i;

/** Headers worth having when reading a stack trace, and safe to send. */
const HEADER_ALLOWLIST = new Set(['user-agent', 'content-type', 'accept', 'referer']);

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

/**
 * initMonitoring — call once, before anything else, or not at all.
 *
 * `service` separates the API from the other Node processes that may report
 * into the same project. It is a tag rather than a separate Sentry project so
 * that one alert rule covers the platform and you can still filter.
 */
function initMonitoring({ service = 'api' } = {}) {
  if (!monitoringEnabled) return false;

  Sentry.init({
    dsn: DSN,
    environment: (process.env.NODE_ENV || 'development').trim(),
    /* The deployed commit. deploy.sh exports it; absent, Sentry groups
       everything under one release, which is merely less useful, not broken. */
    release: (process.env.SENTRY_RELEASE || '').trim() || undefined,
    sendDefaultPii: false,
    // A sample is enough to find a slow endpoint, and this is billed per event.
    tracesSampleRate: 0.2,

    beforeSend(event) {
      /* The request, rebuilt from an allowlist rather than filtered.
         Anything not named here does not travel, including things added to the
         request object later by code that has not read this file. */
      if (event.request) {
        const headers = {};
        for (const [k, v] of Object.entries(event.request.headers || {})) {
          if (HEADER_ALLOWLIST.has(k.toLowerCase())) headers[k] = v;
        }
        event.request = {
          method: event.request.method,
          // Query strings carry ids and sometimes more; the path is the useful part.
          url: typeof event.request.url === 'string' ? event.request.url.split('?')[0] : undefined,
          headers,
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

      /* Two opaque ids and nothing else — no email, no username, no IP. Both
         are internal primary keys, so they can be joined back to a person from
         our own database if there is ever a real reason to. */
      if (event.user) {
        event.user = { id: event.user.id, ...(event.user.tenant_id ? { tenant_id: event.user.tenant_id } : {}) };
      }

      return event;
    },
  });

  Sentry.setTag('service', service);
  return true;
}

/**
 * captureServerError — the Express error handler's reporting half.
 *
 * ONLY 5xx. A 4xx is the caller being told no, which is the system working:
 * a rejected CORS origin, an expired token, a validation failure and a 404 are
 * all normal traffic. Reporting them produces an alert feed nobody reads, and
 * the one real 500 arrives in the middle of it.
 */
function captureServerError(err, req) {
  if (!monitoringEnabled) return;
  const status = Number(err?.status || err?.statusCode || 500);
  if (status < 500) return;
  if (err?.name === 'CorsError') return;

  Sentry.withScope((scope) => {
    scope.setTag('http.status', String(status));
    if (req?.method && req?.route?.path) scope.setTag('route', `${req.method} ${req.route.path}`);

    /* Identity is read here rather than in a middleware because auth is applied
       per route, not globally — there is no single point after requireAuth that
       every request passes through. req.dbStaff / req.dbUser are the rows the
       auth middleware already looked up, so this costs nothing and is correct
       for anonymous callers too: they simply have neither, and no user is set. */
    const id = req?.dbStaff?.id || req?.dbUser?.id || null;
    const tenantId = req?.dbStaff?.business_id || null;
    if (id || tenantId) {
      scope.setUser({ ...(id ? { id } : {}), ...(tenantId ? { tenant_id: tenantId } : {}) });
    }

    Sentry.captureException(err);
  });
}

/** A handled failure worth knowing about — a job that failed, not a request. */
function reportHandled(error, context) {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { extra: scrub(context || {}) });
}

module.exports = {
  Sentry,
  monitoringEnabled,
  initMonitoring,
  captureServerError,
  reportHandled,
  // exported for the tests
  scrub,
  SENSITIVE,
};
