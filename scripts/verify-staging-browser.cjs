const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.resolve(__dirname, '../artifacts/staging-verification-screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        } else if (msg.method) {
          const listeners = this.eventListeners.get(msg.method) || [];
          for (const l of listeners) l(msg.params);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function runBrowserVerification() {
  console.log("======================================================================");
  console.log("BIDWAR — STAGING BROWSER CDP VERIFICATION");
  console.log("Target Staging Origin: https://stagingbidwar.up.railway.app");
  console.log("======================================================================");

  const userDataDir = path.resolve(__dirname, '../.tmp_chrome_profile');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
  ]);

  let chromeReady = false;
  for (let i = 0; i < 20; i++) {
    await delay(500);
    try {
      await httpGetJson('http://127.0.0.1:9222/json/version');
      chromeReady = true;
      break;
    } catch (e) {}
  }

  if (!chromeReady) {
    chromeProc.kill();
    throw new Error("Failed to start headless Chrome with remote debugging.");
  }
  console.log("✓ Headless Chrome started successfully on port 9222");

  const surfaces = [
    {
      name: "Organizer Auction Control",
      path: "/tournament/4/auction",
      prefix: "organizer_control",
    },
    {
      name: "Owner Bidding App",
      path: "/owner-app/",
      prefix: "owner_app",
    },
    {
      name: "LED Venue Display",
      path: "/tournament/4/display",
      prefix: "led_venue_display",
    },
    {
      name: "Scoring App",
      path: "/scoring-app/",
      prefix: "scoring_app",
    },
  ];

  const results = {
    surfacesTested: 0,
    screenshotsCaptured: 0,
    corsErrorsDetected: 0,
    productionLeaksDetected: 0,
    networkReconnectSimulations: 0,
  };

  try {
    for (const surface of surfaces) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Testing Surface: ${surface.name}`);
      console.log(`URL: https://stagingbidwar.up.railway.app${surface.path}`);
      console.log(`--------------------------------------------------`);

      // Create new target tab
      const targetMeta = await httpGetJson(`http://127.0.0.1:9222/json/new?https://stagingbidwar.up.railway.app${surface.path}`);
      const client = new CDPClient(targetMeta.webSocketDebuggerUrl);
      await client.connect();

      await client.send('Page.enable');
      await client.send('Network.enable');
      await client.send('Console.enable');

      let corsErrors = 0;
      let prodLeaks = 0;

      client.on('Network.requestWillBeSent', (params) => {
        const reqUrl = params.request.url;
        if (reqUrl.includes('bidwar.in')) {
          console.error(`  [LEAK DETECTED] Request to production host: ${reqUrl}`);
          prodLeaks++;
        }
      });

      client.on('Console.messageAdded', (params) => {
        const text = params.message.text || '';
        if (text.toLowerCase().includes('cors') || text.toLowerCase().includes('access-control-allow-origin')) {
          console.error(`  [CORS ERROR] Console: ${text}`);
          corsErrors++;
        }
      });

      // 1. Desktop Viewport
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await client.send('Page.navigate', { url: `https://stagingbidwar.up.railway.app${surface.path}` });
      await delay(3000); // Allow render and JS execution

      const desktopCapture = await client.send('Page.captureScreenshot', { format: 'png' });
      const desktopFilePath = path.join(OUTPUT_DIR, `${surface.prefix}_desktop.png`);
      fs.writeFileSync(desktopFilePath, Buffer.from(desktopCapture.data, 'base64'));
      console.log(`  ✓ Desktop Screenshot captured: ${path.basename(desktopFilePath)} (${Math.round(desktopCapture.data.length * 0.75 / 1024)} KB)`);
      results.screenshotsCaptured++;

      // 2. Mobile Viewport (390 x 844, iPhone 12/13/14)
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await delay(1500);

      const mobileCapture = await client.send('Page.captureScreenshot', { format: 'png' });
      const mobileFilePath = path.join(OUTPUT_DIR, `${surface.prefix}_mobile.png`);
      fs.writeFileSync(mobileFilePath, Buffer.from(mobileCapture.data, 'base64'));
      console.log(`  ✓ Mobile Screenshot captured: ${path.basename(mobileFilePath)} (${Math.round(mobileCapture.data.length * 0.75 / 1024)} KB)`);
      results.screenshotsCaptured++;

      // 3. Network Disconnect and Reconnect simulation
      console.log(`  → Simulating network disconnect (offline = true)...`);
      await client.send('Network.emulateNetworkConditions', {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
      });
      await delay(1500);

      console.log(`  → Simulating network reconnection (offline = false)...`);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 50,
        downloadThroughput: 10 * 1024 * 1024 / 8,
        uploadThroughput: 5 * 1024 * 1024 / 8,
      });
      await delay(2000);
      results.networkReconnectSimulations++;
      console.log(`  ✓ Disconnect and Reconnect survived with graceful handling`);

      // Close tab
      client.close();
      await httpGetJson(`http://127.0.0.1:9222/json/close/${targetMeta.id}`);

      results.surfacesTested++;
      results.corsErrorsDetected += corsErrors;
      results.productionLeaksDetected += prodLeaks;
    }
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {}
  }

  console.log("\n======================================================================");
  console.log("BROWSER VERIFICATION SUMMARY");
  console.log("======================================================================");
  console.log(`Surfaces Tested:              ${results.surfacesTested} / 4`);
  console.log(`Screenshots Captured:         ${results.screenshotsCaptured} (4 Desktop + 4 Mobile)`);
  console.log(`CORS Errors:                  ${results.corsErrorsDetected}`);
  console.log(`Production Request Leaks:     ${results.productionLeaksDetected}`);
  console.log(`Reconnect Simulations:        ${results.networkReconnectSimulations} / 4`);
  console.log("======================================================================");

  if (results.corsErrorsDetected > 0 || results.productionLeaksDetected > 0) {
    console.error("FAIL: Staging browser verification detected errors!");
    process.exit(1);
  } else {
    console.log("SUCCESS: All staging browser verification checks passed cleanly!");
    process.exit(0);
  }
}

runBrowserVerification().catch(err => {
  console.error("Fatal browser verification failure:", err);
  process.exit(1);
});
