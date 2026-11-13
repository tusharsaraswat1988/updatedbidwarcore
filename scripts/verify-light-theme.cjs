const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Load root env
require('./load-root-env.cjs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.resolve(__dirname, '../artifacts/light-theme-verification-screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort(preferred = 9336) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => {
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
            reject(new Error(`Failed to parse JSON from PUT ${url}: ${e.message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
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

  send(method, params = {}, timeoutMs = 20000) {
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

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}

async function runVerification() {
  console.log("======================================================================");
  console.log("BIDWAR — P0 LIGHT DESIGN SYSTEM AUTOMATED CDP VERIFICATION");
  console.log("======================================================================");

  // 1. Generate auth JWT token
  const jwt = require('../artifacts/api-server/node_modules/jsonwebtoken');
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing SESSION_SECRET in environment");
  }

  const token = jwt.sign({
    isAdmin: true,
    adminLevel: "master",
    organizerAccountId: 1,
    organizer: { "1": true, "4": true, "6": true, "10": true }
  }, secret, { expiresIn: '7d' });

  console.log("✓ Generated valid master admin & organizer auth token");

  const cdpPort = await getFreePort(9337);
  const userDataDir = path.join(os.tmpdir(), `chrome_light_theme_audit_${Date.now()}`);
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
    throw new Error(`Failed to start headless Chrome on port ${cdpPort}`);
  }
  console.log(`✓ Headless Chrome started on port ${cdpPort}`);

  const testCases = [
    {
      name: "01_Organizer_Portal_Desktop",
      url: "http://localhost:24755/organizer",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "02_Organizer_Portal_Mobile",
      url: "http://localhost:24755/organizer",
      viewport: { width: 375, height: 812, isMobile: true },
      expectedMode: "light",
    },
    {
      name: "03_Auction_Overview",
      url: "http://localhost:24755/tournament/1/auction-overview",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "04_Tournament_Players_Table",
      url: "http://localhost:24755/tournament/1/players",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "05_Tournament_Categories",
      url: "http://localhost:24755/tournament/1/categories",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "06_Tournament_Settings_Form",
      url: "http://localhost:24755/tournament/1/settings",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "07_Tournament_Reports_Center",
      url: "http://localhost:24755/tournament/1/reports",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "08_Tournament_Links",
      url: "http://localhost:24755/tournament/1/links",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "09_Tournament_Teams_Grid",
      url: "http://localhost:24755/tournament/1/teams",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "10_Badminton_Scoring_Hub",
      url: "http://localhost:5175/scoring-app/tournament/1/badminton",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "11_Cricket_Scoring_Dashboard",
      url: "http://localhost:5175/scoring-app/tournament/4/score",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "12_Cricket_Tournament_Standings",
      url: "http://localhost:5175/scoring-app/tournament/4/score/standings",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "13_Protected_Auction_Panel_Excluded",
      url: "http://localhost:24755/tournament/1/auction",
      viewport: { width: 1440, height: 900 },
      expectedMode: "dark", // MUST remain dark!
    },
    {
      name: "14_Protected_OBS_Overlay_Excluded",
      url: "http://localhost:24755/tournament/1/obs/v2/preview",
      viewport: { width: 1440, height: 900 },
      expectedMode: "dark", // MUST remain dark!
    }
  ];

  const results = [];

  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`Testing: ${tc.name}`);
    console.log(`URL: ${tc.url} | Expected Mode: ${tc.expectedMode.toUpperCase()}`);
    console.log(`----------------------------------------------------------------------`);
    let client = null;
    try {
      const targetMeta = await httpPutJson(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(tc.url)}`);
      client = new CDPClient(targetMeta.webSocketDebuggerUrl);
      await client.connect();

      await client.send('Page.enable');
      await client.send('DOM.enable');
      await client.send('CSS.enable');
      await client.send('Runtime.enable');
      await client.send('Network.enable');

      // Set cookie for auth
      const parsedUrl = new URL(tc.url);
      await client.send('Network.setCookie', {
        name: 'bidwar_auth',
        value: token,
        domain: parsedUrl.hostname,
        path: '/',
        httpOnly: true,
        secure: false,
      });

      // Reload to ensure cookie is active
      await client.send('Page.reload');

      // Set viewport
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: tc.viewport.width,
        height: tc.viewport.height,
        deviceScaleFactor: 1,
        mobile: !!tc.viewport.isMobile,
      });

      // Wait for page load and settle
      await delay(4000);

      // Evaluate visual styles & contrast
      const auditResult = await client.send('Runtime.evaluate', {
        expression: `
          (function() {
            function parseRgb(colorStr) {
              const m = colorStr.match(/rgba?\\((\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)/);
              if (m) {
                return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
              }
              return [255, 255, 255];
            }

            function getLuminance(r, g, b) {
              const a = [r, g, b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
              });
              return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
            }

            function getContrast(rgb1, rgb2) {
              const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
              const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
              const brightest = Math.max(lum1, lum2);
              const darkest = Math.min(lum1, lum2);
              return ((brightest + 0.05) / (darkest + 0.05)).toFixed(2);
            }

            const bodyStyle = window.getComputedStyle(document.body);
            const htmlStyle = window.getComputedStyle(document.documentElement);
            const isLightDom = document.documentElement.classList.contains('bw-organizer-light') ||
                               document.body.classList.contains('bw-organizer-light') ||
                               document.querySelector('.bw-organizer-light') !== null;

            const cards = document.querySelectorAll('[data-slot="card"], .card, [class*="bg-card"]');
            const tables = document.querySelectorAll('table, [data-slot="table"]');
            const tableHeaders = document.querySelectorAll('th, [data-slot="table-head"]');
            const tableRows = document.querySelectorAll('tbody tr, [data-slot="table-row"]');
            const inputs = document.querySelectorAll('input, select, textarea, [data-slot="input"]');
            const buttons = document.querySelectorAll('button, [data-slot="button"]');
            const badges = document.querySelectorAll('[data-slot="badge"], .badge');
            const headings = document.querySelectorAll('h1, h2, h3');

            function getSample(el) {
              if (!el) return null;
              const s = window.getComputedStyle(el);
              return {
                bg: s.backgroundColor,
                color: s.color,
                borderColor: s.borderColor,
                borderWidth: s.borderWidth,
                boxShadow: s.boxShadow,
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
                fontFamily: s.fontFamily,
                text: el.innerText ? el.innerText.trim().slice(0, 40) : ""
              };
            }

            const bodyBgRgb = parseRgb(bodyStyle.backgroundColor);
            const bodyColorRgb = parseRgb(bodyStyle.color);
            const bodyContrast = getContrast(bodyBgRgb, bodyColorRgb);

            let headerContrast = null;
            if (tableHeaders.length > 0) {
              const thStyle = window.getComputedStyle(tableHeaders[0]);
              headerContrast = getContrast(parseRgb(thStyle.backgroundColor || "rgb(248, 250, 252)"), parseRgb(thStyle.color));
            }

            let cardContrast = null;
            if (cards.length > 0) {
              const cardStyle = window.getComputedStyle(cards[0]);
              cardContrast = getContrast(parseRgb(cardStyle.backgroundColor || "rgb(255, 255, 255)"), parseRgb(cardStyle.color));
            }

            return {
              documentTitle: document.title,
              isLightDom,
              body: {
                bg: bodyStyle.backgroundColor,
                color: bodyStyle.color,
                fontFamily: bodyStyle.fontFamily,
                contrastRatio: bodyContrast + ":1"
              },
              cardsCount: cards.length,
              sampleCard: getSample(cards[0]),
              cardContrastRatio: cardContrast ? cardContrast + ":1" : null,
              tablesCount: tables.length,
              tableHeadersCount: tableHeaders.length,
              sampleTableHeader: getSample(tableHeaders[0]),
              tableHeaderContrastRatio: headerContrast ? headerContrast + ":1" : null,
              tableRowsCount: tableRows.length,
              sampleTableRow: getSample(tableRows[0]),
              inputsCount: inputs.length,
              sampleInput: getSample(inputs[0]),
              buttonsCount: buttons.length,
              sampleButton: getSample(buttons[0]),
              badgesCount: badges.length,
              sampleBadge: getSample(badges[0]),
              headingsCount: headings.length,
              sampleHeading: getSample(headings[0]),
              hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
            };
          })()
        `,
        returnByValue: true,
      });

      // Capture screenshot
      const ssResult = await client.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });

      const filePath = path.join(OUTPUT_DIR, `${tc.name}.png`);
      fs.writeFileSync(filePath, Buffer.from(ssResult.data, 'base64'));
      const val = auditResult.result.value;

      console.log(`  ✓ Screenshot: ${filePath}`);
      console.log(`  ✓ Document title: "${val.documentTitle}"`);
      console.log(`  ✓ Surface mode: isLightDom = ${val.isLightDom}`);
      console.log(`  ✓ Body bg: ${val.body.bg} | Body text: ${val.body.color} (Contrast: ${val.body.contrastRatio})`);
      if (val.sampleCard) {
        console.log(`  ✓ Card count: ${val.cardsCount} | bg: ${val.sampleCard.bg} | border: ${val.sampleCard.borderColor} (Contrast: ${val.cardContrastRatio})`);
      }
      if (val.sampleTableHeader) {
        console.log(`  ✓ Table headers: ${val.tableHeadersCount} | bg: ${val.sampleTableHeader.bg} | text: ${val.sampleTableHeader.color} (Contrast: ${val.tableHeaderContrastRatio})`);
      }
      if (val.sampleInput) {
        console.log(`  ✓ Input count: ${val.inputsCount} | bg: ${val.sampleInput.bg} | border: ${val.sampleInput.borderColor}`);
      }
      if (val.sampleButton) {
        console.log(`  ✓ Button count: ${val.buttonsCount} | text: "${val.sampleButton.text}" | bg: ${val.sampleButton.bg}`);
      }
      console.log(`  ✓ Horizontal overflow: ${val.hasHorizontalOverflow ? "YES (WARNING)" : "NO (OK)"}`);

      // Verify mode matches expectation
      let passed = true;
      if (tc.expectedMode === "light" && !val.isLightDom) {
        console.error(`  ✗ FAIL: Expected light mode, but DOM is not light.`);
        passed = false;
      }
      if (tc.expectedMode === "dark" && val.isLightDom) {
        console.error(`  ✗ FAIL: Expected dark mode (protected surface), but DOM is light!`);
        passed = false;
      }

      results.push({
        name: tc.name,
        url: tc.url,
        expectedMode: tc.expectedMode,
        passed,
        audit: val,
        screenshot: filePath,
        status: passed ? "PASS" : "FAIL",
      });

      client.close();
    } catch (err) {
      console.error(`  ✗ Error testing ${tc.name}:`, err.message);
      results.push({
        name: tc.name,
        url: tc.url,
        expectedMode: tc.expectedMode,
        error: err.message,
        status: "FAIL",
      });
      if (client) client.close();
    }
  }

  // Cleanup Chrome
  chromeProc.kill();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch (e) {}

  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log("\n======================================================================");
  console.log(`Verification completed! Summary saved to:`);
  console.log(`  ${summaryPath}`);
  console.log(`Passed: ${results.filter(r => r.status === "PASS").length} / ${results.length}`);
  console.log("======================================================================");
}

runVerification().catch(err => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
