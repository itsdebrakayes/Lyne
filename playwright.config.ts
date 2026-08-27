import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests for the screens people actually stand in front of.
 *
 * These exist because a class of fault kept reaching the user that nothing else
 * could catch. `npm test` proves the backend's logic; check-integrity proves the
 * data is consistent. Neither can tell you that pressing Complete looks like
 * nothing happened, so the clerk presses it again — which is the report that
 * started this suite.
 *
 * So the tests here assert what a person can SEE and what happens when they
 * touch it: that an action acknowledges the press, that a failure explains
 * itself, that one slow panel does not blank the page.
 *
 * Servers are assumed to be already running — the admin dev server on 5174 and
 * the API on 4000 — because both are long-lived here and starting a second copy
 * fights the one already up.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.ADMIN_URL || 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'admin', use: { ...devices['Desktop Chrome'] } },
  ],
});
