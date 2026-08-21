const test = require('node:test');
const assert = require('node:assert/strict');

const ticketRouter = require('../src/routes/tickets');
const queueRouter = require('../src/routes/queues');
const sseRouter = require('../src/routes/sse');
const predictionsRouter = require('../src/routes/predictions');
const notificationsRouter = require('../src/routes/notifications');
const analyticsRouter = require('../src/routes/analytics');
const staffRouter = require('../src/routes/staff');
const assignmentsRouter = require('../src/routes/assignments');
const staffInviteRouter = require('../src/routes/staff-invite');
const ocrRouter = require('../src/routes/ocr');
const targetsRouter = require('../src/routes/targets');
const servicesRouter = require('../src/routes/services');
const { lookupActorBySupabaseUid } = require('../src/middleware/auth');

function routeHandlers(router, method, path) {
  const layer = router.stack.find(candidate => (
    candidate.route?.path === path && candidate.route.methods?.[method]
  ));
  assert.ok(layer, `${method.toUpperCase()} ${path} route must exist`);
  return layer.route.stack.map(handler => handler.name);
}

test('customer queue join requires authentication without staff tenant middleware', () => {
  const handlers = routeHandlers(ticketRouter, 'post', '/');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(!handlers.includes('requireQueueAccess'));
});

test('kiosk walk-in is authenticated and role-gated, not a public or open create', () => {
  const handlers = routeHandlers(ticketRouter, 'post', '/walk-in');
  assert.ok(handlers.includes('requireAuth'), 'walk-in must authenticate');
  // requireStaffRole(...) returns an anonymous middleware, so it can't be named,
  // but its presence shows as an extra handler between auth and the route body.
  assert.ok(handlers.length >= 3, 'walk-in must carry auth + a role gate + handler');
  // It creates a NEW ticket, so it must NOT be gated on an existing ticket/queue.
  assert.ok(!handlers.includes('requireTicketAccess'));
  assert.ok(!handlers.includes('requireQueueAccess'));
});

test('the guest ticket lookup is public, and the TOKEN is the only key to it', () => {
  const handlers = routeHandlers(ticketRouter, 'get', '/guest/:token');
  // Deliberately unauthenticated: a person who joined from a browser has no
  // account by design. Possession of the 43-char token is the authorisation.
  assert.ok(!handlers.includes('requireAuth'), 'a guest has no account to authenticate with');
  assert.ok(!handlers.includes('requireTicketAccess'), 'there is no actor to scope against');
  assert.equal(handlers.length, 1, 'nothing but the handler — any added gate would lock guests out');
});

test('the guest ticket lookup is declared before /:id, or it can never be reached', () => {
  // '/guest/abc' would otherwise be swallowed by an earlier one-segment route,
  // and Express resolves in declaration order, so this ordering IS the contract.
  const paths = ticketRouter.stack.filter((l) => l.route?.methods?.get).map((l) => l.route.path);
  assert.ok(
    paths.indexOf('/guest/:token') < paths.indexOf('/:id'),
    'GET /guest/:token must be declared before GET /:id'
  );
});

test('branch targets read is authenticated and branch-scoped', () => {
  const handlers = routeHandlers(targetsRouter, 'get', '/branch');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireBranchAccess'), 'branch targets must verify branch access');
});

test('branch targets write is authenticated, branch-scoped and audited', () => {
  const handlers = routeHandlers(targetsRouter, 'put', '/branch');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireBranchAccess'));
  // requireStaffRole('manager','executive') + auditLog(...) are anonymous, so a
  // handler count confirms the full chain (auth + role + branch + audit + body).
  assert.ok(handlers.length >= 5, 'branch targets write must carry the full guard chain');
});

test('company targets write stays authenticated behind the full guard chain', () => {
  // requireStaffRole('executive') + requireBusinessAccess('body') + auditLog(...)
  // are all anonymous middleware, so assert auth + a full chain by count.
  const handlers = routeHandlers(targetsRouter, 'put', '/');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.length >= 4, 'company targets write must carry role + business + audit guards');
});

test('ticket detail and position routes require ownership checks', () => {
  for (const path of ['/:id', '/:id/position']) {
    const handlers = routeHandlers(ticketRouter, 'get', path);
    assert.ok(handlers.includes('requireAuth'), `${path} must authenticate`);
    assert.ok(handlers.includes('requireTicketAccess'), `${path} must verify ticket access`);
  }
});

test('active ticket recovery is authenticated user-only', () => {
  const handlers = routeHandlers(ticketRouter, 'get', '/active');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(!handlers.includes('requireTicketAccess'));
});

test('full queue details are restricted to authorized staff', () => {
  const handlers = routeHandlers(queueRouter, 'get', '/:id');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireQueueAccess'));
});

test('staff queue streams verify tenant access', () => {
  const handlers = routeHandlers(sseRouter, 'get', '/queue/:queue_id/staff');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireQueueAccess'));
});

