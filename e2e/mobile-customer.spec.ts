import { test, expect, Page, APIRequestContext, request as pwRequest } from '@playwright/test';
import { readFileSync } from 'fs';
import { demoDb } from './helpers';

/**
 * Signed-in release checks, as the review customer, on the Expo web build.
 *
 *   D8  in service: no Leave / Notify, "You are now being served", and
 *       "Mark as incomplete" records the visit the way the desk does
 *       (served + readiness_outcome 'incomplete' + the automatic note)
 *   D8  waiting: Leave queue asks for a reason and records it
 *   C7  Live Activity token register / refuse when ended / unregister
 *   F14 the deletion path exists and is guarded by typing DELETE
 *       (stops before the final press — this is the review account)
 *   F15 Premium screen shows plans, Restore and the auto-renew terms;
 *       the server refuses unknown products and unverifiable purchases
 *
 * Needs the session from e2e/customer.setup.ts, the API on :4000 against the
 * local demo database, and the Expo web server on :5173. The counter side of
 * a visit (calling, serving) is done in the local database, never the hosted.
 */
const MOBILE = process.env.MOBILE_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:4000/api';
const STATE = 'e2e/.auth/customer.json';
const INCOMPLETE_NOTE = 'Marked incomplete by the customer in the app.';

test.use({ viewport: { width: 390, height: 844 }, storageState: STATE });

function accessToken(): string {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  for (const origin of state.origins ?? []) {
    for (const item of origin.localStorage ?? []) {
      if (/auth-token/.test(item.name)) {
        const v = JSON.parse(item.value);
        return v.access_token ?? v.currentSession?.access_token;
      }
    }
  }
  throw new Error('No Supabase session in e2e/.auth/customer.json — run the customer-setup project.');
}

function sub(token: string): string {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
}

let api: APIRequestContext;
let userId: string;

