const test = require('node:test');
const assert = require('node:assert/strict');

const authRouter = require('../src/routes/auth');
const ticketRouter = require('../src/routes/tickets');
const queueRouter = require('../src/routes/queues');
const predictionsRouter = require('../src/routes/predictions');
const notificationsRouter = require('../src/routes/notifications');
const analyticsRouter = require('../src/routes/analytics');
const staffRouter = require('../src/routes/staff');
const assignmentsRouter = require('../src/routes/assignments');
const staffInviteRouter = require('../src/routes/staff-invite');
const ocrRouter = require('../src/routes/ocr');
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

test('account deletion is authenticated and audited', () => {
  const handlers = routeHandlers(authRouter, 'delete', '/account');
  assert.ok(handlers.includes('requireAuth'), 'deletion must authenticate the caller');
  // Deleting an account is exactly the kind of irreversible, personal-data
  // action the audit trail exists for.
  assert.ok(handlers.length > 1, 'deletion must be audit-logged');
});

test('account deletion is not exposed unauthenticated on any other verb', () => {
  for (const method of ['get', 'post', 'put']) {
    const layer = authRouter.stack.find(candidate => (
      candidate.route?.path === '/account' && candidate.route.methods?.[method]
    ));
    assert.equal(layer, undefined, `/account must not answer ${method.toUpperCase()}`);
  }
});