test('public queue updates exclude ownership and verification fields', () => {
  const publicUpdate = sseRouter.toPublicTicketUpdate({
    id: 'ticket-1',
    queue_id: 'queue-1',
    user_id: 'user-1',
    ticket_number: 'A-001',
    verification_code: 'SECRET12',
    position: 1,
    status: 'called',
    estimated_wait_minutes: 0,
  });

  assert.deepEqual(publicUpdate, {
    id: 'ticket-1',
    ticket_number: 'A-001',
    position: 1,
    status: 'called',
    estimated_wait_minutes: 0,
  });
});

test('staff can skip a ticket only through authenticated tenant checks', () => {
  const handlers = routeHandlers(ticketRouter, 'put', '/:id/skip');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireTicketAccess'));
});

test('staff ticket history is restricted to authenticated staff roles', () => {
  const handlers = routeHandlers(ticketRouter, 'get', '/history');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.length >= 3);
});

test('ticket status updates remain authenticated and tenant scoped', () => {
  const handlers = routeHandlers(ticketRouter, 'put', '/:id/status');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireTicketAccess'));
});

test('readiness authoring is authenticated and staff-role gated', () => {
  const handlers = routeHandlers(servicesRouter, 'put', '/:id/readiness');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.length >= 3, 'readiness writes must include a staff role gate');
});

test('readiness outcomes are manager-only analytics with tenant guards', () => {
  const handlers = routeHandlers(analyticsRouter, 'get', '/readiness');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireBranchAccess'));
  assert.ok(handlers.length >= 5, 'readiness analytics must enforce role, business, and branch access');
});

test('private predictions require staff authentication and public predictions are isolated', () => {
  const privateHandlers = routeHandlers(predictionsRouter, 'get', '/');
  assert.ok(privateHandlers.includes('requireAuth'));
  assert.ok(privateHandlers.includes('requireBranchAccess'));

  const publicHandlers = routeHandlers(predictionsRouter, 'get', '/public');
  assert.ok(!publicHandlers.includes('requireAuth'));
});

test('staff notifications require access to the recipient ticket', () => {
  const handlers = routeHandlers(notificationsRouter, 'post', '/');
  assert.ok(handlers.includes('requireAuth'));
  assert.ok(handlers.includes('requireTicketAccess'));
});

test('staff presence endpoints require authenticated staff access', () => {
  for (const path of ['/presence', '/on-shift-managers']) {
    const handlers = routeHandlers(staffRouter, 'get', path);
    assert.ok(handlers.includes('requireAuth'), `${path} must authenticate`);
    assert.ok(handlers.length >= 3, `${path} must enforce staff roles`);
  }
});

test('assignment and invite administration routes require authenticated staff access', () => {
  const assignmentHandlers = routeHandlers(assignmentsRouter, 'get', '/');
  assert.ok(assignmentHandlers.includes('requireAuth'));
  assert.ok(assignmentHandlers.includes('requireBranchAccess'));

  for (const [method, path] of [['post', '/create'], ['get', '/pending'], ['delete', '/:id']]) {
    const handlers = routeHandlers(staffInviteRouter, method, path);
    assert.ok(handlers.includes('requireAuth'), `${method.toUpperCase()} ${path} must authenticate`);
  }
});

test('ocr signed url route requires authenticated access checks', () => {
  const handlers = routeHandlers(ocrRouter, 'get', '/signed-url/:id');
  assert.ok(handlers.includes('requireAuth'));
});

test('new analytics dashboards require authenticated staff access', () => {
  const lineHandlers = routeHandlers(analyticsRouter, 'get', '/line-staff');
  assert.ok(lineHandlers.includes('requireAuth'));
  assert.ok(lineHandlers.length >= 3);

  const managerHandlers = routeHandlers(analyticsRouter, 'get', '/managers');
  assert.ok(managerHandlers.includes('requireAuth'));
  assert.ok(managerHandlers.length >= 4);

  const executiveKpiHandlers = routeHandlers(analyticsRouter, 'get', '/executive-kpis');
  assert.ok(executiveKpiHandlers.includes('requireAuth'));
  assert.ok(executiveKpiHandlers.length >= 4);
});

test('auth lookup prefers provisioned staff role over synced mobile user row', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM staff')) {
        return [[{
          id: 'staff-1',
          supabase_uid: 'supabase-1',
          role_name: 'manager',
        }]];
      }
      return [[{
        id: 'user-1',
        supabase_uid: 'supabase-1',
      }]];
    },
  };

  const actor = await lookupActorBySupabaseUid('supabase-1', db);

  assert.equal(actor.dbStaff.role_name, 'manager');
  assert.equal(actor.dbUser, undefined);
  assert.equal(calls.length, 1, 'user table should not be queried once staff is found');
});

test('auth lookup treats unprovisioned Supabase accounts as mobile users only after sync', async () => {
  const db = {
    async query(sql) {
      if (sql.includes('FROM staff')) return [[]];
      if (sql.includes('FROM users')) return [[{ id: 'user-1', supabase_uid: 'supabase-1' }]];
      return [[]];
    },
  };

  const actor = await lookupActorBySupabaseUid('supabase-1', db);

  assert.equal(actor.dbStaff, undefined);
  assert.equal(actor.dbUser.id, 'user-1');
});
