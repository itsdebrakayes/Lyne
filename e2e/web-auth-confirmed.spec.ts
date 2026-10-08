import { test, expect } from '@playwright/test';

/**
 * E12 — the page Supabase sends a person to after they tap the link in the
 * confirmation email (https://uselyne.com/auth/confirmed).
 *
 * What must hold: each outcome says what happened in plain words, nothing in
 * the address bar keeps the token after the page loads, and on a desktop the
 * page does not try to open the app.
 */
const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.e2e-not-a-real-token.sig';

test('a successful confirmation says so and strips the token from the URL', async ({ page }) => {
  await page.goto(`/auth/confirmed#access_token=${FAKE_TOKEN}&refresh_token=r&type=signup`);
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Lyne' })).toHaveAttribute('href', 'lyne://email-confirmed');
  expect(page.url()).not.toContain('access_token');
  expect(page.url()).not.toContain(FAKE_TOKEN);
  expect(page.url()).toMatch(/\/auth\/confirmed$/);
});

test('an expired link says it expired and how to get a new code', async ({ page }) => {
  await page.goto('/auth/confirmed#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
  await expect(page.getByText(/Send a new code/)).toBeVisible();
  expect(page.url()).not.toContain('error_code');
});

test('any other error, or no parameters at all, is "could not confirm"', async ({ page }) => {
  await page.goto('/auth/confirmed?error=server_error&error_code=unexpected_failure');
  await expect(page.getByRole('heading', { name: 'We could not confirm this link' })).toBeVisible();
  await page.goto('/auth/confirmed');
  await expect(page.getByRole('heading', { name: 'We could not confirm this link' })).toBeVisible();
});

test('on a desktop the page stays put instead of opening the app', async ({ page }) => {
  await page.goto(`/auth/confirmed#access_token=${FAKE_TOKEN}&type=signup`);
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
  await page.waitForTimeout(1500); // past the 700 ms phone-only redirect
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
  expect(page.url()).toMatch(/^http:\/\/localhost:\d+\/auth\/confirmed$/);
});
