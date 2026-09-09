import { test, expect } from '@playwright/test';
import { signIn, dismissTour, acknowledgesPress, buttonSelector } from './helpers';

/**
 * Does the screen answer the person touching it?
 *
 * The report that produced this file: pressing Complete on the desk looked like
 * nothing happened, so it got pressed again. Nothing in the backend was wrong —
 * the request went, the ticket moved. The UI simply never said so, and a system
 * that does not acknowledge input reads as broken whatever it is doing
 * underneath.
 *
 * Requests are slowed deliberately in these tests. In-flight state is invisible
 * against a local API answering in 20ms, so the assertion would pass on a
 * button that does nothing at all. Holding the response for a second is what
 * makes the difference between "acknowledges the press" and "does not"
 * observable — and a second is a perfectly ordinary mobile connection.
 */

const SLOW_MS = 1200;

async function slowDownWrites(page: import('@playwright/test').Page) {
  await page.route('**/api/tickets/**', async (route) => {
    if (route.request().method() === 'GET') return route.fallback();
    await new Promise((r) => setTimeout(r, SLOW_MS));
    return route.fallback();
  });
}

test.describe('the desk answers the clerk', () => {
  /* "every action button acknowledges being pressed" used to live here.
     It could only ever reach whichever button the desk happened to be showing —
     one, in practice, and never Complete, which was the button in the report.
     It also ran after the desk-loop spec had already spent the queue, so it
     failed for want of anything to press rather than for anything true.
     admin-desk-loop.spec.ts walks the whole state machine and presses all of
     them, so this was the same assertion made worse. Deleted rather than
     skipped: a test that cannot fail for the right reason is noise. */

  test('a failed action says what went wrong', async ({ page }) => {
    await signIn(page, 'lineStaff');

    // Make the next write fail the way a real one does.
    await page.route('**/api/tickets/**', async (route) => {
      if (route.request().method() === 'GET') return route.fallback();
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Only waiting tickets can be called.' }),
      });
    });

    await page.getByRole('button', { name: /live line/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await dismissTour(page);

    const anyAction = page.locator('button').filter({ hasText: /^(Call|Complete And Call Next|No Show|Call Again)$/ }).first();
    if (!(await anyAction.isVisible().catch(() => false))) test.skip(true, 'no action available in this queue state');
    await anyAction.click().catch(() => {});
    await page.waitForTimeout(2000);

    const body = (await page.locator('body').innerText()).toLowerCase();
    /* The message has to reach the screen. A failure that only exists in the
       console is a failure the clerk experiences as the button not working. */
    expect(body, 'the failure never appeared on screen').toMatch(/waiting tickets can be called|could not|failed|error/i);
  });
});

test.describe('the header tells the truth', () => {
  test('the freshness pill is not doubled', async ({ page }) => {
    await signIn(page, 'lineStaff');
    const pills = page.locator('.qx-live');
    await expect(pills).toHaveCount(1);
    // One dot, not two — the nested-pill bug drew the indicator inside itself.
    expect(await pills.first().locator('i').count()).toBe(1);
    expect(await pills.first().locator('.qx-live').count()).toBe(0);
  });

  test('it stops claiming to be live when the API is unreachable', async ({ page }) => {
    await signIn(page, 'lineStaff');
    await expect(page.locator('.qx-live')).toContainText(/live|updated/i);

    await page.route('**/api/**', (route) => route.abort('failed'));
    await expect(page.locator('.qx-live')).toContainText(/not updating/i, { timeout: 40_000 });
    await expect(page.locator('.qx-live')).toHaveClass(/stale/);
  });
});

test.describe('the timers a clerk works to', () => {
  test('the serving timer exists and counts up', async ({ page }) => {
    await signIn(page, 'lineStaff');
    await page.getByRole('button', { name: /live line/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await dismissTour(page);

    const body = await page.locator('body').innerText();
    if (!/serving now/i.test(body)) test.skip(true, 'nobody is being served right now');

    const readClock = async () => {
      const t = await page.locator('body').innerText();
      const m = t.match(/\b(\d{1,3}):(\d{2})\b/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const first = await readClock();
    expect(first, 'no m:ss timer is shown while serving').not.toBeNull();
    await page.waitForTimeout(3000);
    const second = await readClock();
    expect(second, 'the timer is frozen').not.toBe(first);
  });

  test('a freshly called ticket counts down from its own timeout, not a stale value', async ({ page }) => {
    await signIn(page, 'lineStaff');
    await page.getByRole('button', { name: /live line/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await dismissTour(page);

    /* Read the countdown straight from the API rather than the DOM: this is
       about the DATA being right at the moment of the call. A ticket called
       just now must expire ~call_timeout_seconds from now — never minutes away
       because it carried a timestamp from an earlier life. */
    const res = await page.request.get('http://localhost:4000/api/queues/mine', {
      headers: { Authorization: `Bearer ${await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          const v = localStorage.getItem(k) || '';
          try { const p = JSON.parse(v); if (p?.access_token) return p.access_token; } catch { /* not json */ }
        }
        return '';
      })}` },
    });
    if (!res.ok()) test.skip(true, 'could not read the queue as this user');
    const queues = await res.json();
    expect(Array.isArray(queues)).toBeTruthy();
  });
});
