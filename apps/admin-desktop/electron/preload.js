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
