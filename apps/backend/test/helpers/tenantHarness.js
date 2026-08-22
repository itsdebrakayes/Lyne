/**
 * tenantHarness — a real API server with a fake database, for isolation tests.
 *
 * The checklist's bar is that a caller from Company A must never retrieve
 * Company B's data "by changing an identifier or API call". Asserting which
 * middleware a route is wired with does not prove that: the wiring can be right
 * while the check inside is wrong. So these tests mount the real routers behind
 * the real auth and tenant middleware, and send real HTTP requests.
 *
 * Only two things are faked, and both are external services rather than our
 * logic: Supabase token verification (a token here is just an actor id) and the
 * MySQL pool (which answers the middleware's queries from fixtures). Every
 * authorization decision under test is the production code path.
 */
const express = require('express');
const Module = require('module');

// ── Fixture world ─────────────────────────────────────────────
// Two businesses that must never see each other, and a second branch inside
// business A so branch-level scoping can be tested separately from tenant
// scoping.
const WORLD = {
  businesses: { 'biz-a': {}, 'biz-b': {} },
  branches: {
    'branch-a1': { business_id: 'biz-a' },
    'branch-a2': { business_id: 'biz-a' },
    'branch-b1': { business_id: 'biz-b' },
  },
  queues: {
    'queue-a1': { branch_id: 'branch-a1', service_id: 'svc-a', business_id: 'biz-a' },
    'queue-a2': { branch_id: 'branch-a1', service_id: 'svc-other', business_id: 'biz-a' },
    'queue-b1': { branch_id: 'branch-b1', service_id: 'svc-b', business_id: 'biz-b' },
  },
  tickets: {
    'ticket-a1': { queue_id: 'queue-a1', user_id: 'user-1', branch_id: 'branch-a1', service_id: 'svc-a', business_id: 'biz-a' },
    'ticket-b1': { queue_id: 'queue-b1', user_id: 'user-2', branch_id: 'branch-b1', service_id: 'svc-b', business_id: 'biz-b' },
  },
};

const ACTORS = {
  'exec-a':  { kind: 'staff', row: { id: 'exec-a', business_id: 'biz-a', branch_id: null, role_name: 'executive', is_active: 1 } },
  'mgr-a':   { kind: 'staff', row: { id: 'mgr-a', business_id: 'biz-a', branch_id: 'branch-a1', role_name: 'manager', is_active: 1 } },
  'staff-a': { kind: 'staff', row: { id: 'staff-a', business_id: 'biz-a', branch_id: 'branch-a1', role_name: 'line_staff', assigned_service_id: 'svc-a', is_active: 1 } },
  'mgr-b':   { kind: 'staff', row: { id: 'mgr-b', business_id: 'biz-b', branch_id: 'branch-b1', role_name: 'manager', is_active: 1 } },
  'user-1':  { kind: 'user', row: { id: 'user-1', supabase_uid: 'user-1' } },
  'user-2':  { kind: 'user', row: { id: 'user-2', supabase_uid: 'user-2' } },
};

const squash = (sql) => sql.replace(/\s+/g, ' ').trim();

/**
 * Answers the queries the auth and tenant middleware actually run. Anything
 * else returns no rows: a handler starved of data still produces a non-403,
 * which is all these tests need to distinguish "allowed through" from "denied".
 */
function fakeQuery(sql, params = []) {
  const q = squash(sql);

  if (q.includes('FROM staff s JOIN roles r')) {
    const actor = ACTORS[params[0]];
    return [actor && actor.kind === 'staff' ? [actor.row] : []];
  }
  if (q.startsWith('SELECT * FROM users WHERE supabase_uid')) {
    const actor = ACTORS[params[0]];
    return [actor && actor.kind === 'user' ? [actor.row] : []];
  }
  // Session limiter: nothing revoked, no session pressure.
  if (q.includes('FROM token_revocations')) return [[]];
  if (q.includes('user_sessions')) return [[{ active: 1 }]];

  if (q.startsWith('SELECT business_id FROM branches WHERE id')) {
    const branch = WORLD.branches[params[0]];
    return [branch ? [{ business_id: branch.business_id }] : []];
  }
  if (q.includes('FROM queues q JOIN branches b')) {
    const queue = WORLD.queues[params[0]];
    return [queue ? [{ business_id: queue.business_id, branch_id: queue.branch_id, service_id: queue.service_id }] : []];
  }
  if (q.includes('FROM queue_tickets t JOIN queues q')) {
    const ticket = WORLD.tickets[params[0]];
    return [ticket ? [{ user_id: ticket.user_id, business_id: ticket.business_id, branch_id: ticket.branch_id, service_id: ticket.service_id }] : []];
  }
  // Line staff counter assignments: none, so access rests on the staff row's
  // own branch and assigned service.
  if (q.includes('FROM staff_assignments sa')) return [[]];

  // Serve the ticket row itself. Handlers like PUT /:id/leave carry no
  // ownership check of their own — they trust requireTicketAccess entirely. If
  // this returned nothing they would 404, and a test asserting "denied" would
  // pass even with the ownership check removed. Returning a live, leavable
  // ticket means only real authorization can produce the refusal.
  if (q.includes('FROM queue_tickets WHERE id')) {
    const ticket = WORLD.tickets[params[0]];
    return [ticket ? [{ id: params[0], status: 'waiting', queue_id: ticket.queue_id, user_id: ticket.user_id, position: 1 }] : []];
  }

  return [[]];
}

const fakePool = {
  query: async (sql, params) => fakeQuery(sql, params),
  execute: async (sql, params) => fakeQuery(sql, params),
  getConnection: async () => ({
    query: async (sql, params) => fakeQuery(sql, params),
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  }),
};

/** Put a stub in the module cache so requiring the real code picks it up. */
function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

let app;

function buildApp() {
  if (app) return app;

  process.env.SUPABASE_URL = 'https://tenant-harness.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'harness-key';

  // A token is the actor id. Verification is Supabase's job, not ours, and it
  // is the only part of the auth path these tests are not exercising.
  stubModule('@supabase/supabase-js', {
    createClient: () => ({
      auth: {
        getUser: async (token) => (ACTORS[token]
          ? { data: { user: { id: token } }, error: null }
          : { data: { user: null }, error: new Error('bad token') }),
      },
    }),
  }, module);

  stubModule('../../src/db/pool', fakePool, module);

  const built = express();
  built.use(express.json());
  built.use('/api/queues', require('../../src/routes/queues'));
  built.use('/api/tickets', require('../../src/routes/tickets'));
  built.use('/api/branches', require('../../src/routes/branches'));
  built.use('/api/analytics', require('../../src/routes/analytics'));
  built.use('/api/staff', require('../../src/routes/staff'));
  built.use('/api/targets', require('../../src/routes/targets'));
  built.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));

  app = built;
  return app;
}

let server;
let baseUrl;

async function start() {
  if (baseUrl) return baseUrl;
  server = buildApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stop() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = undefined;
  baseUrl = undefined;
}

/** Call the API as a given actor. `actor` null means no Authorization header. */
async function callAs(actor, path, { method = 'GET', body } = {}) {
  const url = await start();
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(actor ? { Authorization: `Bearer ${actor}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* empty body is fine */ }
  return { status: response.status, body: payload };
}

module.exports = { callAs, start, stop, WORLD, ACTORS };
