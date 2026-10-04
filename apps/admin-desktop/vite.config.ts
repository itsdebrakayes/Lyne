import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import electron from 'vite-plugin-electron';
import path from 'path';

/* ── Where the packaged app sends its requests ───────────────────────────────
 *
 * This lives in a committed file on purpose. `.env` is gitignored and holds
 * `VITE_API_URL=http://localhost:4000/api`, which is right for `npm run dev`
 * and catastrophic in an installer: Vite compiles the value into the bundle, so
 * a production build made with that .env present ships an admin app that tries
 * to reach the operator's own machine and fails on every screen.
 *
 * It is not a secret. Every VITE_ value is, by definition, public — it is a
 * string literal in a JavaScript file handed to whoever installs the app.
 *
 * So in production mode a local-looking VITE_API_URL is treated as "nobody
 * configured this", not as a choice, and the production API is substituted. An
 * explicit non-local VITE_API_URL (staging, a branch server) still wins.
 */
const PRODUCTION_API_URL = 'https://api.uselyne.com/api';

const isLocal = (value?: string) =>
  !value?.trim() || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(value.trim());

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  const apiUrl = mode === 'production' && isLocal(env.VITE_API_URL) ? PRODUCTION_API_URL : env.VITE_API_URL;

  if (mode === 'production' && isLocal(env.VITE_API_URL)) {
    console.log(`\n  ℹ  VITE_API_URL was ${env.VITE_API_URL ? `local (${env.VITE_API_URL})` : 'unset'} — building against ${PRODUCTION_API_URL}\n`);
  }

  return {
    plugins: [
      react(),
      electron([
        {
          entry: 'electron/main.js',
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: { external: ['electron'] },
            },
          },
        },
        {
          entry: 'electron/preload.js',
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: { external: ['electron'] },
            },
          },
        },
      ]),
    ],

    /* Overrides Vite's own replacement of this one key, so the substitution
       above survives into the bundle regardless of what .env said. */
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl ?? ''),
    },

    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    // host:true so a real branch tablet (and the iOS Simulator) can reach the dev
    // server over the LAN, not just this machine.
    server: { port: 5174, host: true },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          // The Electron admin app. Stays at dist/index.html.
          main: path.resolve(__dirname, 'index.html'),
          // The standalone lobby terminal — its own page, its own bundle, no
          // admin session. Served to a tablet; never packaged into Electron.
          kiosk: path.resolve(__dirname, 'kiosk.html'),
        },
      },
    },
  };
});
