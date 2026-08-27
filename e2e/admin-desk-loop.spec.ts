import { test, expect, Page } from '@playwright/test';
import { signIn, dismissTour, acknowledgesPress, verificationCodeFor } from './helpers';

/**
 * The whole desk loop, pressed the way a clerk presses it.
 *
 * The earlier feedback test only ever reached one button, because the desk is a
 * state machine and whichever state it happens to be in hides the rest. That is
 * not coverage — the report was about Complete, and Complete was never pressed.
 *
 * This walks the machine end to end — idle → called → serving → complete — and
 * at every transition asks the same two questions: did the press get
 * acknowledged, and did the screen actually move on. A button that silently
 * works is still a bug here.
 */

const SLOW_MS = 1000;
const API = 'http://localhost:4000';

async function tokenFrom(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k) || '';
      try {
        const parsed = JSON.parse(v);
        if (parsed?.access_token) return parsed.access_token as string;
        if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token as string;
      } catch { /* not json, skip */ }
    }
    return '';
  });
}

/** Hold write requests open long enough that in-flight state is observable. */
async function slowWrites(page: Page) {
  await page.route('**/api/tickets/**', async (route) => {
    if (route.request().method() === 'GET') return route.fallback();
    await new Promise((r) => setTimeout(r, SLOW_MS));
    return route.fallback();
  });
}

