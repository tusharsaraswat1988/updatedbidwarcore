import { ensureChromeRunning } from "./test-chrome";

class CdpConnection {
  private ws: WebSocket;
  private idCounter = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private listeners = new Map<string, Array<(params: any) => void>>();

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

async function test() {
  const browserWsUrl = await ensureChromeRunning();
  console.log("Connecting to browser ws:", browserWsUrl);
  const conn = new CdpConnection(browserWsUrl);
  await conn.ready();

  const version = await conn.send("Browser.getVersion");
  console.log("Browser version:", version);

  const { browserContextId } = await conn.send("Target.createBrowserContext");
  console.log("Created browser context:", browserContextId);

  const { targetId } = await conn.send("Target.createTarget", {
    url: "http://127.0.0.1:5174/api/healthz",
    browserContextId,
  });
  console.log("Created target:", targetId);

  const { sessionId } = await conn.send("Target.attachToTarget", { targetId, flatten: true });
  console.log("Attached with sessionId:", sessionId);

  await conn.send("Page.enable", {}, sessionId);
  await conn.send("Runtime.enable", {}, sessionId);

  const evalResult = await conn.send(
    "Runtime.evaluate",
    { expression: "document.body.innerText" },
    sessionId
  );
  console.log("Page innerText:", evalResult.result.value);

  await conn.send("Target.closeTarget", { targetId });
  await conn.send("Target.disposeBrowserContext", { browserContextId });
  conn.close();
  console.log("CDP test completed successfully!");
}

test().catch(console.error);
