const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

/* ── Why the packaged app is not loaded from file:// ─────────────────────────
 *
 * It used to be, via win.loadFile(), and that is what broke it against a real
 * server. A page on file:// has an opaque origin, and Chromium sends it as the
 * literal string `null` in the Origin header. The API's allowlist is a list of
 * origins, `null` is not on it, and there is no sane way to put it there: every
 * file:// page on the machine shares that same origin, so allowing it allows a
 * downloaded HTML file in Downloads to call the API with the operator's
 * session attached. Against api.uselyne.com it is a flat 403, on the preflight
 * and on the request:
 *
 *     Origin: null                      -> 403
 *     Origin: https://admin.uselyne.com -> 204, headers echoed back
 *
 * The fix is to give the packaged renderer a real origin of its own. A custom
 * scheme registered as `standard` gets one — `app://lyne-admin` — which is a
 * single fixed string that can go on the server's allowlist and means exactly
 * one thing: this installer. `secure: true` also puts the page in a secure
 * context, which Supabase's auth client needs for crypto and for localStorage
 * to persist a session.
 *
 * What this deliberately does NOT do: allow the `null` origin, turn off
 * webSecurity, rewrite the Origin header on the way out, or widen the server to
 * `*`. Each of those makes the error go away by removing the check.
 *
 * Registration has to happen before `app.whenReady()`, at module load.
 */
const APP_SCHEME = 'app';
const APP_HOST = 'lyne-admin';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,        // gives the scheme a real, parseable origin
      secure: true,          // treated as a secure context, like https
      supportFetchAPI: true, // fetch() works from the renderer
      corsEnabled: true,     // requests carry an Origin and honour CORS
      stream: true,          // range requests, for media
    },
  },
]);

/* First-launch settings live beside the app's own data, not in the web app's
   localStorage — they are desktop preferences (where downloads go, whether to
   start with the machine) and must survive a signed-out session or a different
   user signing in on the same install. */
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  return next;
}

const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL || 'http://localhost:5174';
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
const shouldOpenDevTools = isDev && process.env.LYNE_OPEN_DEVTOOLS === 'true';
const shouldStartFullscreen = process.env.LYNE_WINDOWED !== 'true';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    fullscreen: shouldStartFullscreen,
    autoHideMenuBar: true,

    /* Title bar, per platform.
     *
     * `titleBarOverlay` is a Windows and Linux feature: it draws our own colour
     * behind the system's minimise/maximise/close buttons. macOS ignores it
     * entirely — but it did NOT ignore `titleBarStyle: 'hidden'`, which on a Mac
     * removes the title bar while leaving the traffic lights floating over
     * whatever the app draws at the top left. Nothing in the UI reserves space
     * for them, so the close button sat on top of our own chrome.
     *
     * `hiddenInset` is the macOS answer: same frameless look, traffic lights
     * nudged down and in so they sit in their own margin.
     */
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : {
          titleBarStyle: 'hidden',
          titleBarOverlay: { color: '#0a0a0a', symbolColor: '#ffffff', height: 36 },
        }),

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      /* Stated rather than left to the default, because this is the thing
         somebody reaches for when CORS fails and it is the wrong answer. The
         app:// origin above is what makes the requests legitimate; turning
         this off would make every origin legitimate. */
      webSecurity: true,
    },

    /* Windows and Linux take the window icon from here. macOS does not — it
       reads the icon from the built .app bundle — so pointing this at a .ico on
       a Mac is at best ignored and at worst a console warning. */
    ...(process.platform === 'darwin'
      ? {}
      : { icon: path.join(__dirname, '../src/assets/icon.ico') }),

    backgroundColor: '#0a0a0a',
    show: false,
  });

  if (isDev) {
    win.loadURL(devServerUrl);
    if (shouldOpenDevTools) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadURL(`${APP_ORIGIN}/index.html`);
  }

  win.once('ready-to-show', () => win.show());

  // Open external links in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  /* Top-level navigation stays on our own origin. Anything else is a link that
     should open in the browser, not replace the admin app with a web page that
     then sits on the app:// origin and inherits its allowlist entry. */
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? devServerUrl : APP_ORIGIN;
    if (!url.startsWith(allowed)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

/* Serves the built renderer over app://. Only reached in a packaged build —
   in dev the window points at Vite. */
function registerAppProtocol() {
  const root = fs.realpathSync(path.join(__dirname, '..', 'dist'));

  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);

    /* One host, and only one. app://anything-else is not ours, and refusing it
       keeps the origin a single fixed string rather than a family of them. */
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }

    const requested = decodeURIComponent(url.pathname);
    const target = path.normalize(path.join(root, requested));

    /* The handler can read anything the user can, so the resolved path has to
       be proven to be inside dist/ before it is opened. `..` segments and
       symlinks both normalise away here; realpath on the root means a
       symlinked dist cannot be used to escape by comparing against the link
       instead of its destination. */
    if (target !== root && !target.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain' } });
    }

    /* The renderer uses HashRouter, so a route lives in the fragment and the
       path is always a real file. The fallback is for the two cases that are
       not — app://lyne-admin/ on its own, and a directory — rather than a
       general SPA rewrite, which would turn a genuinely missing asset into a
       silent copy of index.html. */
    let file = target;
    try {
      if (!fs.statSync(file).isFile()) file = path.join(root, 'index.html');
    } catch {
      if (requested === '/' || requested === '') file = path.join(root, 'index.html');
      else return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }

    return net.fetch(pathToFileURL(file).toString());
  });
}

app.whenReady().then(() => {
  if (!isDev) registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: open external URL
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

/* ── first-launch setup ── */
ipcMain.handle('settings:get', () => ({
  ...readSettings(),
  defaultDownloadDir: app.getPath('downloads'),
  version: app.getVersion(),
  platform: process.platform,
}));

ipcMain.handle('settings:set', (_, patch) => writeSettings(patch || {}));

/* Where generated reports get saved. Returns null if the person cancels, so
   the caller can leave the existing choice alone rather than clearing it. */
ipcMain.handle('settings:pick-folder', async (_, current) => {
  const win = BrowserWindow.getFocusedWindow();
  const res = await dialog.showOpenDialog(win, {
    title: 'Where should downloaded reports be saved?',
    defaultPath: current || app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Save Reports Here',
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('settings:open-folder', (_, dir) => shell.openPath(dir));

/* Start with the machine — a branch terminal should come back up after a power
   cut without someone having to know to launch it. */
ipcMain.handle('settings:set-login-launch', (_, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  return app.getLoginItemSettings().openAtLogin;
});
