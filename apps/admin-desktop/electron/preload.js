/* This import is the renderer's only route to Sentry, and it is load-bearing.
   With contextIsolation on, @sentry/electron cannot reach the renderer unless
   its channel is set up here; without it the renderer SDK initialises, appears
   to work, and silently reports nothing.

   It is also what keeps the renderer off the network: events travel over IPC to
   the main process, which sends them. The packaged renderer runs on the custom
   app://lyne-admin origin, so a direct connection to sentry.io would be a
   cross-origin request from a scheme its ingest has never seen — and the usual
   way out of that is to loosen webSecurity, which this app will not do. */
require('@sentry/electron/preload');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  platform: process.platform,

  /* Desktop settings, used by first-launch setup. Everything is invoked
     through IPC — the renderer never touches the filesystem directly. */
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  pickFolder: (current) => ipcRenderer.invoke('settings:pick-folder', current),
  openFolder: (dir) => ipcRenderer.invoke('settings:open-folder', dir),
  setLoginLaunch: (on) => ipcRenderer.invoke('settings:set-login-launch', on),
});
