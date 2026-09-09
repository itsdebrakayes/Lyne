import { test, expect, request as pwRequest } from '@playwright/test';
import { signIn, dismissTour } from './helpers';

/**
 * The chains, end to end — the ones where an action by one person has to reach
 * another person's screen.
 *
 * Every other suite here tests a single actor: does this button acknowledge the
 * press, does that panel explain its own failure. Those catch a broken control.
 * They cannot catch the thing Debra actually asked about, which is whether a
 * process COMPLETES: real data goes into a model, the model's answer reaches a
 * manager, the manager acts on it, and the person on the other end is told.
 *
 * A chain is only counted as working here if every link is observed:
 *   the data exists → the model produced something from it → it reached a
 *   screen → the action was accepted → the recipient can see it.
 *
 * Anything asserted from a fixture rather than from live state is not a test of
 * the chain, it is a test of the fixture.
 */

const API = process.env.API_URL || 'http://localhost:4000';
const SUPABASE = process.env.SUPABASE_URL || '';
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || '';

/** A bearer token straight from Supabase, for asserting on the other actor's
 *  view without driving a second browser through a login. */
async function tokenFor(email: string) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    data: { email, password: 'test1234' },
  });
  const body = await res.json();
  await ctx.dispose();
  return body.access_token as string;
}

