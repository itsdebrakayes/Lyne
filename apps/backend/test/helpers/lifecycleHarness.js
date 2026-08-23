/**
 * lifecycleHarness — the real ticket routes over a small mutable store.
 *
 * The isolation harness answers every query from fixed fixtures, which is all
 * an authorization test needs: it only has to know whether the request reached
 * the handler. Checking that a *feature works* needs more than that — a ticket
 * has to actually change state, so the next call sees what the last one did.
 *
 * So this store is mutable. UPDATE really updates, INSERT really appends, and
 * SELECT reads back what was written. Everything under test — the transition
 * rules, the verification code, position handling, what lands in queue_events
 * and notifications — is the production code path. What is faked is MySQL
 * itself: this is not a SQL engine, it recognises the statement shapes these
 * handlers use. So it proves the handlers' logic; it does not prove the SQL
 * runs on a real server, which needs a database these tests do not have.
 */
const express = require('express');
const Module = require('module');

const squash = (sql) => sql.replace(/\s+/g, ' ').trim();

/** A fresh world for every test, so one test's writes cannot reach another. */
function freshDb() {
  return {
    businesses: [{ id: 'biz-a', name: 'Passport Office' }],
    branches: [{ id: 'branch-a1', business_id: 'biz-a', name: 'Kingston' }],
    services: [{ id: 'svc-a', name: 'Passport Renewal', base_avg_time_minutes: 12, ticket_prefix: 'A' }],
    queues: [{
      id: 'queue-a1', branch_id: 'branch-a1', service_id: 'svc-a',
      business_id: 'biz-a', is_active: 1, status: 'open', max_capacity: 3,
    }],
    tickets: [
      {
        id: 'ticket-1', queue_id: 'queue-a1', user_id: 'user-1', ticket_number: 'A-001',
        status: 'waiting', position: 1, verification_code: 'ABC12345',
        joined_at: new Date(Date.now() - 20 * 60000), called_at: null,
        started_serving_at: null, completed_at: null, estimated_wait_minutes: 0,
        call_expires_at: null, call_timeout_seconds: null,
        served_by_staff_id: null, served_at_counter_id: null,
      },
      {
        id: 'ticket-2', queue_id: 'queue-a1', user_id: 'user-2', ticket_number: 'A-002',
        status: 'waiting', position: 2, verification_code: 'DEF67890',
        joined_at: new Date(Date.now() - 10 * 60000), called_at: null,
        started_serving_at: null, completed_at: null, estimated_wait_minutes: 12,
        call_expires_at: null, call_timeout_seconds: null,
        served_by_staff_id: null, served_at_counter_id: null,
      },
    ],
    queue_events: [],
    notifications: [],
    wait_time_records: [],
    visit_history: [],
  };
}

const ACTORS = {
  'staff-a': { kind: 'staff', row: { id: 'staff-a', business_id: 'biz-a', branch_id: 'branch-a1', role_name: 'line_staff', assigned_service_id: 'svc-a', is_active: 1 } },
  'mgr-a': { kind: 'staff', row: { id: 'mgr-a', business_id: 'biz-a', branch_id: 'branch-a1', role_name: 'manager', is_active: 1 } },
  'user-1': { kind: 'user', row: { id: 'user-1', supabase_uid: 'user-1' } },
  'user-2': { kind: 'user', row: { id: 'user-2', supabase_uid: 'user-2' } },
  // Holds no ticket: needed to reach guards that a customer with a live ticket
  // never gets past.
  'user-3': { kind: 'user', row: { id: 'user-3', supabase_uid: 'user-3' } },
};

// One stable object for the whole run: tests hold a reference to it, so reset
// must refill it in place. Rebinding `db` to a new object would leave every
// test reading the world as it looked at import time.
const db = freshDb();

/** Reset the world. Call between tests. */
function reset() {
  const fresh = freshDb();
  for (const table of Object.keys(fresh)) db[table] = fresh[table];
  return db;
}

function ticketById(id) {
  return db.tickets.find((row) => row.id === id);
}

/**
 * Parse `UPDATE queue_tickets SET status = ?, called_at = ?, ... WHERE id = ?`
 * as the handler builds it, and apply it. The column list is assembled at
 * runtime from `extraFields`, so read it out of the statement rather than
 * assuming a fixed shape.
 */
function applyTicketUpdate(sql, params) {
  const setClause = sql.slice(sql.indexOf(' SET ') + 5, sql.lastIndexOf(' WHERE '));
  const assignments = setClause.split(',').map((part) => part.trim()).filter(Boolean);
  const id = params[params.length - 1];
  const ticket = ticketById(id);
  if (!ticket) return { affectedRows: 0 };

  let cursor = 0;
  for (const assignment of assignments) {
    const column = assignment.split('=')[0].trim();
    const value = assignment.slice(assignment.indexOf('=') + 1).trim();
    // COALESCE(?, col) keeps the existing value when the parameter is null.
    if (value.startsWith('COALESCE')) {
      const incoming = params[cursor];
      cursor += 1;
      if (incoming !== null && incoming !== undefined) ticket[column] = incoming;
      continue;
    }
    const placeholders = (value.match(/\?/g) || []).length;
    if (placeholders === 0) continue;
    ticket[column] = params[cursor];
    cursor += placeholders;
  }
  return { affectedRows: 1 };
}

