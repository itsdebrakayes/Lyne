import { test, expect, Page } from '@playwright/test';

/**
 * The customer app, held to the same standard as the desk.
 *
 * Same principle, different person: when somebody taps, the app has to say it
 * heard them. On a phone this matters more than on a counter machine, because
 * the connection is worse and the consequence of a double-tap is joining a
 * queue twice — or believing you have not joined at all and walking away.
 *
 * Runs against the Expo web build, which is the same React tree the native app
 * renders. It cannot test a real device, and it is not trying to: what it
 * checks is the behaviour of the components, not the platform under them.
 */

/* The Expo dev server. A static export would be steadier, but the exported
   bundle needs Supabase and API values inlined at build time and does not yet
   get them — see playwright.config.ts.
     cd apps/mobile && npx expo start --web --port 5173                      */
const MOBILE = process.env.MOBILE_URL || 'http://localhost:5173';
const SLOW_MS = 1200;

test.use({ viewport: { width: 390, height: 844 } });

/**
 * Get from a cold load to the sign-in form.
 *
 * The app opens on onboarding — "Welcome to Lyne · Start queuing" — not on the
 * login screen, so anything that assumes a form on first paint waits forever
 * for an input that is several taps away.
 */
async function reachSignIn(page: Page) {
  await page.goto(MOBILE);

  /* Wait for the CONTROL, not the wordmark. "Lyne" paints as soon as the bundle
     evaluates, well before onboarding is interactive — waiting on it meant the
     loop below asked "is the button visible?" too early, got false, and gave up
     on the first pass. */
  const anyInput = page.locator('input');
  const advance = page.getByRole('button', { name: /start queuing|get started|continue|next|skip/i }).first();
  await Promise.race([
    advance.waitFor({ state: 'visible', timeout: 150_000 }).catch(() => {}),
    anyInput.first().waitFor({ state: 'visible', timeout: 150_000 }).catch(() => {}),
  ]);

  for (let i = 0; i < 8; i += 1) {
    if (await anyInput.count() > 0) return;
    if (!(await advance.isVisible().catch(() => false))) break;
    await advance.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  await expect(anyInput.first(), 'never reached a sign-in form').toBeVisible({ timeout: 30_000 });
}


/**
 * Tap a control by its visible words, whatever React Native Web made of it.
 *
 * The sign-in screen renders no <button> and no role="button" — the pressable
 * is a bare view with a handler, and the text sits inside it. So getByRole
 * finds nothing, and getByText finds the text node, which has no handler on it:
 * the click lands on a child and the screen does not move.
 *
 * This walks up from the text to the nearest ancestor big enough to be the
 * touch target and clicks its centre with a real mouse event, which is what a
 * finger does.
 */
async function tap(page: Page, label: RegExp) {
  const box = await page.evaluate((src) => {
    const re = new RegExp(src.source, src.flags);
    const leaf = [...document.querySelectorAll('*')]
      .filter((e) => !e.children.length && re.test((e.textContent || '').trim()))
      .pop() as HTMLElement | undefined;
    if (!leaf) return null;
    let node: HTMLElement | null = leaf;
    for (let i = 0; i < 4 && node; i += 1) {
      const r = node.getBoundingClientRect();
      if (r.height >= 36 && r.width >= 60) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      node = node.parentElement;
    }
    const r = leaf.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, { source: label.source, flags: label.flags });
  if (!box) throw new Error(`no control matching ${label}`);
  await page.mouse.click(box.x, box.y);
}

/* Addressed by position, not by role.
   React Native Web renders a Pressable as <div role="button"> wrapping a text
   node. getByText resolves to the text, which carries no handler — the click
   lands and nothing happens, and the test sits on the sign-in screen until it
   times out. The onboarding button worked precisely because it was addressed
   by role. */
async function signInMobile(page: Page) {
  await reachSignIn(page);
  /* reachSignIn returns the moment an input exists, which is a frame or two
     before the screen has settled — filling and tapping into that gap loses the
     press. A short settle here is the difference between this passing and
     sitting on the sign-in form until the test times out. */
  await page.waitForTimeout(2500);

  /* Type, then read it back.
     fill() sets the DOM value and fires one input event. If React has not yet
     attached its handler — routine while the dev server is still compiling —
     the box LOOKS filled and the component's state is empty, so every press
     after that submits nothing and the screen correctly stays put. Reading the
     value back is not the whole check, but re-filling before each press is
     what turns a swallowed first attempt into a recoverable one. */
  const enterCredentials = async () => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill('');
    await inputs.nth(0).pressSequentially('user@test.com', { delay: 15 });
    await inputs.nth(1).fill('');
    await inputs.nth(1).pressSequentially('test1234', { delay: 15 });
    return (await inputs.nth(0).inputValue()) === 'user@test.com'
        && (await inputs.nth(1).inputValue()) === 'test1234';
  };

  /* Three presses, each with the credentials typed fresh.
     Against the Expo DEV server the press is occasionally lost — the screen is
     interactive but a route is still compiling underneath. A suite that is red
     often enough to be ignored is worse than no suite at all; three genuine
     failures in a row is a real failure and is reported with whatever the app
     put on screen, so the next person does not have to guess.

     Every wait here is sized against the 180s this test is allowed (see
     playwright.config.ts). A press that is going to work reaches Home in about
     fifteen seconds; waiting 45 for it bought nothing and, three times over,
     spent the whole budget before the retries could finish — which turned a
     recoverable lost press into a timeout and made the run slower to boot. */
  const landed = page.getByText(/good (morning|afternoon|evening)/i);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      console.log('  [retry] the sign-in press did not take; typing and pressing again');
      await page.waitForTimeout(1500);
    }
    if (!(await enterCredentials())) continue;
    await tap(page, /^Sign in$/);
    try {
      await landed.waitFor({ state: 'visible', timeout: 20_000 });
      return;
    } catch { /* fall through to the next attempt */ }
  }

  /* Say what the app was showing. "Never reached the home screen" is true of a
     wrong password, a dead API and a swallowed tap alike, and those are three
     different mornings for whoever reads this. */
  const shown = (await page.locator('body').innerText().catch(() => '')).trim().replace(/\n+/g, ' | ');
  await expect(landed,
    `signing in never reached the home screen; the app was showing: ${shown.slice(0, 300)}`,
  ).toBeVisible({ timeout: 15_000 });
}

