import { existsSync } from "node:fs";
import path from "node:path";
import type { IncomingHttpHeaders } from "node:http";
import {
  isCorsOriginAllowed as checkCorsOrigin,
  mergeDevCorsOrigins,
  parseOriginList,
} from "@workspace/api-base/dev-cors";
import {
  correctStagingPublicOriginMismatch,
  resolveRenderExternalOrigin,
  resolveTrustedRequestOrigin,
  stagingProductionUrlConflictError,
} from "./public-origin-guard.js";

export type RuntimeConfig = {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  adminPassword: string;
  adminDataPassword: string | undefined;
  appHosts: string[];
  canonicalHost: string;
  publicScheme: "http" | "https";
  publicOrigin: string;
  corsOrigins: string[];
  serveStatic: boolean;
  redisUrl: string | undefined;
};

let cached: RuntimeConfig | null = null;

function parseCommaList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDisallowedProductionHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h.endsWith(".localhost")
  );
}

function defaultPublicScheme(isProduction: boolean): "http" | "https" {
  const explicit = process.env.APP_PUBLIC_SCHEME?.trim().toLowerCase();
  if (explicit === "http" || explicit === "https") {
    return explicit;
  }
  return isProduction ? "https" : "http";
}

/** Canonical public origin from APP_URL when set (production single source of truth). */
function parseAppUrlOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function schemeFromOrigin(origin: string): "http" | "https" {
  return origin.startsWith("https://") ? "https" : "http";
}

function resolvePublicOrigin(
  appUrlOrigin: string | null,
  publicScheme: "http" | "https",
  canonicalHost: string,
): string {
  return appUrlOrigin ?? `${publicScheme}://${canonicalHost}`;
}

function buildCorsOrigins(
  hosts: string[],
  scheme: "http" | "https",
  isProduction: boolean,
): string[] {
  const explicit = parseOriginList(process.env.CORS_ORIGINS);
  const fromHosts = hosts.map((h) => `${scheme}://${h}`);
  // Development: loopback origins on any port are allowed via isCorsOriginAllowed().
  // EXTRA_CORS_ORIGINS adds non-loopback dev hosts (LAN, tunnels).
  const devExtras = isProduction
    ? []
    : mergeDevCorsOrigins(process.env.EXTRA_CORS_ORIGINS);
  return [...new Set([...explicit, ...fromHosts, ...devExtras])];
}

function buildCachedConfig(): RuntimeConfig {
  const nodeEnv = process.env.NODE_ENV!.trim();
  const isProduction = nodeEnv === "production";

  const port = Number(process.env.PORT!.trim());
  const databaseUrl =
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL!.trim();

  let appHosts = parseCommaList(process.env.APP_DOMAIN);
  let appUrlOrigin = parseAppUrlOrigin(process.env.APP_URL);

  // Staging + production APP_URL sends Google OAuth to bidwar.in.
  // Detect and correct before deriving publicOrigin / CORS.
  const stagingCorrection = correctStagingPublicOriginMismatch({
    appUrlOrigin,
    appHosts,
    renderExternalOrigin: resolveRenderExternalOrigin(),
    bidwarEnv: process.env.BIDWAR_ENV,
  });
  for (const warning of stagingCorrection.warnings) {
    console.error(`[bidwar] ${warning}`);
  }
  if (stagingCorrection.publicOrigin) {
    appUrlOrigin = stagingCorrection.publicOrigin;
  }
  if (stagingCorrection.appHosts) {
    appHosts = stagingCorrection.appHosts;
  }

  const publicScheme = appUrlOrigin
    ? schemeFromOrigin(appUrlOrigin)
    : defaultPublicScheme(isProduction);
  const canonicalHost = appHosts[0]!;
  const publicOrigin = resolvePublicOrigin(
    appUrlOrigin,
    publicScheme,
    canonicalHost,
  );

  const serveStatic =
    process.env.SERVE_STATIC === "true" ||
    (isProduction && process.env.SERVE_STATIC !== "false");

  return {
    nodeEnv,
    isProduction,
    port,
    databaseUrl,
    sessionSecret: process.env.SESSION_SECRET!.trim(),
    adminPassword: process.env.ADMIN_PASSWORD!.trim(),
    adminDataPassword: process.env.ADMIN_DATA_PASSWORD?.trim() || undefined,
    appHosts,
    canonicalHost,
    publicScheme,
    publicOrigin,
    corsOrigins: buildCorsOrigins(appHosts, publicScheme, isProduction),
    serveStatic,
    redisUrl: process.env.REDIS_URL?.trim() || undefined,
  };
}

