import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'fs';

/**
 * One sign-in, by a person, for the customer suite.
 *
 * Sign-in goes to the hosted auth service, so no test in this repo types a
 * password. This opens a visible browser on the Expo web build and waits
 * (up to ten minutes) for someone to sign in by hand as the review account.
 * The resulting session is saved to e2e/.auth/customer.json (git-ignored) and
 * every customer test reuses it until it expires.
 *
 *   npx playwright test --project=customer-setup --headed
 */
const MOBILE = process.env.MOBILE_URL || 'http://localhost:5173';
export const CUSTOMER_STATE = 'e2e/.auth/customer.json';

setup.setTimeout(11 * 60_000);

setup('a person signs in once', async ({ page }) => {
  mkdirSync('e2e/.auth', { recursive: true });
  await page.goto(MOBILE);
  // Home's greeting is the sign that a session exists.
  await expect(page.getByText(/What do you need/)).toBeVisible({ timeout: 10 * 60_000 });
  await page.context().storageState({ path: CUSTOMER_STATE });
});
