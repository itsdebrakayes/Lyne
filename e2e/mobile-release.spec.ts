import { test, expect, Page } from '@playwright/test';

/**
 * Release items that can be proven without signing in, on the Expo web build
 * (the same React tree the phone renders). Brief items:
 *   E9  first launch lands on sign-up; switching to sign-in is the same screen
 *   E10 the date-of-birth calendar puts 7 April 1977 under Thursday
 *   E11 the picker goes year → month grid → day
 *
 * No credentials are typed anywhere in this file: sign-in talks to the hosted
 * auth service, so nothing here presses Sign in or Create account.
 *
 *   cd apps/mobile && EXPO_PUBLIC_API_URL=http://localhost:4000/api npx expo start --web --port 5173
 */
const MOBILE = process.env.MOBILE_URL || 'http://localhost:5173';

test.use({ viewport: { width: 390, height: 844 } });

/** The launch animation plays first; wait for the form under it. */
async function reachAuth(page: Page) {
  await page.goto(MOBILE);
  await expect(page.getByText('Create your account')).toBeVisible({ timeout: 150_000 });
}

test('E9: a first launch opens on sign-up, and sign-in is the same screen', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await reachAuth(page);

  const email = page.getByPlaceholder('you@email.com');
  await expect(page.getByPlaceholder('e.g. Debra Samuels')).toBeVisible();
  await email.fill('switch-check@example.com');
  const urlBefore = page.url();

  await page.getByText('Sign in', { exact: true }).first().click();

  // Same screen: the URL did not change, the typed email survived, and the
  // sign-up-only fields went away instead of a new page loading.
  await expect(page.getByPlaceholder('e.g. Debra Samuels')).toHaveCount(0, { timeout: 10_000 });
  await expect(email).toHaveValue('switch-check@example.com');
  expect(page.url()).toBe(urlBefore);
  await expect(page.getByPlaceholder('Your password')).toBeVisible();

  await page.getByText('Create account', { exact: true }).first().click();
  await expect(page.getByPlaceholder('e.g. Debra Samuels')).toBeVisible();
  await expect(email).toHaveValue('switch-check@example.com');
});

test('E10 + E11: year, then month, then day; 7 April 1977 is a Thursday', async ({ page }) => {
  await reachAuth(page);
  await page.getByText('Select your date of birth').click();

  // Step 1 — year.
  const year = page.getByLabel('Year of birth');
  await expect(year).toBeVisible();
  await year.fill('1977');
  await page.getByText('Next', { exact: true }).click();

  // Step 2 — a twelve-month grid.
  for (const m of ['January', 'June', 'December']) {
    await expect(page.getByLabel(`${m} 1977`)).toBeVisible();
  }
  await page.getByLabel('April 1977').click();

  // Step 3 — days, under weekday headers S M T W T F S.
  const day = page.getByLabel('07 Apr 1977');
  await expect(day).toBeVisible();
  const box = await day.boundingBox();
  const sheetWidth = await page.evaluate(() => window.innerWidth);
  expect(box).not.toBeNull();
  // Column index from the day's centre: 0 = Sunday … 4 = Thursday. The grid
  // spans the sheet's inner width, so locate it from the first and last columns.
  const first = await page.getByLabel('03 Apr 1977').boundingBox();   // a Sunday
  const last = await page.getByLabel('09 Apr 1977').boundingBox();    // a Saturday
  expect(first && last).toBeTruthy();
  const pitch = ((last!.x + last!.width / 2) - (first!.x + first!.width / 2)) / 6;
  const col = Math.round(((box!.x + box!.width / 2) - (first!.x + first!.width / 2)) / pitch);
  expect(col, `7 Apr 1977 drawn in column ${col} of a ${sheetWidth}px sheet`).toBe(4);

  await day.click();
  await expect(page.getByText('07 Apr 1977')).toBeVisible();
});