/**
 * Read an INSERT's values by column name. These statements mix placeholders
 * with inline literals — `VALUES (?, ?, NULL, 'waiting')` — so a row cannot be
 * reconstructed from the parameter array alone; the literals have to come out
 * of the statement text.
 */
function insertedRow(sql, params, wanted) {
  const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map((part) => part.trim());
  const valuesStart = sql.toUpperCase().indexOf('VALUES');
  const values = sql.slice(sql.indexOf('(', valuesStart) + 1, sql.lastIndexOf(')'))
    .split(',').map((part) => part.trim());

  const row = {};
  let cursor = 0;
  columns.forEach((column, index) => {
    const value = values[index];
    let resolved;
    if (value === '?') {
      resolved = params[cursor];
      cursor += 1;
    } else if (/^NULL$/i.test(value)) {
      resolved = null;
    } else if (/^'.*'$/.test(value)) {
      resolved = value.slice(1, -1);
    } else {
      resolved = undefined;
    }
    if (!wanted || wanted.includes(column)) row[column] = resolved;
  });
  return row;
}

function fakeQuery(sql, params = []) {
  const q = squash(sql);

  // Writes first: an INSERT ... SELECT carries a FROM/JOIN tail that the read
  // matchers below would otherwise claim, and the row would never be stored.
  // ── writes ──────────────────────────────────────────────────
  if (q.startsWith('UPDATE queue_tickets SET status')) return [applyTicketUpdate(q, params)];
  if (q.startsWith('UPDATE queue_tickets t JOIN')) {
    // Wait-time recalculation across the remaining waiting tickets.
    const step = params[0];
    const waiting = db.tickets
      .filter((row) => row.queue_id === params[1] && row.status === 'waiting')
      .sort((a, b) => a.position - b.position);
    waiting.forEach((row, index) => { row.estimated_wait_minutes = index * step; });
    return [{ affectedRows: waiting.length }];
  }
  if (q.startsWith('INSERT INTO queue_tickets')) {
    db.tickets.push({
      id: params[0], queue_id: params[1], user_id: params[2], intake_form_id: params[3],
      ticket_number: params[4], verification_code: params[5], position: params[6],
      status: 'waiting', estimated_wait_minutes: params[7],
      joined_at: new Date(), called_at: null, started_serving_at: null, completed_at: null,
      call_expires_at: null, call_timeout_seconds: null,
      served_by_staff_id: null, served_at_counter_id: null,
    });
    return [{ affectedRows: 1 }];
  }
  if (q.startsWith('INSERT INTO intake_forms')) return [{ affectedRows: 1 }];
  if (q.startsWith('INSERT INTO queue_events')) {
    db.queue_events.push(insertedRow(q, params, ['ticket_id', 'previous_status', 'new_status', 'notes']));
    return [{ affectedRows: 1 }];
  }
  if (q.startsWith('INSERT INTO notifications')) {
    db.notifications.push({ user_id: params[1], ticket_id: params[2], notification_type: params[3], message: params[4] });
    return [{ affectedRows: 1 }];
  }
  if (q.startsWith('INSERT INTO wait_time_records')) {
    db.wait_time_records.push({ ticket_id: params[1], wait_time_minutes: params[2], service_time_minutes: params[3], status: params[4] });
    return [{ affectedRows: 1 }];
  }
  if (q.startsWith('INSERT INTO visit_history')) {
    db.visit_history.push({ user_id: params[1], ticket_id: params[2], status: params[params.length - 1] });
    return [{ affectedRows: 1 }];
  }


  // ── auth + tenant middleware ────────────────────────────────
  if (q.includes('FROM staff s JOIN roles r')) {
    const actor = ACTORS[params[0]];
    return [actor && actor.kind === 'staff' ? [actor.row] : []];
  }
  if (q.startsWith('SELECT * FROM users WHERE supabase_uid')) {
    const actor = ACTORS[params[0]];
    return [actor && actor.kind === 'user' ? [actor.row] : []];
  }
  if (q.includes('FROM token_revocations')) return [[]];
  if (q.includes('user_sessions')) return [[{ active: 1 }]];
  // The join handler's duplicate-ticket check shares the JOIN shape used by
  // requireTicketAccess, so it has to be matched on its own WHERE clause first.
  if (q.includes('FROM queue_tickets t JOIN queues q') && q.includes('WHERE t.user_id = ?')) {
    const live = db.tickets.find((row) => row.user_id === params[0]
      && ['waiting', 'called', 'in_service'].includes(row.status));
    if (!live) return [[]];
    const queue = db.queues.find((row) => row.id === live.queue_id);
    const service = db.services.find((row) => row.id === queue?.service_id);
    return [[{ ticket_number: live.ticket_number, service_name: service?.name || null }]];
  }
  if (q.startsWith('SELECT * FROM queues WHERE id')) {
    const queue = db.queues.find((row) => row.id === params[0] && row.is_active);
    return [queue ? [{ ...queue }] : []];
  }
  if (q.includes('COALESCE(MAX(position), 0) + 1')) {
    const positions = db.tickets.filter((row) => row.queue_id === params[0]).map((row) => row.position);
    return [[{ next_pos: (positions.length ? Math.max(...positions) : 0) + 1 }]];
  }
  if (q.startsWith('SELECT ticket_prefix, base_avg_time_minutes FROM services')) {
    const service = db.services.find((row) => row.id === params[0]);
    return [service ? [{ ticket_prefix: service.ticket_prefix || 'Q', base_avg_time_minutes: service.base_avg_time_minutes }] : []];
  }

  // ── the row the status handler locks ────────────────────────
  if (q.startsWith('SELECT t.*, q.branch_id')) {
    const ticket = ticketById(params[0]);
    if (!ticket) return [[]];
    const queue = db.queues.find((row) => row.id === ticket.queue_id);
    const branch = db.branches.find((row) => row.id === queue.branch_id);
    const service = db.services.find((row) => row.id === queue.service_id);
    return [[{
      ...ticket,
      branch_id: branch.id,
      service_id: service.id,
      business_id: branch.business_id,
      branch_name: branch.name,
      service_name: service.name,
    }]];
  }

  // requireTicketAccess: ownership + tenant columns only.
  if (q.includes('FROM queue_tickets t JOIN queues q')) {
    const ticket = ticketById(params[0]);
    if (!ticket) return [[]];
    const queue = db.queues.find((row) => row.id === ticket.queue_id);
    return [[{
      user_id: ticket.user_id,
      business_id: queue.business_id,
      branch_id: queue.branch_id,
      service_id: queue.service_id,
    }]];
  }
  if (q.includes('FROM queues q JOIN branches b') && q.includes('SELECT')) {
    const queue = db.queues.find((row) => row.id === params[0]);
    return [queue ? [{ business_id: queue.business_id, branch_id: queue.branch_id, service_id: queue.service_id }] : []];
  }

  if (q.startsWith('SELECT * FROM queue_tickets WHERE id')) {
    const ticket = ticketById(params[0]);
    return [ticket ? [{ ...ticket }] : []];
  }

  // No counter assignments in this world, so served_at_counter_id stays null.
  if (q.includes('FROM staff_assignments sa JOIN counters c')) return [[]];
  if (q.includes('FROM staff_assignments WHERE counter_id')) return [[{ cnt: 0 }]];
  if (q.includes('FROM counters c JOIN staff_assignments')) return [[{ cnt: 0 }]];

  if (q.includes("FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'") && q.includes('COUNT')) {
    return [[{ cnt: db.tickets.filter((row) => row.queue_id === params[0] && row.status === 'waiting').length }]];
  }
  if (q.includes('AVG(service_time_minutes)')) return [[{ avg_svc: null }]];
  if (q.includes('base_avg_time_minutes')) {
    const queue = db.queues.find((row) => row.id === params[0]);
    const service = db.services.find((row) => row.id === queue?.service_id);
    return [[{ base_avg_time_minutes: service?.base_avg_time_minutes ?? 15 }]];
  }
  if (q.includes('JOIN businesses biz') || q.includes('JOIN businesses b ')) {
    const queue = db.queues.find((row) => row.id === params[params.length - 1]);
    if (!queue) return [[]];
    const branch = db.branches.find((row) => row.id === queue.branch_id);
    const service = db.services.find((row) => row.id === queue.service_id);
    const business = db.businesses.find((row) => row.id === branch.business_id);
    return [[{
      branch_name: branch.name, business_name: business.name, business_id: business.id,
      service_name: service.name, branch_id: branch.id, service_id: service.id,
    }]];
  }

  return [[]];
}

function stubModule(request, exports, parent) {
  const resolved = Module._resolveFilename(request, parent);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports, children: [], paths: [] };
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

let app;
let server;
let baseUrl;

function buildApp() {
  if (app) return app;
  process.env.SUPABASE_URL = 'https://lifecycle-harness.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'harness-key';

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
  // Push delivery is a network call to Expo; never make one from a test.
  stubModule('../../src/utils/pushSender', { sendPushToUser: async () => ({ sent: 0 }) }, module);

  const built = express();
  built.use(express.json());
  built.use('/api/tickets', require('../../src/routes/tickets'));
  built.use('/api/queues', require('../../src/routes/queues'));
  built.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  app = built;
  return app;
}

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

/** Drive a ticket to a given status through the real handlers. */
async function setStatus(ticketId, newStatus, extra = {}) {
  return callAs('staff-a', `/api/tickets/${ticketId}/status`, {
    method: 'PUT',
    body: { new_status: newStatus, ...extra },
  });
}

module.exports = { callAs, setStatus, reset, stop, ticketById, db };