test('the app opens on onboarding, and onboarding leads somewhere', async ({ page }) => {
  await page.goto(MOBILE);
  await expect(page.getByText(/lyne/i).first()).toBeVisible({ timeout: 120_000 });
  const opening = await page.locator('body').innerText();
  expect(opening, 'the first screen is blank').not.toHaveLength(0);
  // A first screen with no way forward is a dead end, whatever it says.
  await expect(page.getByRole('button', { name: /start queuing|get started|continue|sign in/i }).first()).toBeVisible();
  await reachSignIn(page);
  expect(await page.locator('input').count(), 'onboarding never reaches a sign-in form').toBeGreaterThan(0);
});

test('a wrong password is explained, not just refused', async ({ page }) => {
  await reachSignIn(page);
  const inputs = page.locator('input');
  await inputs.nth(0).fill('user@test.com');
  await inputs.nth(1).fill('definitely-not-the-password');
  await tap(page, /^Sign in$/);

  /* The person needs to know it was the PASSWORD — not the network, not the
     account. "Something went wrong" leaves them retyping an email that was
     already right. */
  await expect(page.locator('body')).toContainText(
    /password|credential|incorrect|invalid|does not match/i,
    { timeout: 30_000 },
  );
});

test('signing in acknowledges the tap', async ({ page }) => {
  await reachSignIn(page);

  // Hold the auth response so the in-flight state is observable at all.
  await page.route('**/auth/v1/token**', async (route) => {
    await new Promise((r) => setTimeout(r, SLOW_MS));
    return route.fallback();
  });

  const inputs = page.locator('input');
  await inputs.nth(0).fill('user@test.com');
  await inputs.nth(1).fill('test1234');

  const before = (await page.locator('body').innerText()).slice(0, 400);
  await tap(page, /^Sign in$/);
  await page.waitForTimeout(300);
  const during = (await page.locator('body').innerText()).slice(0, 400);

  expect(during, 'tapping Sign in changed nothing on screen — it reads as a dead button')
    .not.toBe(before);
});

