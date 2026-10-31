import http from "node:http";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE_DIR = "C:\\Users\\win 10\\updatedbidwarcore\\artifacts\\chrome-profile-9333";
const DEBUG_PORT = 9333;

export async function ensureChromeRunning(): Promise<string> {
  // Check if Chrome is already running on port 9333
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (res.ok) {
      const data = await res.json();
      console.log("[Chrome] Already running. WebSocket Debugger URL:", data.webSocketDebuggerUrl);
      return data.webSocketDebuggerUrl;
    }
  } catch {
    // Not running
  }

  console.log("[Chrome] Spawning Chrome on port 9333...");
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${PROFILE_DIR}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--window-size=1280,800",
  ];

  const child = cp.spawn(CHROME_PATH, args, {
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  // Poll for availability
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        console.log("[Chrome] Spawned successfully. WebSocket Debugger URL:", data.webSocketDebuggerUrl);
        return data.webSocketDebuggerUrl;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw new Error("Timed out waiting for Chrome on port 9333");
}

if (process.argv[1] && process.argv[1].includes("test-chrome")) {
  ensureChromeRunning().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