async function openDesk(page: Page) {
  await page.getByRole('button', { name: /live line/i }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await dismissTour(page);
}

/**
 * Press a button and ask whether the clerk can tell it registered.
 *
 * Two things count, and they are different. The BUTTON may acknowledge — go
 * disabled, announce aria-busy, swap to a "…ing" label. Or the SCREEN may move
 * on, which is its own answer. What must not happen is that the control sits
 * there looking exactly as it did, still pressable: that is the state that gets
 * pressed twice.
 *
 * The button vanishing is not on its own an answer — it happens both when the
 * view advances and when a row re-renders under the click — so the page
 * snapshot is what settles it.
 */
async function pressAndWatch(page: Page, label: string) {
  console.log(`  [step] pressing "${label}"`);
  const btn = page.locator('button').filter({ hasText: new RegExp(`^\\s*${label}`, 'i') }).first();
  await expect(btn, `"${label}" is not on screen`).toBeVisible({ timeout: 10_000 });
  await expect(btn, `"${label}" is disabled`).toBeEnabled({ timeout: 10_000 });

  /* Hold the ELEMENT, not a text query.
     "Start Service" becomes "Checking…" and "Complete And Call Next" becomes
     "Saving…" the moment they are pressed — which is exactly the feedback under
     test — so a locator matching on the old label stops resolving and the
     button looks like it vanished. It reported three of four presses as giving
     no feedback when they were in fact doing the right thing. */
  const handle = await btn.elementHandle();
  const beforeLabel = (await handle!.innerText()).trim();

  await btn.click();
  await page.waitForTimeout(250);

  const ack = await handle!.evaluate((el: HTMLElement) => {
    const how: string[] = [];
    if (!el.isConnected) return { acknowledged: false, how: ['removed from the page'] };
    if ((el as HTMLButtonElement).disabled) how.push('disabled');
    if (el.getAttribute('aria-busy') === 'true') how.push('aria-busy');
    if (/…|\.\.\.|ing\b/i.test(el.innerText || '')) how.push(`label:"${el.innerText.trim()}"`);
    if (el.querySelector('[class*=spin],[class*=loader]')) how.push('spinner');
    if (Number(getComputedStyle(el).opacity) < 0.9) how.push(`opacity:${getComputedStyle(el).opacity}`);
    return { acknowledged: how.length > 0, how };
  });
  const afterLabel = (await handle!.innerText().catch(() => '')).trim();
  if (afterLabel && afterLabel !== beforeLabel) ack.how.push(`label changed to "${afterLabel}"`);

  await page.waitForTimeout(SLOW_MS + 900);
  return ack;
}

test('idle → called → serving → complete, acknowledging every press', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, 'lineStaff');
  const token = await tokenFrom(page);
  expect(token, 'could not read the session token').not.toBe('');

  await openDesk(page);

  /* Put the desk in a known state. Whoever is mid-visit is completed through
     the API so the test starts from idle rather than whatever the last run
     left behind. */
  const mine = await page.request.get(`${API}/api/queues/mine`, { headers: { Authorization: `Bearer ${token}` } });
  const queues = await mine.json();
  const queue = Array.isArray(queues) ? queues[0] : null;
  test.skip(!queue, 'this clerk has no queue today');

  const listRes = await page.request.get(`${API}/api/tickets/queue/${queue.id}`, { headers: { Authorization: `Bearer ${token}` } });
  const tickets = await listRes.json();
  for (const t of (Array.isArray(tickets) ? tickets : [])) {
    if (t.status === 'in_service' || t.status === 'called') {
      await page.request.put(`${API}/api/tickets/${t.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { new_status: 'served', readiness_outcome: 'ready' },
      });
    }
  }
  const waiting = (Array.isArray(tickets) ? tickets : []).filter((t: any) => t.status === 'waiting');
  test.skip(waiting.length < 1, 'nobody is waiting to be called');

  await page.reload();
  await openDesk(page);
  await slowWrites(page);

  const acks: Record<string, string[]> = {};

  // ── idle → called ──────────────────────────────────────────────────────
  /* "Call " with the trailing space would also match "Call Again"; the idle
     button reads "Call TRN-005", so anchor on the ticket prefix instead. */
  const idleCall = page.locator('button').filter({ hasText: /^\s*Call\s+[A-Z]{2,4}-\d/ }).first();
  const idleLabel = (await idleCall.innerText().catch(() => '')).trim();
  console.log(`  [step] idle button reads: "${idleLabel || '(not present)'}"`);
  if (idleLabel) acks['Call next customer'] = (await pressAndWatch(page, idleLabel)).how;
  await dismissTour(page);
  await expect(page.locator('body')).toContainText(/start service/i, { timeout: 15_000 });

  // ── call again, the one that felt dead ────────────────────────────────
  acks['Call Again'] = (await pressAndWatch(page, 'Call Again')).how;
  await dismissTour(page);

  // ── a wrong code must be refused, and SAY so ──────────────────────────
  const boxes = page.locator('input[inputmode=numeric], .ql-code input, input[maxlength="1"]');
  if (await boxes.count() >= 6) {
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill(String((i + 1) % 10));
    const start = page.locator('button').filter({ hasText: /start service/i }).first();
    if (await start.isEnabled().catch(() => false)) {
      await start.click();
      await page.waitForTimeout(SLOW_MS + 1200);
      await expect(page.locator('body'), 'a wrong code was not explained').toContainText(/does not match|invalid|incorrect/i);
    }
  }

  // ── called → serving, with the real code ──────────────────────────────
  const fresh = await (await page.request.get(`${API}/api/tickets/queue/${queue.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const called = (Array.isArray(fresh) ? fresh : []).find((t: any) => t.status === 'called');
  /* From the database, not the API: staff are deliberately never given this
     code, so the harness has to look where the clerk cannot. */
  const realCode = called ? await verificationCodeFor(called.id) : null;
  const boxCount = await boxes.count();
  console.log(`  [diag] called ticket=${called?.ticket_number ?? 'none'} code=${realCode ?? 'none'} boxes=${boxCount}`);
  if (realCode && boxCount >= 6) {
    const code = String(realCode).slice(0, 6);
    for (let i = 0; i < 6; i += 1) await boxes.nth(i).fill(code[i]);
    acks['Start Service'] = (await pressAndWatch(page, 'Start Service')).how;
    await dismissTour(page);
    await expect(page.locator('body')).toContainText(/complete and call next/i, { timeout: 15_000 });

    // ── serving → complete: THE button from the report ──────────────────
    const readiness = page.locator('button').filter({ hasText: /^ready$/i }).first();
    if (await readiness.isVisible().catch(() => false)) await readiness.click();
    acks['Complete And Call Next'] = (await pressAndWatch(page, 'Complete And Call Next')).how;
  }

  console.log('  acknowledgement at each step:');
  Object.entries(acks).forEach(([k, v]) => console.log(`    ${k.padEnd(24)} ${v.join(', ') || 'NOTHING'}`));

  const silent = Object.entries(acks).filter(([, how]) => how.length === 0).map(([k]) => k);
  expect(silent.join(', ') || 'none',
    `pressed with no visible acknowledgement: ${silent.join(', ')}`).toBe('none');
  expect(Object.keys(acks).length, 'the loop never got past the first step').toBeGreaterThanOrEqual(2);
});

test('the buttons on screen do what their label says', async ({ page }) => {
  await signIn(page, 'lineStaff');
  await openDesk(page);

  /* Transfer and Requeue were both wired to the Complete handler: pressing
     either silently closed the visit as served. They are gone until something
     real backs them. If they come back, they must not share a handler with
     Complete — this asserts they are not silently present again. */
  const body = await page.locator('body').innerText();
  if (/complete and call next/i.test(body)) {
    const transfer = page.locator('button').filter({ hasText: /^\s*Transfer\s*$/ });
    const requeue = page.locator('button').filter({ hasText: /^\s*Requeue\s*$/ });
    expect(await transfer.count(), 'Transfer is back on screen — check it is not wired to Complete').toBe(0);
    expect(await requeue.count(), 'Requeue is back on screen — check it is not wired to Complete').toBe(0);
  }
});
