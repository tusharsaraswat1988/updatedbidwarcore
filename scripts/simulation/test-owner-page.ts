import fs from "node:fs";
import path from "node:path";
import { ensureChromeRunning } from "./test-chrome";

class CdpConnection {
  private ws: WebSocket;
  private idCounter = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  public listeners = new Map<string, Array<(params: any) => void>>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => this.handleMessage(event.data.toString());
    });
  }

  private handleMessage(dataStr: string) {
    try {
      const msg = JSON.parse(dataStr);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        const cbs = this.listeners.get(msg.method) || [];
        for (const cb of cbs) cb(msg.params);
      }
    } catch (e) {
      console.error("Failed to parse CDP message:", e);
    }
  }

  send(method: string, params: any = {}, sessionId?: string): Promise<any> {
    const id = this.idCounter++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload: any = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }

  on(method: string, cb: (params: any) => void) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method)!.push(cb);
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testOwnerPage() {
  const wsUrl = await ensureChromeRunning();
  const conn = new CdpConnection(wsUrl);
  await conn.ready();

  const { browserContextId } = await conn.send("Target.createBrowserContext");
  const { targetId } = await conn.send("Target.createTarget", {
    url: "about:blank",
    browserContextId,
  });
  const { sessionId } = await conn.send("Target.attachToTarget", { targetId, flatten: true });

  await conn.send("Page.enable", {}, sessionId);
  await conn.send("Runtime.enable", {}, sessionId);
  await conn.send("DOM.enable", {}, sessionId);

  console.log("Navigating to owner page for Team 79...");
  await conn.send(
    "Page.navigate",
    { url: "http://127.0.0.1:5174/owner-app/tournament/18/owner/79" },
    sessionId
  );

  // Wait for page load
  await sleep(2000);

  // Evaluate page title and text
  let bodyText = "";
  for (let i = 0; i < 15; i++) {
    const res = await conn.send(
      "Runtime.evaluate",
      {
        expression: `({
          title: document.title,
          text: document.body.innerText,
          hasInput: !!document.querySelector('input[placeholder="ACCESS CODE"]'),
          inputVal: document.querySelector('input[placeholder="ACCESS CODE"]')?.value
        })`,
        returnByValue: true,
      },
      sessionId
    );
    console.log(`Poll ${i}:`, res.result.value);
    if (res.result.value.hasInput) {
      break;
    }
    await sleep(1000);
  }

  // Type access code SIMT01 using React-compliant property setter
  console.log("Typing access code SIMT01 via React setter...");
  const typeResult = await conn.send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const input = document.querySelector('input[placeholder="ACCESS CODE"]');
        if (!input) return { ok: false, error: "Input not found" };
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (!setter) return { ok: false, error: "Setter not found" };
        setter.call(input, "SIMT01");
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const btn = document.querySelector('button[type="submit"]');
        if (!btn) return { ok: false, error: "Submit button not found" };
        const wasDisabled = btn.disabled;
        btn.click();
        return { ok: true, inputVal: input.value, wasDisabled };
      })()`,
      returnByValue: true,
    },
    sessionId
  );
  console.log("Type result:", typeResult.result.value);

  console.log("Submitted code. Waiting for warmup and LiveBid mount...");
  for (let i = 0; i < 15; i++) {
    const res = await conn.send(
      "Runtime.evaluate",
      {
        expression: `({
          text: document.body.innerText.slice(0, 300),
          hasBidBtn: !!document.querySelector('button[key="bid-btn"], button') && Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('BID')),
          isWaiting: document.body.innerText.includes('Waiting for next player') || document.body.innerText.includes('Waiting for auction to start'),
          isLiveBid: !!document.querySelector('.h-full') && (document.body.innerText.includes('PURSE') || document.body.innerText.includes('SLOTS'))
        })`,
        returnByValue: true,
      },
      sessionId
    );
    console.log(`LiveBid Poll ${i}:`, res.result.value);
    if (res.result.value.isWaiting || res.result.value.isLiveBid || res.result.value.hasBidBtn) {
      console.log("LiveBid mounted!");
      break;
    }
    await sleep(1000);
  }

  const screenshotsDir = "C:\\Users\\win 10\\updatedbidwarcore\\artifacts\\simulation-screenshots";
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const shot = await conn.send("Page.captureScreenshot", { format: "png" }, sessionId);
  const shotPath = path.join(screenshotsDir, "test_team69.png");
  fs.writeFileSync(shotPath, Buffer.from(shot.data, "base64"));
  console.log("Saved test screenshot to:", shotPath);

  await conn.send("Target.closeTarget", { targetId });
  await conn.send("Target.disposeBrowserContext", { browserContextId });
  conn.close();
}

testOwnerPage().catch(console.error);
