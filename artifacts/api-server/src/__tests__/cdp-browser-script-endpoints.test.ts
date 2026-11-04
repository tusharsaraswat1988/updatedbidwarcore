import { describe, expect, it, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptPath = fileURLToPath(new URL("../../../../scripts/verify-staging-browser.cjs", import.meta.url));
const { httpPutJson, httpGetText } = require(scriptPath);

describe("CDP browser verification endpoints (P2 remediation)", () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url || "", `http://${req.headers.host}`);

      if (url.pathname === "/json/new") {
        if (req.method !== "PUT") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method Not Allowed - expected PUT" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "target-tab-test-456",
            title: "BidWar Staging Surface",
            type: "page",
            url: url.searchParams.get("url") || "",
            webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/page/target-tab-test-456",
          }),
        );
        return;
      }

      if (url.pathname.startsWith("/json/close/")) {
        // Chrome CDP returns HTTP 200 with text/plain "Target is closing"
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Target is closing\n");
        return;
      }

      res.writeHead(404);
      res.end("Not Found");
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("creates new target via HTTP PUT and parses JSON metadata", async () => {
    const targetUrl = `${baseUrl}/json/new?https://stagingbidwar.up.railway.app/tournament/4/auction`;
    const meta = await httpPutJson(targetUrl);

    expect(meta).toBeDefined();
    expect(meta.id).toBe("target-tab-test-456");
    expect(meta.webSocketDebuggerUrl).toBe("ws://127.0.0.1:9222/devtools/page/target-tab-test-456");
  });

  it("consumes /json/close/:id response as plain text without throwing SyntaxError", async () => {
    const closeUrl = `${baseUrl}/json/close/target-tab-test-456`;
    const responseText = await httpGetText(closeUrl);

    expect(responseText).toBe("Target is closing");
    // Verify JSON.parse would have thrown on this exact string
    expect(() => JSON.parse(responseText)).toThrow();
  });
});
