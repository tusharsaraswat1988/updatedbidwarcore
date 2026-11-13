const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Load root env
require('./load-root-env.cjs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUTPUT_DIR = path.resolve(__dirname, '../artifacts/admin-theme-verification-screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFreePort(preferred = 9338) {
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
          if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else cb.resolve(msg.result);
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
  console.log("BIDWAR — SUPER ADMIN DESIGN SYSTEM AUDIT & CDP VERIFICATION");
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

  const cdpPort = await getFreePort(9339);
  const userDataDir = path.join(os.tmpdir(), `chrome_admin_theme_audit_${Date.now()}`);
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
    // 1. Core Super Admin Dashboard Viewports
    {
      name: "01_Admin_Dashboard_Desktop",
      url: "http://localhost:24755/admin",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "02_Admin_Dashboard_Tablet",
      url: "http://localhost:24755/admin",
      viewport: { width: 768, height: 1024, isMobile: true },
      expectedMode: "admin-dark",
    },
    {
      name: "03_Admin_Dashboard_Mobile",
      url: "http://localhost:24755/admin",
      viewport: { width: 375, height: 812, isMobile: true },
      expectedMode: "admin-dark",
    },

    // 2. Tournament & Organiser Management
    {
      name: "04_Admin_Tournaments_List",
      url: "http://localhost:24755/admin/tournaments",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "05_Admin_Tournament_Detail",
      url: "http://localhost:24755/admin/tournaments/1",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "06_Admin_Organisers_List",
      url: "http://localhost:24755/admin/organisers",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "07_Admin_Organiser_Detail",
      url: "http://localhost:24755/admin/organisers/1",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },

    // 3. Operations & Broadcast
    {
      name: "08_Admin_Live_Operations",
      url: "http://localhost:24755/admin/live/auctions",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "09_Admin_Events_Activities",
      url: "http://localhost:24755/admin/events-activities",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "10_Admin_BPL_Editions",
      url: "http://localhost:24755/admin/bpl",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "11_Admin_Sports_Specs",
      url: "http://localhost:24755/admin/tournaments/sports",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },

    // 4. Platform Hubs & Settings
    {
      name: "12_Admin_Communication_Center",
      url: "http://localhost:24755/admin/communication",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "13_Admin_Reports",
      url: "http://localhost:24755/admin/settings/reports",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "14_Admin_Branding",
      url: "http://localhost:24755/admin/settings/branding",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "15_Admin_AI_Intelligence",
      url: "http://localhost:24755/admin/settings/intelligence",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },
    {
      name: "16_Admin_System_Diagnostics",
      url: "http://localhost:24755/admin/settings/system/diagnostics",
      viewport: { width: 1440, height: 900 },
      expectedMode: "admin-dark",
    },

    // 5. Protected Surfaces Regression Checks (MUST REMAIN INTACT)
    {
      name: "17_Regression_Organizer_Portal_Light",
      url: "http://localhost:24755/organizer",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "18_Regression_Tournament_Players_Light",
      url: "http://localhost:24755/tournament/1/players",
      viewport: { width: 1440, height: 900 },
      expectedMode: "light",
    },
    {
      name: "19_Regression_Auction_Panel_Dark",
      url: "http://localhost:24755/tournament/1/auction",
      viewport: { width: 1440, height: 900 },
      expectedMode: "dark",
    },
  ];

  const results = [];

  for (const tc of testCases) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`Testing: ${tc.name}`);
    console.log(`URL: ${tc.url} | Expected Mode: ${tc.expectedMode.toUpperCase()}`);
    console.log(`----------------------------------------------------------------------`);

    let client = null;
    try {
      const newTab = await httpPutJson(`http://127.0.0.1:${cdpPort}/json/new`);
      client = new CDPClient(newTab.webSocketDebuggerUrl);
      await client.connect();

      await client.send('Page.enable');
      await client.send('DOM.enable');
      await client.send('CSS.enable');
      await client.send('Runtime.enable');
      await client.send('Network.enable');

      // Set auth cookie
      await client.send('Network.setCookies', {
        cookies: [
          {
            name: 'bidwar_auth',
            value: token,
            url: 'http://localhost:24755',
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
          }
        ]
      });

      // Set viewport
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: tc.viewport.width,
        height: tc.viewport.height,
        deviceScaleFactor: 1,
        mobile: !!tc.viewport.isMobile,
      });

      // Navigate
      await client.send('Page.navigate', { url: tc.url });
      await delay(2500); // Wait for React hydration and queries

      // Evaluate styles and contrast
      const auditResult = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            function parseRgb(colorStr) {
              if (!colorStr) return [0, 0, 0];
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

            const isAdminDark = document.documentElement.classList.contains('bw-admin-dark') ||
                                document.body.classList.contains('bw-admin-dark') ||
                                document.querySelector('.bw-admin-dark, [data-surface="admin"]') !== null;

            const cards = document.querySelectorAll('[data-slot="card"], .card, [class*="bg-card"], .rounded-xl');
            const sidebar = document.querySelector('aside, nav');
            const sidebarLinks = document.querySelectorAll('aside a, nav a');
            const buttons = document.querySelectorAll('button, [data-slot="button"]');
            const inputs = document.querySelectorAll('input, select, textarea');

            function getSample(el) {
              if (!el) return null;
              const s = window.getComputedStyle(el);
              return {
                bg: s.backgroundColor,
                color: s.color,
                borderColor: s.borderColor,
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
                text: el.innerText ? el.innerText.trim().slice(0, 30) : ""
              };
            }

            const bodyBgRgb = parseRgb(bodyStyle.backgroundColor);
            const bodyColorRgb = parseRgb(bodyStyle.color);
            const bodyContrast = getContrast(bodyBgRgb, bodyColorRgb);

            let sidebarContrast = null;
            if (sidebarLinks.length > 0) {
              const sStyle = window.getComputedStyle(sidebarLinks[0]);
              const pStyle = window.getComputedStyle(sidebar || document.body);
              sidebarContrast = getContrast(parseRgb(pStyle.backgroundColor || "rgb(11, 17, 32)"), parseRgb(sStyle.color));
            }

            let cardContrast = null;
            if (cards.length > 0) {
              const cardStyle = window.getComputedStyle(cards[0]);
              cardContrast = getContrast(parseRgb(cardStyle.backgroundColor || "rgb(17, 24, 39)"), parseRgb(cardStyle.color));
            }

            return {
              documentTitle: document.title,
              currentPath: window.location.pathname,
              isLightDom,
              isAdminDark,
              body: {
                bg: bodyStyle.backgroundColor,
                color: bodyStyle.color,
                contrastRatio: bodyContrast + ":1"
              },
              cardsCount: cards.length,
              sampleCard: getSample(cards[0]),
              cardContrastRatio: cardContrast ? cardContrast + ":1" : null,
              sidebarLinksCount: sidebarLinks.length,
              sampleSidebarLink: getSample(sidebarLinks[0]),
              sidebarContrastRatio: sidebarContrast ? sidebarContrast + ":1" : null,
              buttonsCount: buttons.length,
              sampleButton: getSample(buttons[0]),
              inputsCount: inputs.length,
              sampleInput: getSample(inputs[0]),
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
      console.log(`  ✓ Surface mode: isLightDom = ${val.isLightDom} | isAdminDark = ${val.isAdminDark}`);
      console.log(`  ✓ Body bg: ${val.body.bg} | Body text: ${val.body.color} (Contrast: ${val.body.contrastRatio})`);
      if (val.sampleCard) {
        console.log(`  ✓ Card count: ${val.cardsCount} | bg: ${val.sampleCard.bg} | text: ${val.sampleCard.color} (Contrast: ${val.cardContrastRatio})`);
      }
      if (val.sampleSidebarLink) {
        console.log(`  ✓ Sidebar links: ${val.sidebarLinksCount} | text: "${val.sampleSidebarLink.text}" | color: ${val.sampleSidebarLink.color} (Contrast: ${val.sidebarContrastRatio})`);
      }
      if (val.sampleInput) {
        console.log(`  ✓ Inputs: ${val.inputsCount} | bg: ${val.sampleInput.bg} | border: ${val.sampleInput.borderColor}`);
      }
      console.log(`  ✓ Horizontal overflow: ${val.hasHorizontalOverflow ? "YES (WARNING)" : "NO (OK)"}`);

      let passed = true;
      if (tc.expectedMode === "admin-dark") {
        if (!val.isAdminDark) {
          console.error(`  ✗ FAIL: Expected Super Admin Dark surface, but isAdminDark is false.`);
          passed = false;
        }
        if (val.isLightDom) {
          console.error(`  ✗ FAIL: Expected Admin Dark, but light organizer DOM is active!`);
          passed = false;
        }
      } else if (tc.expectedMode === "light") {
        if (!val.isLightDom) {
          console.error(`  ✗ FAIL: Expected Light surface for organizer regression, but isLightDom is false.`);
          passed = false;
        }
      } else if (tc.expectedMode === "dark") {
        if (val.isLightDom) {
          console.error(`  ✗ FAIL: Expected dark surface, but light organizer DOM is active.`);
          passed = false;
        }
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
      if (newTab && newTab.id) {
        try { await httpGetJson(`http://127.0.0.1:${cdpPort}/json/close/${newTab.id}`); } catch (e) {}
      }
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
      if (newTab && newTab.id) {
        try { await httpGetJson(`http://127.0.0.1:${cdpPort}/json/close/${newTab.id}`); } catch (e) {}
      }
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
  console.log(`Super Admin Verification completed! Summary saved to:`);
  console.log(`  ${summaryPath}`);
  console.log(`Passed: ${results.filter(r => r.status === "PASS").length} / ${results.length}`);
  console.log("======================================================================");
}

runVerification().catch(err => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