/**
 * Validates required environment variables and caches the resolved config.
 * Must run once at process startup before importing modules that use the database.
 */
export function assertRuntimeEnv(): RuntimeConfig {
  if (cached) return cached;

  const errors: string[] = [];

  const nodeEnv = process.env.NODE_ENV?.trim();
  if (!nodeEnv) {
    errors.push("NODE_ENV is required (e.g. production or development)");
  } else if (!["production", "development", "test"].includes(nodeEnv)) {
    errors.push(
      `NODE_ENV must be production, development, or test (got: ${nodeEnv})`,
    );
  }

  const isProduction = nodeEnv === "production";

  const bidwarEnv = process.env.BIDWAR_ENV?.trim().toLowerCase();
  if (!bidwarEnv) {
    errors.push(
      "BIDWAR_ENV is required (local|staging|production). Do not rely on NODE_ENV or hostname detection.",
    );
  } else if (!["local", "staging", "production"].includes(bidwarEnv)) {
    errors.push(
      `BIDWAR_ENV must be local, staging, or production (got: ${process.env.BIDWAR_ENV})`,
    );
  }

  const portRaw = process.env.PORT?.trim();
  if (!portRaw) {
    errors.push("PORT is required (set by your host or in .env)");
  } else {
    const port = Number(portRaw);
    if (Number.isNaN(port) || port <= 0 || port > 65535) {
      errors.push(`PORT must be a valid TCP port (1–65535), got: ${portRaw}`);
    }
  }

  const databaseUrl =
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errors.push(
      "DATABASE_URL or NEON_DATABASE_URL is required (PostgreSQL connection string)",
    );
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret) {
    errors.push(
      "SESSION_SECRET is required (generate with: openssl rand -hex 32)",
    );
  } else if (sessionSecret.length < 32) {
    errors.push("SESSION_SECRET must be at least 32 characters");
  }

  if (!process.env.ADMIN_PASSWORD?.trim()) {
    errors.push("ADMIN_PASSWORD is required");
  }

  const appDomainRaw = process.env.APP_DOMAIN?.trim();
  if (!appDomainRaw) {
    errors.push(
      "APP_DOMAIN is required (comma-separated hostnames, e.g. bidwar.in,bidwar.in)",
    );
  } else {
    const hosts = parseCommaList(appDomainRaw);
    if (hosts.length === 0) {
      errors.push("APP_DOMAIN must include at least one hostname");
    }
    for (const host of hosts) {
      if (host.includes("://") || host.includes("/")) {
        errors.push(
          `APP_DOMAIN must be hostnames only (no scheme or path): ${host}`,
        );
      }
      if (isProduction && isDisallowedProductionHost(host)) {
        errors.push(
          `APP_DOMAIN host "${host}" is not allowed in production — use your public domain`,
        );
      }
    }
  }

  const schemeRaw = process.env.APP_PUBLIC_SCHEME?.trim().toLowerCase();
  if (schemeRaw && schemeRaw !== "http" && schemeRaw !== "https") {
    errors.push("APP_PUBLIC_SCHEME must be http or https");
  }
  if (isProduction && schemeRaw === "http") {
    errors.push("APP_PUBLIC_SCHEME must be https in production");
  }

  const appUrlRaw = process.env.APP_URL?.trim();
  if (appUrlRaw) {
    const appOrigin = parseAppUrlOrigin(appUrlRaw);
    if (!appOrigin) {
      errors.push(
        "APP_URL must be a valid absolute URL (e.g. https://bidwar.in)",
      );
    } else if (isProduction) {
      if (!appOrigin.startsWith("https://")) {
        errors.push("APP_URL must use https in production");
      }
      const hostname = new URL(appOrigin).hostname;
      if (isDisallowedProductionHost(hostname)) {
        errors.push(
          `APP_URL hostname "${hostname}" is not allowed in production — use your public domain`,
        );
      }
    }
  } else if (isProduction) {
    errors.push(
      "APP_URL is required in production (e.g. https://bidwar.in) — used for OAuth callbacks and email links",
    );
  }

  if (isProduction && process.env.BYPASS_OTP === "true") {
    errors.push("BYPASS_OTP must not be true in production");
  }

  if (errors.length > 0) {
    console.error("[bidwar] Missing or invalid environment configuration:");
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    console.error(
      "[bidwar] Copy .env.example to .env (development) or .env.production.example to .env.production (local production) before starting.",
    );
    process.exit(1);
  }

  cached = buildCachedConfig();

  if (cached.isProduction && !cached.publicOrigin.startsWith("https://")) {
    console.error(
      `[bidwar] Production public origin must be https (got: ${cached.publicOrigin}). ` +
        "Set APP_URL=https://your-domain in the host dashboard.",
    );
    process.exit(1);
  }

  const stagingUrlConflict = stagingProductionUrlConflictError({
    bidwarEnv: process.env.BIDWAR_ENV,
    publicOrigin: cached.publicOrigin,
    appHosts: cached.appHosts,
  });
  if (stagingUrlConflict) {
    console.error(`[bidwar] ${stagingUrlConflict}`);
    process.exit(1);
  }

  const googleOAuthRedirect = buildPublicUrl("/api/auth/google/callback");
  console.info(`[bidwar] Public origin: ${cached.publicOrigin}`);
  console.info(`[bidwar] Google OAuth redirect URI: ${googleOAuthRedirect}`);

  return cached;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!cached) {
    throw new Error(
      "Runtime environment not initialized. Import ./lib/bootstrap.js before other application modules.",
    );
  }
  return cached;
}

