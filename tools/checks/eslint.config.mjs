/**
 * Lint rules that turn the owner's corrections into errors. Every message is
 * written to the agent reading it: what is wrong and what to do instead.
 * Run from the repo root: npm --prefix tools/checks run lint
 */
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const TIMER_FIX =
  'Raw timers are banned in UI code. A timer that "waits a beat" hides a race and gets copied. ' +
  'If you are waiting for something (a render, a load, a paint, an animation, focus), wait for THAT: an effect on the state, onLoad, ' +
  'requestAnimationFrame, fonts.ready, an animation callback, autoFocus. If the delay is the feature (a clock, a countdown, ' +
  'a "Saved" flash, a request deadline), use the named helper in src/lib/timing.ts: useNow, useInterval, useTimeout, deadline, abortAfter, revokeSoon (afterNextPaint for "after the next frame").';

const timerBan = {
  'no-restricted-globals': ['error',
    { name: 'setTimeout', message: TIMER_FIX },
    { name: 'setInterval', message: TIMER_FIX },
    { name: 'requestIdleCallback', message: TIMER_FIX },
  ],
  'no-restricted-properties': ['error',
    ...['window', 'globalThis', 'global'].flatMap((object) => [
      { object, property: 'setTimeout', message: TIMER_FIX },
      { object, property: 'setInterval', message: TIMER_FIX },
    ]),
  ],
};

const shortDelay = {
  selector: "CallExpression[callee.name='useTimeout'] > Literal[value<500]",
  message: 'A delay under 500 ms is a timing patch, not a feature. Wait for the event you actually need (see src/lib/timing.ts header).',
};

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.test-build/**', '**/ios/**', '**/android/**'] },

  {
    files: ['apps/**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description',
      }],
      /* A hook after an early return crashed the kiosk on the frame it signed out. */
      'react-hooks/rules-of-hooks': 'error',
    },
  },

  /* UI code: no raw timers. The one sanctioned home is src/lib/timing.ts. */
  {
    files: ['apps/admin-desktop/src/**/*.{ts,tsx}', 'apps/mobile/src/**/*.{ts,tsx}'],
    ignores: ['apps/*/src/lib/timing.ts'],
    rules: { ...timerBan, 'no-restricted-syntax': ['error', shortDelay] },
  },

  /* Admin desktop: the window (src/) and the Electron main process (electron/) are two
     programs. They talk only through the preload bridge. */
  {
    files: ['apps/admin-desktop/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'electron', message: 'The window cannot use Electron directly. Expose what you need in electron/preload.js and call it through window.lyne.' }],
        patterns: [{ regex: '^(\\.\\./)+electron(/|$)', message: 'Window code must not import main-process code. Go through the preload bridge.' }],
      }],
    },
  },
  {
    files: ['apps/admin-desktop/electron/**/*.{js,cjs,mjs}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '^(\\.\\./)+src(/|$)', message: 'Main-process code must not import window code. Pass data over IPC.' }] }],
    },
  },

  /* Apps never reach into each other's source. */
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/admin-desktop/**', '**/backend/**', '**/website/**'], message: 'The mobile app cannot import another app. Copy the type, or call the API.' }] }],
    },
  },

  /* Backend: one service-role client, one key name; one database pool. */
  {
    files: ['apps/backend/src/**/*.js'],
    ignores: ['apps/backend/src/lib/supabaseAdmin.js', 'apps/backend/src/db/pool.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^SUPABASE_SERVICE/]",
        message: 'Use supabaseAdmin() from src/lib/supabaseAdmin.js. It reads SUPABASE_SERVICE_KEY (the name production passes) and returns null when unset, so answer 503 rather than crash or fall back to a placeholder.',
      }, {
        selector: "CallExpression[callee.name='require'] > Literal[value=/^mysql2(\\/promise)?$/]",
        message: 'Use the shared pool (src/db/pool.js). It seals and opens encrypted fields (src/lib/fieldCrypto.js); a connection of your own would store walk-in phone numbers in plain text.',
      }],
    },
  },
);
