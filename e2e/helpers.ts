import { Page, Locator, expect } from '@playwright/test';

export const ACCOUNTS = {
  lineStaff: { email: 'staff@test.com', password: 'test1234' },
  supervisor: { email: 'supervisor@test.com', password: 'test1234' },
  executive: { email: 'executive-creditunion@test.com', password: 'test1234' },
} as const;

/** Sign in and land on a dashboard. */
export async function signIn(page: Page, who: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[who];
  await page.goto('/');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('form').getByRole('button').last().click();
  await expect(page.locator('h1')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 30_000 });
  await dismissTour(page);
}

/**
 * The guided tour opens over the screen on first visit and swallows clicks.
 * Every test that touches a control has to get past it first.
 */
export async function dismissTour(page: Page) {
  const skip = page.getByRole('button', { name: /^skip$/i });
  for (let i = 0; i < 6; i += 1) {
    if (!(await skip.isVisible().catch(() => false))) return;
    await skip.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

/**
 * Is this control telling the person their press registered?
 *
 * Any of these count, because they all answer the same question — did the
 * system hear me? A button that goes disabled, announces aria-busy, swaps to a
 * "…ing" label, or grows a spinner has answered it. One that does nothing at
 * all has not, and the person presses again.
 */
export async function acknowledgesPress(locator: Locator): Promise<{
  acknowledged: boolean; how: string[];
}> {
  /* Evaluated on the element handle, not via document.querySelector — the
     locator may be an xpath or a Playwright-only engine, which the browser's
     own querySelector cannot parse. */
  /* A vanished button is NOT an acknowledgement, and treating it as one was
     hiding three of the four presses in this suite. The control can disappear
     for two very different reasons — the view genuinely advanced, or the row
     re-rendered underneath the click — and from here they are
     indistinguishable. The caller decides, using the page-level snapshot. */
  if (!(await locator.count())) return { acknowledged: false, how: [] };
  return locator.evaluate((el: HTMLElement) => {
    const how: string[] = [];
    if ((el as HTMLButtonElement).disabled) how.push('disabled');
    if (el.getAttribute('aria-busy') === 'true') how.push('aria-busy');
    if (el.getAttribute('data-busy') === 'true') how.push('data-busy');
    if (/…|\.\.\.|ing\b/i.test(el.innerText || '')) how.push(`label:"${el.innerText.trim()}"`);
    if (el.querySelector('[class*=spin],[class*=Spin],[class*=loader],[class*=Loader],[data-spinner]')) how.push('spinner');
    if (Number(getComputedStyle(el).opacity) < 0.9) how.push(`opacity:${getComputedStyle(el).opacity}`);
    return { acknowledged: how.length > 0, how };
  });
}

/** Stable handle for a button by its visible text. */
export function buttonSelector(text: string) {
  return `xpath=//button[normalize-space(.)=${JSON.stringify(text)}]`;
}

/**
 * Read a ticket's verification code straight from the database.
 *
 * The API deliberately refuses to give this to staff — it is the customer's
 * proof of identity, and handing it to the clerk makes the check they are
 * supposed to perform something they can complete alone (see
 * e2e/api-leaks.spec.ts). That is correct, and it means the test cannot get the
 * code the way the clerk's screen does either.
 *
 * So the harness reads it from MySQL, which is the one place a test is allowed
 * to look and a browser is not. Doing it any other way would mean either
 * weakening the API to suit the test, or never covering the half of the desk
 * loop that lives behind verification.
 */
export async function verificationCodeFor(ticketId: string): Promise<string | null> {
  const { createRequire } = await import('module');
  const require = createRequire(process.cwd() + '/apps/backend/package.json');
  const mysql = require('mysql2/promise');
  const { readFileSync } = await import('fs');

  const env = Object.fromEntries(
    readFileSync(process.cwd() + '/.env', 'utf8').split('\n')
      .filter((l: string) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l: string) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
  ) as Record<string, string>;

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: Number(process.env.CHECK_MYSQL_PORT || 3308),
    user: env.MYSQL_USER || 'lyne',
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE || 'lyne',
  });
  const [rows] = await conn.query('SELECT verification_code FROM queue_tickets WHERE id = ?', [ticketId]);
  await conn.end();
  return (rows as any[])[0]?.verification_code ?? null;
}
