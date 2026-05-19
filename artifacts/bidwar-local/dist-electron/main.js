"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 3741;
const DATA_DIR = path_1.default.join(electron_1.app.getPath("userData"), "bidwar-data");
const DB_PATH = path_1.default.join(DATA_DIR, "auction.db");
function getLocalIP() {
    const interfaces = os_1.default.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        if (!iface)
            continue;
        for (const addr of iface) {
            if (addr.family === "IPv4" && !addr.internal) {
                return addr.address;
            }
        }
    }
    return "127.0.0.1";
}
function startServer() {
    if (!fs_1.default.existsSync(DATA_DIR))
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    const serverScript = path_1.default.join(__dirname, "../dist-server/index.js");
    serverProcess = (0, child_process_1.fork)(serverScript, [], {
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
    mainWindow = new electron_1.BrowserWindow({
        width: 900,
        height: 640,
        minWidth: 800,
        minHeight: 580,
        title: "BidWar Local",
        backgroundColor: "#09090b",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    const rendererPath = path_1.default.join(__dirname, "../renderer/index.html");
    mainWindow.loadFile(rendererPath);
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
electron_1.app.on("ready", () => {
    startServer();
    setTimeout(createWindow, 1000);
});
electron_1.app.on("window-all-closed", () => {
    if (serverProcess)
        serverProcess.kill();
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("activate", () => {
    if (mainWindow === null)
        createWindow();
});
electron_1.ipcMain.handle("get-local-ip", () => getLocalIP());
electron_1.ipcMain.handle("get-server-port", () => SERVER_PORT);
electron_1.ipcMain.handle("get-db-path", () => DB_PATH);
electron_1.ipcMain.handle("open-external", (_evt, url) => electron_1.shell.openExternal(url));
electron_1.ipcMain.handle("open-browser", (_evt, path) => {
    const ip = getLocalIP();
    electron_1.shell.openExternal(`http://${ip}:${SERVER_PORT}${path}`);
});
