"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("bidwar", {
    getLocalIP: () => electron_1.ipcRenderer.invoke("get-local-ip"),
    getServerPort: () => electron_1.ipcRenderer.invoke("get-server-port"),
    getDbPath: () => electron_1.ipcRenderer.invoke("get-db-path"),
    openBrowser: (path) => electron_1.ipcRenderer.invoke("open-browser", path),
    openExternal: (url) => electron_1.ipcRenderer.invoke("open-external", url),
});
