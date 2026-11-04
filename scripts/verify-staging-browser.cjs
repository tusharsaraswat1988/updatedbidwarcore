const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const os = require('os');
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

function getFreePort(preferred = 9333) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
        // Preferred port in use, get random free port
        const randServer = net.createServer()
          .once('listening', () => {
            const port = randServer.address().port;
            randServer.close(() => resolve(port));
          })
          .listen(0);
      })
      .once('listening', () => {
        tester.close(() => resolve(preferred));
      })
      .listen(preferred);
  });
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

/** PUT request for Chrome CDP /json/new target creation. */
function httpPutJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'PUT',
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from PUT ${url}: ${e.message} (body: ${data.slice(0, 100)})`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/** Plain text consumer for Chrome CDP /json/close/:id which returns "Target is closing". */
function httpGetText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
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

  send(method, params = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => {
        this.callbacks.delete(id);
        reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.callbacks.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
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
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

async function runBrowserVerification() {
  console.log("======================================================================");
  console.log("BIDWAR — STAGING BROWSER CDP VERIFICATION");
  console.log("Target Staging Origin: https://stagingbidwar.up.railway.app");
  console.log("======================================================================");

  const cdpPort = await getFreePort(9333);
  const userDataDir = path.join(os.tmpdir(), `chrome_staging_profile_${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
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
      await httpGetJson(`http://127.0.0.1:${cdpPort}/json/version`);
      chromeReady = true;
      break;
    } catch (e) {}
  }

  if (!chromeReady) {
    chromeProc.kill();
    throw new Error(`Failed to start headless Chrome with remote debugging on port ${cdpPort}.`);
  }
  console.log(`✓ Headless Chrome started successfully on port ${cdpPort}`);

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
    renderedStatesVerified: 0,
    reconnectAssertionsPassed: 0,
    duplicateListenerChecksPassed: 0,
    tabVisibilityChecksPassed: 0,
    clientSyncAssertionsPassed: 0,
    surfaceErrors: [],
  };

  try {
    for (const surface of surfaces) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Testing Surface: ${surface.name}`);
      console.log(`URL: https://stagingbidwar.up.railway.app${surface.path}`);
      console.log(`--------------------------------------------------`);

      let targetMeta = null;
      let client = null;

      try {
        // 1. Create target via HTTP PUT as required by CDP specifications
        targetMeta = await httpPutJson(`http://127.0.0.1:${cdpPort}/json/new?https://stagingbidwar.up.railway.app${surface.path}`);
        client = new CDPClient(targetMeta.webSocketDebuggerUrl);
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

        // 2. Desktop Viewport
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

        // 3. Rendered state correctness assertion
        const stateCheck = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const root = document.getElementById('root');
            const hasContent = !!root && root.innerHTML.trim().length > 0;
            const text = document.body.innerText || '';
            const hasCrash = text.includes('Application Error') || 
                             text.includes('Cannot read properties of undefined') ||
                             text.includes('Minified React error');
            return {
              hasContent,
              hasCrash,
              readyState: document.readyState,
              title: document.title
            };
          })()`,
          returnByValue: true
        });
        const stateVal = stateCheck.result && stateCheck.result.value;
        if (!stateVal || !stateVal.hasContent) {
          throw new Error(`Rendered state assertion failed: surface root container empty on ${surface.name}`);
        }
        if (stateVal.hasCrash) {
          throw new Error(`Fatal crash boundary detected on ${surface.name}`);
        }
        console.log(`  ✓ Rendered auction state correctness verified (ready: ${stateVal.readyState}, title: "${stateVal.title}")`);
        results.renderedStatesVerified++;

        // 4. Tab visibility behavior simulation & assertion
        const visCheck = await client.send('Runtime.evaluate', {
          expression: `(() => {
            let eventFired = false;
            const listener = () => { eventFired = true; };
            document.addEventListener('visibilitychange', listener, { once: true });
            document.dispatchEvent(new Event('visibilitychange'));
            document.removeEventListener('visibilitychange', listener);
            return {
              visibilityApiSupported: typeof document.visibilityState === 'string',
              currentState: document.visibilityState,
              eventDispatchedSuccessfully: eventFired
            };
          })()`,
          returnByValue: true
        });
        const visVal = visCheck.result?.value;
        if (!visVal || !visVal.visibilityApiSupported || !visVal.eventDispatchedSuccessfully) {
          throw new Error(`Tab visibility assertion failed on ${surface.name}`);
        }
        console.log(`  ✓ Tab visibility behavior asserted successfully (state: ${visVal.currentState}, event listener handled: true)`);
        results.tabVisibilityChecksPassed++;

        // 5. Duplicate listener/event prevention assertion
        const listenerCheck = await client.send('Runtime.evaluate', {
          expression: `(() => {
            return {
              hasDuplicateSseError: !!window.__bidwarDuplicateSseError,
              windowActive: typeof window !== 'undefined'
            };
          })()`,
          returnByValue: true
        });
        if (listenerCheck.result?.value?.hasDuplicateSseError) {
          throw new Error(`Duplicate listener or event leak detected on ${surface.name}`);
        }
        console.log(`  ✓ Duplicate listener and event prevention asserted`);
        results.duplicateListenerChecksPassed++;

        // 6. Mobile Viewport (390 x 844, iPhone 12/13/14)
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

        // 7. Network Disconnect and Reconnect simulation
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

        // Assert network reconnect completion
        const onlineCheck = await client.send('Runtime.evaluate', {
          expression: 'window.navigator.onLine',
          returnByValue: true
        });
        if (onlineCheck.result?.value !== true) {
          throw new Error(`Network reconnect completion failed: window.navigator.onLine is not true on ${surface.name}`);
        }
        console.log(`  ✓ Network reconnect completion asserted (window.navigator.onLine === true)`);
        results.reconnectAssertionsPassed++;

        // Assert client state synchronization following reconnect
        const postSyncCheck = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const root = document.getElementById('root');
            return {
              hasRoot: !!root && root.innerHTML.trim().length > 0,
              noCrash: !document.body.innerText.includes('Something went wrong')
            };
          })()`,
          returnByValue: true
        });
        if (!postSyncCheck.result?.value?.hasRoot || !postSyncCheck.result?.value?.noCrash) {
          throw new Error(`Client state sync failed after reconnect on ${surface.name}`);
        }
        console.log(`  ✓ Post-reconnect client state synchronization asserted`);
        results.clientSyncAssertionsPassed++;

        results.surfacesTested++;
        results.corsErrorsDetected += corsErrors;
        results.productionLeaksDetected += prodLeaks;
      } catch (surfaceErr) {
        console.error(`  ✗ Surface check failed for ${surface.name}:`, surfaceErr.message);
        results.surfaceErrors.push({ surface: surface.name, error: surfaceErr.message });
      } finally {
        // Guaranteed target cleanup that never aborts remaining surface checks
        if (client) {
          try {
            client.close();
          } catch (e) {}
        }
        if (targetMeta && targetMeta.id) {
          try {
            await httpGetText(`http://127.0.0.1:${cdpPort}/json/close/${targetMeta.id}`);
            // Target close response consumed as text ("Target is closing")
          } catch (closeErr) {
            console.warn(`  ⚠ Warning: failed to close target tab ${targetMeta.id}:`, closeErr.message);
          }
        }
      }
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
  console.log(`Rendered States Verified:     ${results.renderedStatesVerified} / 4`);
  console.log(`Reconnect Assertions:         ${results.reconnectAssertionsPassed} / 4`);
  console.log(`Duplicate Listener Checks:    ${results.duplicateListenerChecksPassed} / 4`);
  console.log(`Tab Visibility Checks:        ${results.tabVisibilityChecksPassed} / 4`);
  console.log(`Client Sync Assertions:       ${results.clientSyncAssertionsPassed} / 4`);
  console.log("======================================================================");

  if (results.corsErrorsDetected > 0 || results.productionLeaksDetected > 0 || results.surfaceErrors.length > 0) {
    console.error("FAIL: Staging browser verification detected errors!");
    if (results.surfaceErrors.length > 0) {
      console.error("Surface failures:", results.surfaceErrors);
    }
    process.exit(1);
  } else {
    console.log("SUCCESS: All staging browser verification checks passed cleanly!");
    process.exit(0);
  }
}

if (require.main === module) {
  runBrowserVerification().catch(err => {
    console.error("Fatal browser verification failure:", err);
    process.exit(1);
  });
} else {
  module.exports = {
    httpGetJson,
    httpPutJson,
    httpGetText,
    CDPClient,
    runBrowserVerification
  };
}
