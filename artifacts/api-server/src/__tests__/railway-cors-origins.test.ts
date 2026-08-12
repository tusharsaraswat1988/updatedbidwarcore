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
  "SERVE_STATIC",
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

describe("Railway migration CORS origins", () => {
  stashEnv();

  afterEach(() => {
    resetRuntimeConfigForTests();
    clearEnv();
    restoreEnv();
  });

  it("allows the Railway validation origin while preserving Render/production hosts", () => {
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

    expect(
      isCorsOriginAllowed(
        "https://updatedbidwarcore-production.up.railway.app",
      ),
    ).toBe(true);
    expect(isCorsOriginAllowed("https://bidwar.in")).toBe(true);
  });
});
