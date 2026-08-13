import { afterEach, describe, expect, it } from "vitest";
import {
  assertRuntimeEnv,
  getCorsOrigins,
  isCorsOriginAllowed,
  resetRuntimeConfigForTests,
} from "../lib/runtime-env";

const ENV_KEYS = [
  "NODE_ENV",
  "BIDWAR_ENV",
  "PORT",
  "DATABASE_URL",
  "NEON_DATABASE_URL",
  "SESSION_SECRET",
  "ADMIN_PASSWORD",
  "APP_DOMAIN",
  "APP_PUBLIC_SCHEME",
  "APP_URL",
  "CORS_ORIGINS",
  "EXTRA_CORS_ORIGINS",
  "SERVE_STATIC",
  "RAILWAY_PUBLIC_DOMAIN",
  "RAILWAY_STATIC_URL",
  "RAILWAY_PUBLIC_URL",
  "RAILWAY_ENVIRONMENT",
  "RENDER_EXTERNAL_HOSTNAME",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("platform-aware CORS origins", () => {
  stashEnv();

  afterEach(() => {
    resetRuntimeConfigForTests();
    clearEnv();
    restoreEnv();
  });

  it("merges RAILWAY_PUBLIC_DOMAIN while preserving Render/production hosts", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "production";
    process.env.PORT = "3000";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.APP_DOMAIN =
      "bidwar.in,www.bidwar.in,updatedbidwarcore.onrender.com";
    process.env.APP_PUBLIC_SCHEME = "https";
    process.env.APP_URL = "https://bidwar.in";
    process.env.CORS_ORIGINS = "http://localhost:5000,http://localhost:3000";
    process.env.SERVE_STATIC = "true";
    process.env.RAILWAY_PUBLIC_DOMAIN =
      "updatedbidwarcore-production.up.railway.app";

    assertRuntimeEnv();
    const origins = getCorsOrigins();

    expect(origins).toContain(
      "https://updatedbidwarcore-production.up.railway.app",
    );
    expect(origins).toContain("https://bidwar.in");
    expect(origins).toContain("https://www.bidwar.in");
    expect(origins).toContain("https://updatedbidwarcore.onrender.com");
    expect(origins).toContain("http://localhost:5000");
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("https://bidwarlive.up.railway.app");

    expect(
      isCorsOriginAllowed(
        "https://updatedbidwarcore-production.up.railway.app",
      ),
    ).toBe(true);
    expect(isCorsOriginAllowed("https://bidwar.in")).toBe(true);
  });

  it("allows the Railway-generated domain when RAILWAY_PUBLIC_DOMAIN is the custom domain", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "production";
    process.env.PORT = "3000";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.APP_DOMAIN = "bidwar.in,www.bidwar.in";
    process.env.APP_PUBLIC_SCHEME = "https";
    process.env.APP_URL = "https://bidwar.in";
    process.env.SERVE_STATIC = "true";
    process.env.RAILWAY_ENVIRONMENT = "production";
    process.env.RAILWAY_PUBLIC_DOMAIN = "bidwar.in";

    assertRuntimeEnv();
    const origins = getCorsOrigins();

    expect(origins).toContain("https://bidwar.in");
    expect(origins).toContain("https://www.bidwar.in");
    expect(origins).toContain("https://bidwarlive.up.railway.app");
    expect(origins).not.toContain("*");
    expect(origins.filter((origin) => origin === "https://bidwar.in")).toHaveLength(
      1,
    );

    expect(isCorsOriginAllowed("https://bidwar.in")).toBe(true);
    expect(isCorsOriginAllowed("https://bidwar.in/")).toBe(true);
    expect(isCorsOriginAllowed(" https://bidwarlive.up.railway.app ")).toBe(
      true,
    );
    expect(isCorsOriginAllowed("https://bidwarlive.up.railway.app/")).toBe(
      true,
    );
    expect(isCorsOriginAllowed("https://evil.up.railway.app")).toBe(false);
  });

  it("parses RAILWAY_PUBLIC_DOMAIN when it is a full URL with trailing slash", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "production";
    process.env.PORT = "3000";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.APP_PUBLIC_SCHEME = "https";
    process.env.APP_URL = "https://bidwar.in";
    process.env.SERVE_STATIC = "true";
    process.env.RAILWAY_PUBLIC_DOMAIN = " https://bidwarlive.up.railway.app/ ";

    assertRuntimeEnv();
    expect(getCorsOrigins()).toContain("https://bidwarlive.up.railway.app");
    expect(
      isCorsOriginAllowed("https://bidwarlive.up.railway.app"),
    ).toBe(true);
  });

  it("preserves development loopback CORS without a wildcard allowlist", () => {
    clearEnv();
    process.env.NODE_ENV = "development";
    process.env.BIDWAR_ENV = "local";
    process.env.PORT = "8080";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-local-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.APP_DOMAIN = "localhost";
    process.env.APP_PUBLIC_SCHEME = "http";
    process.env.EXTRA_CORS_ORIGINS = " http://192.168.1.10:3000/ ";

    assertRuntimeEnv();
    const origins = getCorsOrigins();

    expect(origins).not.toContain("*");
    expect(origins).toContain("http://192.168.1.10:3000");
    expect(isCorsOriginAllowed("http://localhost:24755")).toBe(true);
    expect(isCorsOriginAllowed("http://127.0.0.1:5173")).toBe(true);
    expect(isCorsOriginAllowed("https://bidwar.in")).toBe(false);
  });
});
