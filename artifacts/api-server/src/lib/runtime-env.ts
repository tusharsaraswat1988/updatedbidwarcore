import { existsSync } from "node:fs";
import {
  isCorsOriginAllowed as checkCorsOrigin,
  mergeDevCorsOrigins,
  parseOriginList,
} from "@workspace/api-base/dev-cors";

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

  const appHosts = parseCommaList(process.env.APP_DOMAIN);
  const publicScheme = defaultPublicScheme(isProduction);
  const canonicalHost = appHosts[0]!;
  const publicOrigin = `${publicScheme}://${canonicalHost}`;

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
      "APP_DOMAIN is required (comma-separated hostnames, e.g. bidwar.in,www.bidwar.in)",
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

  if (isProduction && process.env.BYPASS_OTP === "true") {
    errors.push("BYPASS_OTP must not be true in production");
  }

  if (errors.length > 0) {
    console.error("[bidwar] Missing or invalid environment configuration:");
    for (const err of errors) {
      console.error(`  • ${err}`);
    }
    console.error(
      "[bidwar] Copy .env.example to .env and set all required values before starting.",
    );
    process.exit(1);
  }

  cached = buildCachedConfig();
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
}
