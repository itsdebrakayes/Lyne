const test = require('node:test');
const assert = require('node:assert/strict');

const ticketRouter = require('../src/routes/tickets');
const queueRouter = require('../src/routes/queues');
const sseRouter = require('../src/routes/sse');
const predictionsRouter = require('../src/routes/predictions');
const notificationsRouter = require('../src/routes/notifications');
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
