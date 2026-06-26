"use strict";const{contextBridge:r,ipcRenderer:n}=require("electron");r.exposeInMainWorld("electronAPI",{openExternal:e=>n.invoke("open-external",e),platform:process.platform});
