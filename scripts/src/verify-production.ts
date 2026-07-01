/**
 * Smoke checks for production / same-origin deploy (API + static on one host).
 * Set VERIFY_BASE_URL to the public origin, e.g. https://bidwar.in
 */
import "dotenv/config";
import { parseOriginList } from "@workspace/api-base/dev-cors";
import { API_PREFIX, envOr, fail, fetchOk, pass } from "./verify-shared.js";

const base = envOr("VERIFY_BASE_URL", "").replace(/\/+$/, "");

function assertProductionEnv(): void {
  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv !== "production") {
    console.warn(
      `⚠ NODE_ENV is "${nodeEnv ?? "(unset)"}" — production verify expects NODE_ENV=production in the target environment.`,
    );
  }

  const hosts = (process.env.APP_DOMAIN ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  for (const host of hosts) {
    const h = host.toLowerCase();
    if (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "0.0.0.0" ||
      h.endsWith(".localhost")
    ) {
      fail(`APP_DOMAIN must not include localhost in production: ${host}`);
    }
  }

  const extra = parseOriginList(process.env.EXTRA_CORS_ORIGINS);
  for (const origin of extra) {
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
      fail(`EXTRA_CORS_ORIGINS must not include localhost in production: ${origin}`);
    }
  }

  const cors = parseOriginList(process.env.CORS_ORIGINS);
  for (const origin of cors) {
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
      fail(`CORS_ORIGINS must not include localhost in production: ${origin}`);
    }
  }

  pass("Production env: no localhost in APP_DOMAIN / CORS lists");

  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (!appUrl) {
    fail("APP_URL is required in production (e.g. https://bidwar.in)");
  }
  if (!appUrl.startsWith("https://")) {
    fail(`APP_URL must use https in production (got: ${appUrl})`);
  }
  if (base && appUrl !== base) {
    console.warn(
      `⚠ APP_URL (${appUrl}) differs from VERIFY_BASE_URL (${base}) — they should match.`,
    );
  }
  pass(`Production env: APP_URL=${appUrl}`);
}

async function main(): Promise<void> {
  console.log("BidWar verify:production\n");

  if (!base) {
    fail(
      "Set VERIFY_BASE_URL to your deployed origin (e.g. VERIFY_BASE_URL=https://bidwar.in pnpm run verify:production)",
    );
  }

  console.log(`  Base URL: ${base}\n`);

  assertProductionEnv();

  const health = await fetchOk(`${base}${API_PREFIX}/healthz`);
  if (!health.ok || !health.text.includes('"ok"')) {
    fail(
      `${API_PREFIX}/healthz failed: ${health.status} ${health.text.slice(0, 200)}`,
    );
  }
  pass(`${API_PREFIX}/healthz`);

  const loginPage = await fetchOk(`${base}/admin/login`);
  if (!loginPage.ok) {
    fail(`/admin/login failed: ${loginPage.status}`);
  }
  pass("/admin/login");

  const origin = base;
  const preflight = await fetch(`${base}${API_PREFIX}/auth/admin/login`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(15_000),
  }).catch((e: unknown) => {
    fail(`CORS preflight failed: ${e instanceof Error ? e.message : String(e)}`);
  });

  const acao = preflight.headers.get("access-control-allow-origin");
  if (acao && acao !== origin) {
    fail(
      `CORS preflight Access-Control-Allow-Origin was "${acao}" but expected same-origin "${origin}" or no CORS (browser same-origin only)`,
    );
  }
  pass("CORS preflight OK for canonical origin");

  const authProbe = await fetchOk(`${base}${API_PREFIX}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "__verify_probe__" }),
  });
  if (authProbe.status !== 401 && authProbe.status !== 503) {
    fail(`Auth route unexpected status: ${authProbe.status}`);
  }
  pass(`Auth ${API_PREFIX}/auth/admin/login (HTTP ${authProbe.status})`);

  console.log("\nAll production checks passed.\n");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
