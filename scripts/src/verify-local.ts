/**
 * Smoke checks for split local dev (Vite frontend + API server).
 * Expects API on VERIFY_API_URL (default http://127.0.0.1:8080) and
 * frontend on VERIFY_FRONTEND_URL (default http://127.0.0.1:FRONTEND_PORT).
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
import { isDevLocalhostOrigin } from "@workspace/api-base/dev-cors";
import {
  API_PREFIX,
  DEFAULT_API_DEV_PORT,
  DEFAULT_AUCTION_DEV_PORT,
  DEFAULT_OWNER_DEV_PORT,
  envOr,
  fail,
  fetchOk,
  pass,
} from "./verify-shared.js";

const apiPort = envOr("API_PORT", String(DEFAULT_API_DEV_PORT));
const frontPort = envOr(
  "FRONTEND_PORT",
  envOr("WEB_PORT", String(DEFAULT_AUCTION_DEV_PORT)),
);
const apiBase = envOr("VERIFY_API_URL", `http://127.0.0.1:${apiPort}`);
const frontBase = envOr("VERIFY_FRONTEND_URL", `http://127.0.0.1:${frontPort}`);
const frontOrigin = frontBase.replace(/\/+$/, "");
const ownerPort = envOr("OWNER_APP_PORT", String(DEFAULT_OWNER_DEV_PORT));
const ownerBase = envOr("VERIFY_OWNER_APP_URL", `http://127.0.0.1:${ownerPort}`);
const ownerOrigin = ownerBase.replace(/\/+$/, "");

async function main(): Promise<void> {
  console.log("BidWar verify:local\n");
  console.log(`  API:       ${apiBase}`);
  console.log(`  Frontend:  ${frontBase}`);
  console.log(`  Owner app: ${ownerBase}\n`);

  const health = await fetchOk(`${apiBase}${API_PREFIX}/healthz`);
  if (!health.ok || !health.text.includes('"ok"')) {
    fail(
      `Backend not healthy at ${apiBase}${API_PREFIX}/healthz — start API with PORT=${DEFAULT_API_DEV_PORT} (or set VERIFY_API_URL). Response: ${health.status} ${health.text.slice(0, 200)}`,
    );
  }
  pass(`Backend ${API_PREFIX}/healthz`);

  const loginPage = await fetchOk(`${frontBase}/admin/login`);
  if (!loginPage.ok) {
    fail(
      `Frontend not reachable at ${frontBase}/admin/login — start auction-platform dev (pnpm --filter @workspace/auction-platform run dev). ${loginPage.status} ${loginPage.text.slice(0, 120)}`,
    );
  }
  pass("Frontend /admin/login");

  const proxyHealth = await fetchOk(`${frontBase}${API_PREFIX}/healthz`);
  if (!proxyHealth.ok || !proxyHealth.text.includes('"ok"')) {
    fail(
      `Vite proxy missing or misconfigured: ${frontBase}${API_PREFIX}/healthz should reach the API. Set API_DEV_PROXY_TARGET in .env (default http://127.0.0.1:${DEFAULT_API_DEV_PORT}). Response: ${proxyHealth.status} ${proxyHealth.text.slice(0, 200)}`,
    );
  }
  pass(`Vite proxy ${API_PREFIX} → API`);

  const preflight = await fetch(`${apiBase}${API_PREFIX}/auth/admin/login`, {
    method: "OPTIONS",
    headers: {
      Origin: frontOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(12_000),
  }).catch((e: unknown) => {
    fail(`CORS preflight failed: ${e instanceof Error ? e.message : String(e)}`);
  });

  const acao = preflight.headers.get("access-control-allow-origin");
  if (!acao) {
    fail(
      `CORS preflight for ${frontOrigin} returned no Access-Control-Allow-Origin. Ensure NODE_ENV=development on API and restart (dev allows any http://localhost:* and http://127.0.0.1:*).`,
    );
  }
  pass(`CORS allows ${frontOrigin} (Access-Control-Allow-Origin: ${acao})`);

  const dynamicOrigin = "http://localhost:24755";
  if (!isDevLocalhostOrigin(dynamicOrigin)) {
    fail("isDevLocalhostOrigin should accept dynamic Vite ports (e.g. localhost:24755)");
  }
  const dynamicPreflight = await fetch(
    `${apiBase}${API_PREFIX}/auth/organizer-account/login`,
    {
      method: "OPTIONS",
      headers: {
        Origin: dynamicOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
      signal: AbortSignal.timeout(12_000),
    },
  ).catch((e: unknown) => {
    fail(`CORS preflight (dynamic port) failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  const dynamicAcao = dynamicPreflight.headers.get("access-control-allow-origin");
  if (!dynamicAcao) {
    fail(
      `CORS preflight for ${dynamicOrigin} returned no Access-Control-Allow-Origin — dynamic Vite ports must work in development.`,
    );
  }
  pass(`CORS allows dynamic dev origin ${dynamicOrigin}`);

  const organizerProbe = await fetchOk(
    `${apiBase}${API_PREFIX}/auth/organizer-account/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: dynamicOrigin,
      },
      body: JSON.stringify({ identifier: "__verify__", password: "__verify__" }),
    },
  );
  if (organizerProbe.status === 500) {
    fail(
      `Organizer login returned 500 (likely CORS or server error): ${organizerProbe.text.slice(0, 200)}`,
    );
  }
  if (organizerProbe.status !== 401 && organizerProbe.status !== 400) {
    fail(
      `Organizer login unexpected status: ${organizerProbe.status} (expected 401 or 400 for probe credentials). Body: ${organizerProbe.text.slice(0, 200)}`,
    );
  }
  pass(`Organizer login reachable from ${dynamicOrigin} (HTTP ${organizerProbe.status})`);

  const authProbe = await fetchOk(`${frontBase}${API_PREFIX}/auth/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: frontOrigin,
    },
    body: JSON.stringify({ password: "__verify_probe__" }),
  });
  if (authProbe.status !== 401 && authProbe.status !== 503) {
    fail(
      `Auth route unexpected status via proxy: ${authProbe.status} (expected 401 wrong password or 503 if ADMIN_PASSWORD unset). Body: ${authProbe.text.slice(0, 200)}`,
    );
  }
  pass(`Auth ${API_PREFIX}/auth/admin/login reachable (HTTP ${authProbe.status})`);

  const ownerViaFront = await fetchOk(
    `${frontBase}/owner-app/tournament/5/owner/4`,
  );
  if (!ownerViaFront.ok || !ownerViaFront.text.includes("BidWar Owner")) {
    fail(
      `Owner app not proxied through frontend at ${frontBase}/owner-app/tournament/5/owner/4 — auction-platform Vite must proxy /owner-app to owner-app dev (OWNER_APP_PORT / default ${DEFAULT_OWNER_DEV_PORT}). ${ownerViaFront.status} ${ownerViaFront.text.slice(0, 160)}`,
    );
  }
  if (
    !ownerViaFront.text.includes("/owner-app/src/main.tsx") &&
    !ownerViaFront.text.includes("/owner-app/@vite/client")
  ) {
    fail(
      `Owner app HTML served via ${frontBase} is missing /owner-app asset prefixes — wrong Vite app may load (blank page). Restart auction-platform after pulling vite-proxy changes.`,
    );
  }
  pass(`Frontend proxies /owner-app → owner-app (${frontBase})`);

  const ownerRoot = await fetchOk(`${ownerBase}/owner-app/`);
  if (!ownerRoot.ok || !ownerRoot.text.includes("root")) {
    fail(
      `Owner app not reachable at ${ownerBase}/owner-app/ — start owner-app via pnpm dev (port ${DEFAULT_OWNER_DEV_PORT}). ${ownerRoot.status} ${ownerRoot.text.slice(0, 120)}`,
    );
  }
  pass("Owner app /owner-app/");

  const ownerRoute = await fetchOk(
    `${ownerBase}/owner-app/tournament/5/owner/4`,
  );
  if (!ownerRoute.ok || !ownerRoute.text.includes("root")) {
    fail(
      `Owner app SPA route failed at ${ownerBase}/owner-app/tournament/5/owner/4. ${ownerRoute.status} ${ownerRoute.text.slice(0, 120)}`,
    );
  }
  pass("Owner app /owner-app/tournament/:id/owner/:teamId");

  const ownerProxyHealth = await fetchOk(`${ownerBase}${API_PREFIX}/healthz`);
  if (!ownerProxyHealth.ok || !ownerProxyHealth.text.includes('"ok"')) {
    fail(
      `Owner app Vite proxy missing: ${ownerBase}${API_PREFIX}/healthz should reach the API. Response: ${ownerProxyHealth.status} ${ownerProxyHealth.text.slice(0, 200)}`,
    );
  }
  pass(`Owner app Vite proxy ${API_PREFIX} → API`);

  const ownerCors = await fetch(`${apiBase}${API_PREFIX}/auth/organizer-account/login`, {
    method: "OPTIONS",
    headers: {
      Origin: ownerOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(12_000),
  }).catch((e: unknown) => {
    fail(`Owner app CORS preflight failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  const ownerAcao = ownerCors.headers.get("access-control-allow-origin");
  if (!ownerAcao) {
    fail(
      `CORS preflight for ${ownerOrigin} returned no Access-Control-Allow-Origin.`,
    );
  }
  pass(`CORS allows owner app ${ownerOrigin}`);

  if (!process.env.DATABASE_URL?.trim() && !process.env.NEON_DATABASE_URL?.trim()) {
    console.warn(
      "\n⚠ DATABASE_URL not set in environment — skipping DB connectivity (API may still run if .env is loaded only by the server process).",
    );
  } else {
    pass("DATABASE_URL present in verify environment");
  }

  console.log("\nAll local checks passed.\n");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
