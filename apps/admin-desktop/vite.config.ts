import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import electron from 'vite-plugin-electron';
import path from 'path';

export default defineConfig({
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
});