test.describe('cross-actor chains', () => {
  test('a recommendation is computed from live data, reaches the manager, and can be sent on', async ({ page }) => {
    test.setTimeout(120_000);

    const manager = await tokenFor('manager@test.com');
    expect(manager, 'manager could not sign in').toBeTruthy();

    /* LINK 1 — the data the model reads actually exists. Asserting on the
       recommendation without this proves nothing: a model can emit a confident
       plan from an empty table. */
    const ctx = await pwRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${manager}` },
    });
    /* The BUSIEST line at the branch, not a named one.
       This first asked about TRN Registration specifically and failed because a
       day of manual testing had drained exactly that queue — a true statement
       about the fixture, not about the system. What the recommendation needs is
       demand somewhere for it to reason about, so the test finds it rather than
       assuming where it will be. */
    const queues = await (await ctx.get(`${API}/api/queues?branch_id=br-taj-kgn`)).json();
    const openLines = Array.isArray(queues) ? queues : [];
    const busiest = openLines
      .map((q: any) => ({ id: q.id, name: q.service_name, waiting: Number(q.waiting_count ?? 0) }))
      .sort((a, b) => b.waiting - a.waiting)[0];
    const waiting = Number(busiest?.waiting || 0);
    console.log(`  [1] busiest line: ${busiest?.name || '(none)'}`);
    console.log(`  [1] live demand at Half Way Tree: ${waiting} waiting`);
    expect(waiting, 'no live demand — the recommendation would have nothing to reason about').toBeGreaterThan(0);

    /* LINK 2 — a model, not a fixture, produced a plan from it. The version
       string is checked because that is what distinguishes a real run from a
       seeded row wearing the same shape. */
    const preds = await (await ctx.get(
      `${API}/api/predictions?business_id=biz-taj-001&type=staffing_recommendation&max_age_minutes=2880`,
    )).json();
    expect(Array.isArray(preds) && preds.length, 'no staffing recommendation exists').toBeTruthy();
    const rec = preds[0];
    console.log(`  [2] model: ${rec.model_version}, generated ${rec.generated_at}`);
    expect(rec.model_version, 'the recommendation is not from the Erlang-C model').toMatch(/erlangc/i);

    const data = typeof rec.insight_data === 'string' ? JSON.parse(rec.insight_data) : rec.insight_data;
    expect(JSON.stringify(data).length, 'the recommendation is empty').toBeGreaterThan(50);

    /* LINK 3 — it is on the manager's screen, not merely in the database. */
    await signIn(page, 'supervisor');
    await dismissTour(page);
    await expect(page.locator('body')).toContainText(/needs attention|do this next|waiting/i, { timeout: 20_000 });
    console.log('  [3] the recommendation surface is on screen');

    /* LINK 4 — the manager sends it, and the send is accepted.
       Driven through the API here so this test stays about the CHAIN; the
       button itself is asserted separately below, on the screen a manager
       actually reads the recommendation from. */
    const send = await ctx.post(`${API}/api/notifications/staff-request`, {
      data: {
        branch_id: 'br-taj-kgn',
        request_type: 'staffing',
        message: 'TRN Registration is over its 20-minute target. Open one more window.',
      },
    });
    const sendBody = await send.json();
    console.log(`  [4] send → HTTP ${send.status()} · ${JSON.stringify(sendBody)}`);
    expect(send.status(), 'the manager could not send the request').toBe(201);
    expect(sendBody.recipients, 'it reached nobody').toBeGreaterThan(0);

    /* LINK 5 — the person it was addressed to can see it. This is the link that
       makes it a chain rather than two features: read as the RECIPIENT, with
       their own token, from the endpoint their bell reads. */
    const supervisor = await tokenFor('supervisor@test.com');
    const supCtx = await pwRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${supervisor}` },
    });
    const inbox = await (await supCtx.get(`${API}/api/notifications`)).json();
    const rows = Array.isArray(inbox) ? inbox : (inbox.notifications || []);
    const landed = rows.find((n: any) => /over its 20-minute target/i.test(String(n.message || '')));
    console.log(`  [5] supervisor inbox: ${rows.length} items, ours ${landed ? 'present' : 'MISSING'}`);
    expect(landed, 'the supervisor cannot see what the manager sent').toBeTruthy();
    expect(Boolean(landed.is_read), 'it should arrive unread, or the bell has nothing to announce').toBe(false);

    /* LINK 6 — and can act on it. An inbox that cannot be cleared is a list of
       reproaches, not a workflow. */
    const ack = await supCtx.put(`${API}/api/notifications/${landed.id}/read`, { data: {} });
    console.log(`  [6] mark as read → HTTP ${ack.status()}`);
    expect([200, 204]).toContain(ack.status());

    await ctx.dispose();
    await supCtx.dispose();
  });

  test('the manager can send the recommendation from the screen it is read on', async ({ page }) => {
    test.setTimeout(120_000);

    /* The button existed on Staff & Counters and NOT on the overview, where the
       bottleneck panel names the fastest fix available this hour and then left
       the manager to remember that the request lives on another tab. This
       asserts it is now where the recommendation is read. */
    await signIn(page, 'manager');
    await dismissTour(page);

    const body = page.locator('body');
    /* Wait for the data, not just the shell. The panel only exists once the
       queue feed has told it which line is worst — reading the page before that
       finds an empty overview and reports the button as missing. */
    await expect(body).toContainText(/do this next/i, { timeout: 30_000 });

    const ask = page.getByRole('button', { name: /ask supervisor/i }).first();
    const present = await ask.count();
    console.log(`  "Ask Supervisor" buttons on screen: ${present}`);

    /* Skip rather than fail when the branch is healthy: the button is meant to
       be absent when every window is already open, and a test that demands it
       unconditionally would be asserting the branch is in trouble. */
    test.skip(present === 0, 'no bottleneck with a free window right now — nothing to ask for');

    await expect(ask).toBeEnabled();
    await ask.click();
    await expect(body).toContainText(/supervisor notified|sending|not notified/i, { timeout: 20_000 });
    console.log('  the press was acknowledged on screen');
  });

  test('a clerk going on break tells the customers waiting in that line', async () => {
    test.setTimeout(120_000);

    const clerk = await tokenFor('staff@test.com');
    const ctx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${clerk}` } });
    const customer = await tokenFor('user@test.com');
    const custCtx = await pwRequest.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${customer}` } });

    /* The precondition has to be MADE, not hoped for.
       A first version of this test asserted nothing and merely logged whether
       the inbox grew — so it passed while the notification reached nobody,
       because the account happened to hold no ticket in that line. A test that
       cannot fail is worse than no test: it reports the chain as working on the
       morning it stops working. */
    const live = await (await custCtx.get(`${API}/api/queues/live?branch_id=br-taj-kgn&service_id=svc-taj-trn`)).json();
    expect(live?.id, 'the TRN line is not open, so nobody could be waiting in it').toBeTruthy();

    const join = await custCtx.post(`${API}/api/tickets`, {
      data: { queue_id: live.id, readiness_acknowledged: true },
    });
    const ticket = await join.json();
    console.log(`  precondition: customer holds ${ticket.ticket_number || '(none)'} in the TRN line`);
    expect(join.status(), `the customer could not join: ${JSON.stringify(ticket)}`).toBeLessThan(300);

    // Clerk on shift and available, so the break is a real state change.
    await ctx.post(`${API}/api/staff/me/clock-in`);
    await ctx.post(`${API}/api/staff/me/resume`);

    const before = (await (await custCtx.get(`${API}/api/notifications`)).json()) as any[];
    const beforeCount = Array.isArray(before) ? before.length : 0;

    const brk = await ctx.post(`${API}/api/staff/me/break`);
    expect(brk.status(), 'the clerk could not start a break').toBe(200);

    /* Polled, not assumed: the route deliberately does not await the send, so a
       clerk's break can never fail because a notification could not be written. */
    let arrived: any = null;
    for (let i = 0; i < 12 && !arrived; i += 1) {
      await new Promise((r) => setTimeout(r, 500));
      const now = (await (await custCtx.get(`${API}/api/notifications`)).json()) as any[];
      if (Array.isArray(now) && now.length > beforeCount) {
        arrived = now.find((n: any) => /window serving/i.test(String(n.message || '')));
      }
    }
    console.log(`  customer was told: ${arrived ? JSON.stringify(arrived.message).slice(0, 120) : 'NOTHING ARRIVED'}`);
    expect(arrived, 'the customer waiting in that line was never told the window closed').toBeTruthy();
    expect(String(arrived.message)).toMatch(/TRN Registration/i);

    // Put everything back the way it was found.
    await ctx.post(`${API}/api/staff/me/resume`);
    if (ticket?.id) await custCtx.put(`${API}/api/tickets/${ticket.id}/leave`, { data: {} });
    await ctx.dispose();
    await custCtx.dispose();
  });
});