test.beforeAll(async () => {
  const token = accessToken();
  api = await pwRequest.newContext({ baseURL: API + '/', extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const [u] = await demoDb<{ id: string }>('SELECT id FROM users WHERE supabase_uid = ?', [sub(token)]);
  expect(u, 'the signed-in account has no users row in the local DB').toBeTruthy();
  userId = u.id;
});

test.afterAll(async () => { await api?.dispose(); });

/** End any live ticket this account holds, then join a fresh one. */
async function freshTicket(): Promise<{ id: string; queueId: string }> {
  await demoDb(
    `UPDATE queue_tickets SET status = 'cancelled', completed_at = NOW()
      WHERE user_id = ? AND status IN ('waiting','called','in_service')`, [userId]);
  // Any open queue today whose service has no mandatory readiness items, so
  // the join is not refused for an unticked checklist.
  const [q] = await demoDb<{ id: string }>(
    `SELECT q.id FROM queues q
       JOIN branches b ON b.id = q.branch_id AND b.is_active = TRUE
      WHERE q.queue_date = CURDATE() AND q.is_active = TRUE
        AND NOT EXISTS (SELECT 1 FROM service_readiness r
                         WHERE r.service_id = q.service_id AND r.is_mandatory = TRUE AND r.is_active = TRUE)
      LIMIT 1`);
  test.skip(!q, 'no open queue today in the local demo DB');
  const res = await api.post('tickets', { data: { queue_id: q.id, readiness_acknowledged: true } });
  expect(res.status(), await res.text()).toBeLessThan(300);
  const { id } = await res.json();
  expect(id).toBeTruthy();
  return { id, queueId: q.id };
}

async function openTicket(page: Page) {
  await page.goto(MOBILE);
  await expect(page.getByText(/What do you need/)).toBeVisible({ timeout: 150_000 });
  await page.getByLabel(/^Your ticket$/).click();
  await expect(page.getByText('Your ticket').first()).toBeVisible({ timeout: 30_000 });
}

test('D8: in service shows only "Mark as incomplete", and it records like the desk', async ({ page }) => {
  const t = await freshTicket();
  await demoDb(`UPDATE queue_tickets SET status = 'in_service', called_at = NOW(), started_serving_at = NOW() WHERE id = ?`, [t.id]);

  await openTicket(page);
  await expect(page.getByText('You are now being served.')).toBeVisible();
  await expect(page.getByText('Leave queue')).toHaveCount(0);
  await expect(page.getByText(/^Notify me/)).toHaveCount(0);

  await page.getByText('Mark as incomplete').click();
  await expect(page.getByText('Mark this visit incomplete?')).toBeVisible();
  await page.getByText('Mark incomplete', { exact: true }).click();

  await expect.poll(async () => (await demoDb(
    'SELECT status, readiness_outcome, readiness_note, closed_reason, completed_at IS NOT NULL AS done FROM queue_tickets WHERE id = ?', [t.id]))[0],
  { timeout: 20_000 }).toMatchObject({
    status: 'served', readiness_outcome: 'incomplete', readiness_note: INCOMPLETE_NOTE, closed_reason: 'customer_left', done: 1,
  });
  // The same trail a desk completion leaves behind.
  const [hist] = await demoDb('SELECT COUNT(*) AS n FROM visit_history WHERE ticket_id = ?', [t.id]);
  expect(Number(hist.n)).toBeGreaterThan(0);
  await expect(page.getByText(/marked incomplete/i).first()).toBeVisible({ timeout: 20_000 });
});

test('D8: waiting shows Leave queue; leaving asks why and records the answer', async ({ page }) => {
  const t = await freshTicket();
  await openTicket(page);
  await expect(page.getByText('Mark as incomplete')).toHaveCount(0);
  await page.getByText('Leave queue').click();
  await expect(page.getByText('Leave this queue?')).toBeVisible();

  // Hold to leave: press and keep holding past the 1.1 s hold.
  const hold = page.getByText('Hold to leave');
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1800);
  await page.mouse.up();

  await expect(page.getByText('The wait was too long')).toBeVisible({ timeout: 20_000 });
  await page.getByText('The wait was too long').click();
  await expect.poll(async () => (await demoDb('SELECT status, closed_reason FROM queue_tickets WHERE id = ?', [t.id]))[0],
    { timeout: 20_000 }).toMatchObject({ status: 'left' });
  const [row] = await demoDb('SELECT closed_reason FROM queue_tickets WHERE id = ?', [t.id]);
  expect(row.closed_reason, 'the leaving reason was not recorded').toBeTruthy();
});

test('C7: a Live Activity token registers, is refused once the ticket ends, and unregisters', async () => {
  const t = await freshTicket();
  const token = 'a'.repeat(64);
  let r = await api.post(`tickets/${t.id}/live-activity`, { data: { push_token: token } });
  expect(r.status(), await r.text()).toBe(204);
  expect((await demoDb('SELECT COUNT(*) AS n FROM live_activity_tokens WHERE ticket_id = ?', [t.id]))[0].n).toBe(1);

  r = await api.delete(`tickets/${t.id}/live-activity`);
  expect(r.status()).toBe(204);
  expect((await demoDb('SELECT COUNT(*) AS n FROM live_activity_tokens WHERE ticket_id = ?', [t.id]))[0].n).toBe(0);

  await demoDb(`UPDATE queue_tickets SET status = 'served', completed_at = NOW() WHERE id = ?`, [t.id]);
  r = await api.post(`tickets/${t.id}/live-activity`, { data: { push_token: token } });
  expect(r.status()).toBe(409);
});

test('F15: the server refuses unknown products and purchases it cannot verify', async () => {
  const products = await (await api.get('iap/products')).json();
  expect(products.products).toEqual(['com.lyne.mobile.premium.monthly', 'com.lyne.mobile.premium.yearly']);

  const [before] = await demoDb('SELECT is_premium FROM users WHERE id = ?', [userId]);
  let r = await api.post('iap/verify', { data: { platform: 'ios', product_id: 'com.lyne.mobile.premium.lifetime', transaction_id: '1' } });
  expect(r.status()).toBe(400);
  r = await api.post('iap/verify', { data: { platform: 'ios', product_id: 'com.lyne.mobile.premium.monthly', transaction_id: '2000000000000000' } });
  expect(r.status(), 'an unverifiable purchase must not succeed').toBeGreaterThanOrEqual(400);
  r = await api.post('iap/verify', { data: { platform: 'android', product_id: 'com.lyne.mobile.premium.yearly', purchase_token: 'not-a-real-token' } });
  expect(r.status()).toBeGreaterThanOrEqual(400);
  const [after] = await demoDb('SELECT is_premium FROM users WHERE id = ?', [userId]);
  expect(after.is_premium).toBe(before.is_premium);
});

test('F15: the Premium screen offers plans, Restore and the renewal terms', async ({ page }) => {
  await page.goto(MOBILE);
  await expect(page.getByText(/What do you need/)).toBeVisible({ timeout: 150_000 });
  await page.getByLabel('Settings').click();
  await page.getByText(/Lyne Premium/).first().click();
  await expect(page.getByText('Restore purchases')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Renews automatically|Premium is on/).first()).toBeVisible();
  await expect(page.getByText(/Terms/).first()).toBeVisible();
  await expect(page.getByText(/Privacy/).first()).toBeVisible();
});

test('F14: Delete account is the last row and needs DELETE typed (not pressed here)', async ({ page }) => {
  await page.goto(MOBILE);
  await expect(page.getByText(/What do you need/)).toBeVisible({ timeout: 150_000 });
  await page.getByLabel('Settings').click();
  await page.getByLabel('Delete account').click();
  await expect(page.getByText(/type/i).filter({ hasText: 'DELETE' }).first()).toBeVisible();
  const confirm = page.getByText('Delete everything');
  await expect(confirm).toBeVisible();
  await confirm.click();
  // Without DELETE typed, nothing is deleted and the sheet says why.
  await expect(page.getByText('Type DELETE to confirm.')).toBeVisible();
  const [still] = await demoDb('SELECT COUNT(*) AS n FROM users WHERE id = ?', [userId]);
  expect(Number(still.n)).toBe(1);
});