test('the home screen shows real branches, not an empty shell', async ({ page }) => {
  await signInMobile(page);

  /* Home opens on "Open now", so outside business hours the honest answer is a
     closed-branches state, not a list — and this test used to fail every night
     for that reason, which taught whoever ran it to ignore a red suite. The
     screen is right; the assumption of daylight was wrong. Switch to All when
     nothing is open, then hold the real claim: agencies, with waits beside
     them, whatever the hour. */
  /* signInMobile returns the moment the greeting paints, which is before the
     branch list has loaded — checking for the closed state right here found
     nothing and fell straight through to the assertion. */
  await page.waitForTimeout(3000);

  if (/nothing open here yet|every branch in this filter is closed/i.test(
        await page.locator('body').innerText())) {
    console.log('  [hours] everything is closed right now; switching to All');
    await tap(page, /^Show all branches$/);
    await page.waitForTimeout(3000);
  }

  const body = await page.locator('body').innerText();
  // Somebody has to be listed, with a wait beside them, or the screen is furniture.
  expect(body, 'no agency is listed on the home screen').toMatch(/credit union|passport|tax|court|university|housing/i);
  expect(body, 'no wait time is shown next to anything').toMatch(/no wait|\d+m wait|in line/i);
});

test('a zero wait never reads as "Now wait"', async ({ page }) => {
  await signInMobile(page);
  const body = await page.locator('body').innerText();
  /* waitShort() answers "how long?" with a bare "Now", which is right beside a
     heading and wrong the moment a caller appends the noun. One did. */
  expect(body, 'the broken "Now wait" phrasing is back').not.toMatch(/Now wait/);
});

test('losing the connection is explained rather than shown as emptiness', async ({ page }) => {
  await signInMobile(page);
  await page.route('**/api/**', (route) => route.abort('failed'));
  await page.reload().catch(() => {});
  await page.waitForTimeout(6000);

  const body = await page.locator('body').innerText();
  console.log(`  [offline] ${body.trim().length} chars on screen:`);
  console.log('    ' + body.trim().slice(0, 300).replace(/\n+/g, ' | '));

  /* The floor: an offline phone must not be a blank rectangle. A blank list is
     indistinguishable from "there are no branches near you" — a different and
     much worse message than "we cannot reach the network". */
  expect(body.trim().length,
    'the app went blank when the network failed, which reads as "nothing here"').toBeGreaterThan(40);

  /* It must NAME the problem. */
  await expect(page.locator('body'),
    'an unreachable API is not explained on screen').toContainText(
    /no connection|can.?t reach|unable to connect|offline/i);

  /* And it must not ask for a password.
     This is the regression that matters. The session gate treated "the API did
     not answer" as "you are not signed in", so a dropped connection put a login
     form in front of somebody whose session was sitting valid on the device —
     they retype a password to fix a problem the password was never part of. A
     refusal still signs them out; an unreachable server does not. */
  await expect(page.locator('input'),
    'a dropped connection dumped a signed-in person back to the password form').toHaveCount(0);
});

/* The other half of the rule above, and the one that would be dangerous to get
   wrong: keeping a session through a network failure must not turn into keeping
   a session the server has actually rejected. A revoked or expired token has to
   put the login form back. */
test('a refused token still signs the person out', async ({ page }) => {
  await signInMobile(page);
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }));
  await page.reload().catch(() => {});
  await page.waitForTimeout(6000);

  const body = (await page.locator('body').innerText()).trim().replace(/\n+/g, ' | ');
  console.log(`  [refused] ${body.slice(0, 200)}`);

  await expect(page.locator('input').first(),
    'a rejected token left the app signed in instead of returning to sign-in').toBeVisible({ timeout: 20_000 });
  await expect(page.locator('body'),
    'a refusal was reported as a connection problem').not.toContainText(/no connection/i);
});
