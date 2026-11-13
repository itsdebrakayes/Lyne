const { printReport, stripPageMarks } = require('./reportPdf');
const { app, BrowserWindow, ipcMain, shell, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

/* Error reporting. Must be required and initialised before the window exists,
   so a crash during startup is still reported. Off entirely without a DSN, and
   off in `npm run dev` even with one — see electron/monitoring.js. */
const { initMonitoring } = require('./monitoring');
initMonitoring();

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
    openExternalSafely(url);
    return { action: 'deny' };
  });

  /* Top-level navigation stays on our own origin. Anything else is a link that
     should open in the browser, not replace the admin app with a web page that
     then sits on the app:// origin and inherits its allowlist entry. */
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? devServerUrl : APP_ORIGIN;
    if (!url.startsWith(allowed)) {
      event.preventDefault();
      openExternalSafely(url);
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
ipcMain.handle('open-external', (_, url) => openExternalSafely(url));

/* "Sign in with Microsoft" (and connecting a Microsoft account in Settings).
 *
 * Microsoft's page must not load in the app's own window: that window has the
 * preload bridge, and a third-party page there could call it. So it opens in a
 * separate window with NO preload, a sandbox, and a throwaway session (nothing
 * remembered between sign-ins on a shared branch computer). Supabase finishes
 * by redirecting to our own address with a one-time code; this window catches
 * that redirect before it loads, closes, and hands the URL back. The renderer
 * then trades the code for a session (it holds the PKCE verifier, so the code
 * is useless to anyone who sees it here).
 */
let oauthWindow = null;
ipcMain.handle('oauth:start', (event, args) => new Promise((resolve) => {
  const { url, returnTo } = args || {};
  let start;
  try { start = new URL(String(url)); } catch { return resolve({ error: 'Bad sign-in address.' }); }
  const ownOrigin = isDev ? new URL(devServerUrl).origin : APP_ORIGIN;
  if (start.protocol !== 'https:' || !/\.supabase\.co$/i.test(start.hostname) || start.pathname !== '/auth/v1/authorize'
      || typeof returnTo !== 'string' || !returnTo.startsWith(ownOrigin)) {
    return resolve({ error: 'Refused an unexpected sign-in address.' });
  }
  if (oauthWindow && !oauthWindow.isDestroyed()) oauthWindow.close();

  const parent = BrowserWindow.fromWebContents(event.sender) || undefined;
  const w = new BrowserWindow({
    parent, modal: !!parent, width: 520, height: 700, show: false, autoHideMenuBar: true,
    title: 'Sign in with Microsoft',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, partition: `oauth-${Date.now()}` },
  });
  oauthWindow = w;
  let done = false;
  const finish = (result) => {
    if (done) return;
    done = true;
    resolve(result);
    if (!w.isDestroyed()) w.close();
  };
  const watch = (e, next) => {
    if (next.startsWith(returnTo)) { e.preventDefault(); finish({ url: next }); return; }
    /* Any https page may load: a bank's Microsoft sign-in often hands over to
       the bank's own sign-in server, whose address we cannot know. The window
       has no bridge to the app and keeps nothing, so that is safe. Anything
       that is not https (a file, another app's link) is stopped. */
    let secure = false;
    try { secure = new URL(next).protocol === 'https:'; } catch { /* not a URL */ }
    if (!secure) { e.preventDefault(); finish({ error: 'The sign-in page tried to open something that is not a web page. Stopped for safety.' }); }
  };
  w.webContents.on('will-redirect', watch);
  w.webContents.on('will-navigate', watch);
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.on('closed', () => { if (oauthWindow === w) oauthWindow = null; finish({ cancelled: true }); });
  setTimeout(() => finish({ error: 'Sign-in timed out.' }), 10 * 60 * 1000);
  w.once('ready-to-show', () => w.show());
  w.loadURL(start.toString());
}));

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

/* Folders only. shell.openPath on a FILE opens it with its default handler,
   which for a program means running it, so a path that is not an existing
   directory is refused. */
ipcMain.handle('settings:open-folder', (_, dir) => {
  try {
    const target = path.resolve(String(dir || ''));
    if (!fs.statSync(target).isDirectory()) return 'Not a folder.';
    return shell.openPath(target);
  } catch {
    return 'Folder not found.';
  }
});

/* ── reports ──
   The Reports tab hands over a finished HTML document; this writes it as Word
   (.doc, HTML that Word opens) or prints it to PDF in a hidden window, into the
   folder chosen at setup (Downloads if none), then shows the file. The renderer
   never touches the filesystem. A name that already exists gets " (2)" and so
   on rather than being overwritten. */
/* The only schemes handed to the operating system. shell.openExternal passes
   the URL to whatever is registered for its scheme, and on Windows several
   registered schemes run programs (ms-msdt:, search-ms:, file: on an .exe), so
   a link reaching the renderer must never be able to choose one. */
const EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:', 'tel:']);
function openExternalSafely(url) {
  try {
    if (EXTERNAL_SCHEMES.has(new URL(String(url)).protocol)) return shell.openExternal(String(url));
  } catch { /* not a URL */ }
  console.warn('[security] refused to open a non-web link');
  return Promise.resolve();
}

function uniquePath(dir, base, ext) {
  let candidate = path.join(dir, `${base}.${ext}`);
  for (let n = 2; fs.existsSync(candidate) && n < 1000; n++) {
    candidate = path.join(dir, `${base} (${n}).${ext}`);
  }
  return candidate;
}

ipcMain.handle('report:save', async (_, args) => {
  try {
    const html = String(args && args.html || '');
    const format = args && args.format === 'pdf' ? 'pdf' : 'doc';
    const base = String(args && args.filename || 'Lyne report').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'Lyne report';
    if (!html) return { ok: false, error: 'The report was empty.' };

    const dir = readSettings().downloadDir || app.getPath('downloads');
    fs.mkdirSync(dir, { recursive: true });
    const file = uniquePath(dir, base, format);

    if (format === 'doc') {
      // Word paginates for itself, so the contents' page numbers cannot be known here.
      const wordHtml = stripPageMarks(html).replace('<html>', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">');
      fs.writeFileSync(file, '\ufeff' + wordHtml, 'utf8');
    } else {
      fs.writeFileSync(file, await printReport(BrowserWindow, html));
    }
    shell.showItemInFolder(file);
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'The report could not be saved.' };
  }
});

/* Start with the machine — a branch terminal should come back up after a power
   cut without someone having to know to launch it. */
ipcMain.handle('settings:set-login-launch', (_, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  return app.getLoginItemSettings().openAtLogin;
});
