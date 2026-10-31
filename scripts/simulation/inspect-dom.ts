import { ensureChromeRunning } from "./test-chrome";

async function inspectDOM() {
  const loginRes = await fetch("http://127.0.0.1:8081/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "Detailing@2026" }),
  });
  const parts = (loginRes.headers.get("set-cookie") || "").split(/,\s*/);
  let validToken = "";
  for (const p of parts) {
    const m = p.match(/bidwar_auth=([^;]+)/);
    if (m && m[1]) validToken = m[1];
  }
  const cookieHeader = `bidwar_auth=${validToken}`;

  // Check state
  const stateRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction");
  const state = await stateRes.json();
  console.log("Current state:", {
    currentPlayer: state.currentPlayer?.name,
    status: state.status,
    ownerBiddingEnabled: state.ownerBiddingEnabled,
  });

  const wsUrl = await ensureChromeRunning();
  const conn = new WebSocket(wsUrl);
  await new Promise((r) => (conn.onopen = r));

  let idCounter = 1;
  const send = (method: string, params: any = {}, sessionId?: string): Promise<any> => {
    const id = idCounter++;
    return new Promise((resolve) => {
      const handler = (e: any) => {
        const msg = JSON.parse(e.data.toString());
        if (msg.id === id) {
          conn.removeEventListener("message", handler);
          resolve(msg.result);
        }
      };
      conn.addEventListener("message", handler);
      conn.send(JSON.stringify({ id, method, params, sessionId }));
    });
  };

  // Create context and target
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", {
    url: "http://127.0.0.1:5174/owner-app/tournament/18/owner/79",
    browserContextId,
  });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  // Poll for buttons
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button')).map(b => ({
            tag: b.tagName,
            text: b.innerText,
            disabled: b.disabled,
            classes: b.className
          }));
          return {
            title: document.title,
            body: document.body.innerText,
            buttons: btns
          };
        })()`,
        returnByValue: true,
      },
      sessionId
    );
    console.log(`Poll ${i}: Buttons found:`, res.result.value.buttons.length);
    if (res.result.value.buttons.length > 0) {
      console.log("Buttons:", res.result.value.buttons);
      console.log("Body snippet:", res.result.value.body.slice(0, 300));
      break;
    }
  }

  // Clean up
  await send("Target.closeTarget", { targetId });
  await send("Target.disposeBrowserContext", { browserContextId });
  conn.close();

  // Mark unsold to leave state clean
  await fetch("http://127.0.0.1:8081/api/tournaments/18/auction/unsold", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
  });
}

inspectDOM().catch(console.error);