/** Canonical public site origin, e.g. https://bidwar.in */
export function getPublicOrigin(): string {
  return getRuntimeConfig().publicOrigin;
}

/** Build an absolute public URL for links, OAuth callbacks, and SMS. */
export function buildPublicUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getPublicOrigin()}${path}`;
}

function requestHostFromHeaders(headers: IncomingHttpHeaders): string | undefined {
  const xfh = headers["x-forwarded-host"];
  const rawXfh = Array.isArray(xfh) ? xfh[0] : (xfh ?? "");
  const fromXfh = rawXfh.split(",")[0]?.trim();
  if (fromXfh) return fromXfh;
  const host = headers.host;
  return Array.isArray(host) ? host[0] : host;
}

/**
 * Public origin for the current request when Host is in APP_DOMAIN;
 * otherwise the canonical APP_URL origin. Prefer this for OAuth redirect_uri
 * so login round-trips stay on the host the user started from.
 */
export function getRequestPublicOrigin(headers: IncomingHttpHeaders): string {
  const { appHosts, publicScheme, publicOrigin } = getRuntimeConfig();
  return resolveTrustedRequestOrigin({
    requestHost: requestHostFromHeaders(headers),
    appHosts,
    publicScheme,
    publicOrigin,
  });
}

/** Absolute public URL scoped to the trusted request host when possible. */
export function buildPublicUrlForRequest(
  headers: IncomingHttpHeaders,
  pathname: string,
): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getRequestPublicOrigin(headers)}${path}`;
}

/** Test-only: clear the cached runtime config between cases. */
export function resetRuntimeConfigForTests(): void {
  cached = null;
}

export function getCorsOrigins(): string[] {
  return getRuntimeConfig().corsOrigins;
}

/** Whether the request Origin may call the API (credentials / CORS). */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  const { corsOrigins, isProduction } = getRuntimeConfig();
  return checkCorsOrigin(origin, corsOrigins, { isProduction });
}

export function getSessionSecret(): string {
  return getRuntimeConfig().sessionSecret;
}

/** Super-admin password from ADMIN_PASSWORD (trimmed, cached at startup). */
export function getAdminPassword(): string {
  return getRuntimeConfig().adminPassword;
}

/** Optional data-entry admin password from ADMIN_DATA_PASSWORD. */
export function getAdminDataPassword(): string | undefined {
  return getRuntimeConfig().adminDataPassword;
}

/**
 * When SERVE_STATIC is enabled, the auction-platform build must exist or startup fails.
 */
export function assertServeStaticBuild(auctionDistPath: string): void {
  const { serveStatic } = getRuntimeConfig();
  if (!serveStatic) return;

  if (!existsSync(auctionDistPath)) {
    throw new Error(
      `SERVE_STATIC is enabled but the auction-platform build was not found at:\n` +
        `  ${auctionDistPath}\n` +
        `Run "pnpm run build" from the repository root, then start the server again.`,
    );
  }

  const builtIndex = path.join(auctionDistPath, "index.html");
  if (!existsSync(builtIndex)) {
    throw new Error(
      `SERVE_STATIC is enabled but the built SPA index was not found at:\n` +
        `  ${builtIndex}\n` +
        `Run "pnpm run build:deploy" from the repository root, then start the server again.`,
    );
  }
}
