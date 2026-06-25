import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import os from "os";
import { fork, ChildProcess } from "child_process";
import fs from "fs";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const SERVER_PORT = 3741;
const DATA_DIR = path.join(app.getPath("userData"), "bidwar-data");
const DB_PATH = path.join(DATA_DIR, "auction.db");

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1";
}

function startServer() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const serverScript = path.join(__dirname, "../dist-server/index.js");
  serverProcess = fork(serverScript, [], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      DB_PATH,
      NODE_ENV: "production",
    },
    silent: false,
  });

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
  });

  serverProcess.on("exit", (code) => {
    console.log("Server process exited with code:", code);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 800,
    minHeight: 580,
    title: "BidWar Local",
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const rendererPath = path.join(__dirname, "../renderer/index.html");
  mainWindow.loadFile(rendererPath);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", () => {
  startServer();
  setTimeout(createWindow, 1000);
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

ipcMain.handle("get-local-ip", () => getLocalIP());
ipcMain.handle("get-server-port", () => SERVER_PORT);
ipcMain.handle("get-db-path", () => DB_PATH);
ipcMain.handle("open-external", (_evt, url: string) => shell.openExternal(url));
ipcMain.handle("open-browser", (_evt, path: string) => {
  const ip = getLocalIP();
  shell.openExternal(`http://${ip}:${SERVER_PORT}${path}`);
});
