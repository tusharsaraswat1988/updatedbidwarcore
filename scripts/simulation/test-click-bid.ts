import { ensureChromeRunning } from "./test-chrome";

async function testClickBid() {
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

  // Mount Owner Panel
  console.log("Waiting for AccessCode...");
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const chk = await send(
      "Runtime.evaluate",
      {
        expression: `!!document.querySelector('input[placeholder="ACCESS CODE"]')`,
        returnByValue: true,
      },
      sessionId
    );
    if (chk.result.value) break;
  }

  // Type code
  await send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const input = document.querySelector('input[placeholder="ACCESS CODE"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(input, "SIMT01");
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
        return true;
      })()`,
      returnByValue: true,
    },
    sessionId
  );

  // Wait for LiveBid
  console.log("Waiting for LiveBid to mount...");
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const chk = await send(
      "Runtime.evaluate",
      {
        expression: `document.body.innerText.includes('SIM_TITANS') && (document.body.innerText.includes('PURSE') || document.body.innerText.includes('Waiting for next player'))`,
        returnByValue: true,
      },
      sessionId
    );
    if (chk.result.value) {
      console.log("LiveBid mounted!");
      break;
    }
  }

  // Operator presents player
  console.log("Operator presenting next player...");
  const nextRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction/next-player", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ mode: "sequential" }),
  });
  console.log("Next player status:", nextRes.status);

  // Operator starts timer
  console.log("Operator starting timer for 60s...");
  const timerRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction/start-timer", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ seconds: 60 }),
  });
  console.log("Start timer status:", timerRes.status);

  // Wait for bid button to appear in Owner Panel
  console.log("Polling for BID button in Owner Panel...");
  let foundBidBtn = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const chk = await send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const bidBtn = btns.find(b => b.innerText.includes('BID') && !b.disabled);
          return {
            found: !!bidBtn,
            text: bidBtn?.innerText,
            allButtons: btns.map(b => ({ text: b.innerText, disabled: b.disabled }))
          };
        })()`,
        returnByValue: true,
      },
      sessionId
    );
    if (chk.result.value.found) {
      console.log("FOUND BID BUTTON!", chk.result.value.text);
      foundBidBtn = true;
      break;
    } else {
      console.log(`Poll ${i}:`, chk.result.value.allButtons);
    }
  }

  if (foundBidBtn) {
    // Click bid button
    console.log("Clicking BID button in native Chrome...");
    const clickRes = await send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const bidBtn = btns.find(b => b.innerText.includes('BID') && !b.disabled);
          if (!bidBtn) return { clicked: false, error: 'Not found' };
          bidBtn.click();
          return { clicked: true, text: bidBtn.innerText };
        })()`,
        returnByValue: true,
      },
      sessionId
    );
    console.log("Click result:", clickRes.result.value);

    await new Promise((r) => setTimeout(r, 1500));
    const state = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction").then((r) => r.json());
    console.log("Auction State after bid:", {
      currentBid: state.currentBid,
      currentBidTeamId: state.currentBidTeamId,
      currentBidTeamName: state.currentBidTeamName,
    });
  }

  // Operator sells
  console.log("Operator selling player...");
  const sellRes = await fetch("http://127.0.0.1:8081/api/tournaments/18/auction/sell", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookieHeader },
  });
  console.log("Sell status:", sellRes.status);

  // Clean up
  await send("Target.closeTarget", { targetId });
  await send("Target.disposeBrowserContext", { browserContextId });
  conn.close();
  console.log("Test completed successfully!");
}

testClickBid().catch(console.error);
