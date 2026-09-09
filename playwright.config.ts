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
    {
      name: 'admin',
      testMatch: /admin-.*\.spec\.ts|api-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      /* The Expo web build, at phone size. Same React tree the native app
         renders — this tests the components, not the platform beneath them. */
      name: 'mobile',
      /* Three minutes, not one. This runs against the Expo DEV server, which
         compiles a route the first time it is asked for — a cold test pays that
         once and a warm one does not, so the same test passed in a full run and
         failed on its own. A timeout that only holds when something else warmed
         the bundle first is not a timeout. */
      timeout: 180_000,
      /* One retry, and only on this project. The admin suite runs against a
         warm Vite server and gets none — a flake there is a real signal.
         This drives the Expo DEV server, which compiles routes on demand and
         intermittently swallows the first press while it does.
         The proper fix is a static export (expo export --platform web) with
         nothing left to compile. That is attempted and NOT yet working: the
         exported bundle needs the Supabase and API values inlined at build
         time, and without them the app cannot reach anything. Until that is
         wired, this points at the dev server and tolerates one retry. */
      retries: 1,
      testMatch: /mobile-.*\.spec\.ts/,
      /* Pixel 5, not an iPhone: the iPhone profiles run WebKit, and only
         Chromium is installed here. What is under test is the React tree the
         native app also renders, so the engine is not the variable that
         matters — the phone-sized viewport and touch emulation are. */
      use: { ...devices['Pixel 5'], baseURL: process.env.MOBILE_URL || 'http://localhost:5173' },
    },
  ],
});
