const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../src/assets/icon.ico'),
    backgroundColor: '#0a0a0a',
    show: false,
  });

  if (isDev) {
    win.loadURL(devServerUrl);
    if (shouldOpenDevTools) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  // Open external links in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
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
