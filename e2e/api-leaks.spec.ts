import { test, expect, request as pwRequest } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * The verification code must never travel to staff.
 *
 * It is the only thing that proves the person at the counter is the person the
 * ticket belongs to: the customer reads it out, the clerk types it, the server
 * checks it. Hand it to the clerk and the check becomes a formality they can
 * complete alone — a visit can be started, and recorded as served, with nobody
 * standing there.
 *
 * The list and single-ticket endpoints already withheld it. PUT /status did
 * not: calling somebody returned their code in the response, and broadcast it
 * over SSE to every subscriber on that queue.
 */

const API = process.env.API_URL || 'http://localhost:4000';

function env() {
  const raw = readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
  return Object.fromEntries(
    raw.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
  ) as Record<string, string>;
}

async function tokenFor(email: string) {
  const e = env();
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${e.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: e.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'test1234' },
  });
  const body = await res.json();
  await ctx.dispose();
  return body.access_token as string;
}

test('calling a customer does not hand the clerk their verification code', async () => {
  const token = await tokenFor('staff@test.com');
  const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });

  const queues = await (await ctx.get(`${API}/api/queues/mine`)).json();
  test.skip(!Array.isArray(queues) || !queues.length, 'this clerk has no queue today');

  const tickets = await (await ctx.get(`${API}/api/tickets/queue/${queues[0].id}`)).json();
  const waiting = (Array.isArray(tickets) ? tickets : []).find((t: any) => t.status === 'waiting');
  test.skip(!waiting, 'nobody is waiting to be called');

  // The list must not carry it either.
  expect(Object.keys(waiting), 'the ticket list leaks the code').not.toContain('verification_code');

  const called = await ctx.put(`${API}/api/tickets/${waiting.id}/status`, { data: { new_status: 'called' } });
  expect(called.status()).toBe(200);
  const body = await called.json();
  expect(Object.keys(body), 'calling a customer returned their verification code').not.toContain('verification_code');

  // And the check it protects still bites.
  const wrong = await ctx.put(`${API}/api/tickets/${waiting.id}/status`, {
    data: { new_status: 'in_service', verification_code: '00000000' },
  });
  expect(wrong.status(), 'a wrong code was accepted').toBe(403);

  await ctx.dispose();
});

test('a customer can still read their own code, or the barcode is blank', async () => {
  const token = await tokenFor('user@test.com');
  const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });

  const live = await (await ctx.get(`${API}/api/queues/live?branch_id=br-cfcu-hwt&service_id=svc-cfcu-member`)).json();
  test.skip(!live?.id, 'that queue is not open right now');

  // Clear anything left over, join, check, leave.
  const existing = await (await ctx.get(`${API}/api/tickets/active`)).json();
  if (existing?.id) await ctx.put(`${API}/api/tickets/${existing.id}/leave`);

  const joined = await ctx.post(`${API}/api/tickets`, { data: { queue_id: live.id, readiness_acknowledged: true } });
  expect(joined.status()).toBe(201);
  const ticket = await joined.json();

  const active = await (await ctx.get(`${API}/api/tickets/active`)).json();
  expect(active?.verification_code, 'the customer cannot see their own code — the barcode would be blank').toBeTruthy();

  await ctx.put(`${API}/api/tickets/${ticket.id}/leave`);
  await ctx.dispose();
});
