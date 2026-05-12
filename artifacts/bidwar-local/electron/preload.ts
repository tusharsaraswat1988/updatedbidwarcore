import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("bidwar", {
  getLocalIP: () => ipcRenderer.invoke("get-local-ip"),
  getServerPort: () => ipcRenderer.invoke("get-server-port"),
  getDbPath: () => ipcRenderer.invoke("get-db-path"),
  openBrowser: (path: string) => ipcRenderer.invoke("open-browser", path),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
});
