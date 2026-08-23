/**
 * accountHarness — account deletion and the DKS staff-approval gate.
 *
 * Kept apart from the lifecycle harness because these two features need the
 * environment set up differently: deletion branches on whether the Supabase
 * service key exists, and on whether the Supabase admin call succeeds. Those
 * are module-load-time and network conditions rather than rows in a table, so
 * the app is rebuilt per scenario instead of shared across tests.
 *
 * As with the lifecycle harness, the handlers are the real ones. Supabase and
 * MySQL are the only fakes.
 */
const express = require('express');
const Module = require('module');

const squash = (sql) => sql.replace(/\s+/g, ' ').trim();

function freshDb() {
  return {
    users: [{ id: 'user-1', supabase_uid: 'user-1', email: 'customer@test.jm', full_name: 'A Customer' }],
    tickets: [],
    staff_invites: [{
      id: 'invite-1', business_id: 'biz-a', branch_id: 'branch-a1',
      email: 'new@biz-a.test', full_name: 'New Staff', role: 'line_staff',
      invite_code: 'CODE12345678', status: 'requested',
      approved_at: null, approved_by: null, decline_reason: null,
    }],
    revocations: [],
    audit: [],
  };
}

const ACTORS = {
  'user-1': { kind: 'user', row: { id: 'user-1', supabase_uid: 'user-1' } },
  'mgr-a': { kind: 'staff', row: { id: 'mgr-a', business_id: 'biz-a', branch_id: 'branch-a1', role_name: 'manager', email: 'mgr@biz-a.test', is_active: 1 } },
  'platform': { kind: 'staff', row: { id: 'platform', business_id: null, branch_id: null, role_name: 'platform_admin', email: 'ops@uselyne.com', is_active: 1 } },
};

const db = freshDb();

function reset() {
  const fresh = freshDb();
  for (const table of Object.keys(fresh)) db[table] = fresh[table];
  return db;
}

function fakeQuery(sql, params = []) {
  const q = squash(sql);

  if (q.includes('FROM staff s JOIN roles r')) {
    const actor = ACTORS[params[0]];
    return [actor && actor.kind === 'staff' ? [actor.row] : []];
  }
  if (q.startsWith('SELECT * FROM users WHERE supabase_uid')) {
    const actor = ACTORS[params[0]];
    if (!actor || actor.kind !== 'user') return [[]];
    // A deleted user must stop resolving, or the next request still finds them.
    const row = db.users.find((user) => user.supabase_uid === params[0]);
    return [row ? [row] : []];
  }
  if (q.includes('FROM token_revocations')) return [[]];
  if (q.includes('user_sessions')) return [[{ active: 1 }]];

  if (q.includes('COUNT(*) AS active') && q.includes('queue_tickets')) {
    const active = db.tickets.filter((row) => row.user_id === params[0]
      && ['waiting', 'called', 'in_service'].includes(row.status)).length;
    return [[{ active }]];
  }
  if (q.startsWith('DELETE FROM users WHERE id')) {
    const before = db.users.length;
    db.users = db.users.filter((row) => row.id !== params[0]);
    return [{ affectedRows: before - db.users.length }];
  }
  if (q.startsWith('INSERT INTO token_revocations')) {
    db.revocations.push({ supabase_uid: params[1], reason: params[3] });
    return [{ affectedRows: 1 }];
  }
  if (q.includes('INSERT INTO audit_logs') || q.includes('INSERT INTO audit_log')) {
    db.audit.push({ action: params[1] });
    return [{ affectedRows: 1 }];
  }

  // ── staff invites ───────────────────────────────────────────
  if (q.startsWith('SELECT id, invite_code, email, full_name, role FROM staff_invites')) {
    const invite = db.staff_invites.find((row) => row.id === params[0] && row.status === 'requested');
    return [invite ? [{ ...invite }] : []];
  }
  if (q.startsWith("UPDATE staff_invites SET status = 'pending'")) {
    const invite = db.staff_invites.find((row) => row.id === params[1]);
    if (!invite) return [{ affectedRows: 0 }];
    invite.status = 'pending';
    invite.approved_by = params[0];
    invite.approved_at = new Date();
    return [{ affectedRows: 1 }];
  }
  if (q.startsWith("UPDATE staff_invites SET status = 'declined'")) {
    const invite = db.staff_invites.find((row) => row.id === params[1] && row.status === 'requested');
    if (!invite) return [{ affectedRows: 0 }];
    invite.status = 'declined';
    invite.decline_reason = params[0];
    return [{ affectedRows: 1 }];
  }
  if (q.includes('FROM staff_invites')) {
    return [db.staff_invites.map((row) => ({ ...row }))];
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

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
}

function forget(request, parent) {
  delete require.cache[Module._resolveFilename(request, parent)];
}

let server;
let baseUrl;

/**
 * Build the app for one scenario.
 *
 * `serviceKey` decides whether the route believes Supabase admin is
 * configured; `deleteUser` lets a test make the identity deletion fail. Both
 * are read when the module loads, so the auth route is re-required each time.
 */
async function startWith({ serviceKey = 'service-key', deleteUser } = {}) {
  await stopServer();

  process.env.SUPABASE_URL = 'https://account-harness.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'harness-key';
  if (serviceKey) process.env.SUPABASE_SERVICE_KEY = serviceKey;
  else delete process.env.SUPABASE_SERVICE_KEY;

  const adminDeleteUser = deleteUser || (async () => ({ error: null }));
  stubModule('@supabase/supabase-js', {
    createClient: () => ({
      auth: {
        getUser: async (token) => (ACTORS[token]
          ? { data: { user: { id: token } }, error: null }
          : { data: { user: null }, error: new Error('bad token') }),
        admin: { deleteUser: adminDeleteUser },
      },
    }),
  }, module);
  stubModule('../../src/db/pool', fakePool, module);

  // The auth route reads SUPABASE_SERVICE_KEY at module scope.
  forget('../../src/routes/auth', module);
  forget('../../src/routes/staff-invite', module);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../../src/routes/auth'));
  app.use('/api/staff-invite', require('../../src/routes/staff-invite'));
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = undefined;
  baseUrl = undefined;
}

async function callAs(actor, path, { method = 'GET', body } = {}) {
  if (!baseUrl) await startWith();
  const response = await fetch(`${baseUrl}${path}`, {
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

module.exports = { callAs, reset, startWith, stop: stopServer, db };
