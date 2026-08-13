import { afterEach, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import cors from "cors";
import request from "supertest";
import {
  assertRuntimeEnv,
  corsOriginDelegate,
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
    expect(isCorsOriginAllowed("https://www.bidwar.in")).toBe(false);
    expect(isCorsOriginAllowed("https://bidwarlive.up.railway.app")).toBe(
      false,
    );
  });

  it("always allows production site origins even when APP_DOMAIN omits www", () => {
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
    process.env.RAILWAY_PUBLIC_DOMAIN = "bidwar.in";

    assertRuntimeEnv();
    const origins = getCorsOrigins();

    expect(origins).toContain("https://bidwar.in");
    expect(origins).toContain("https://www.bidwar.in");
    expect(origins).toContain("https://bidwarlive.up.railway.app");
    expect(origins).not.toContain("*");

    expect(isCorsOriginAllowed("https://bidwar.in")).toBe(true);
    expect(isCorsOriginAllowed("https://www.bidwar.in")).toBe(true);
    expect(isCorsOriginAllowed("https://bidwarlive.up.railway.app")).toBe(
      true,
    );
    expect(isCorsOriginAllowed("https://evil.example")).toBe(false);
  });

  it("does not inject production site origins into staging", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.PORT = "3000";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-staging-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.APP_DOMAIN = "bidwar-staging.up.railway.app";
    process.env.APP_PUBLIC_SCHEME = "https";
    process.env.APP_URL = "https://bidwar-staging.up.railway.app";
    process.env.SERVE_STATIC = "true";
    process.env.RAILWAY_PUBLIC_DOMAIN = "bidwar-staging.up.railway.app";

    assertRuntimeEnv();
    const origins = getCorsOrigins();

    expect(origins).toContain("https://bidwar-staging.up.railway.app");
    expect(origins).not.toContain("https://bidwar.in");
    expect(origins).not.toContain("https://www.bidwar.in");
    expect(origins).not.toContain("https://bidwarlive.up.railway.app");
    expect(isCorsOriginAllowed("https://bidwar.in")).toBe(false);
  });
});

function createCorsProbeApp(): Express {
  const app = express();
  app.use(
    cors({
      origin: corsOriginDelegate,
      credentials: true,
    }),
  );
  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/tournaments/:id/scoring/events", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.status(200).end();
  });
  return app;
}

describe("production CORS middleware (REST + SSE)", () => {
  stashEnv();

  afterEach(() => {
    resetRuntimeConfigForTests();
    clearEnv();
    restoreEnv();
  });

  function setProductionEnv() {
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
    process.env.RAILWAY_PUBLIC_DOMAIN = "bidwar.in";
  }

  it("allows bidwar.in, www, and Railway generated origin with credentials", async () => {
    setProductionEnv();
    assertRuntimeEnv();
    const app = createCorsProbeApp();

    for (const origin of [
      "https://bidwar.in",
      "https://www.bidwar.in",
      "https://bidwarlive.up.railway.app",
    ]) {
      const res = await request(app)
        .get("/api/healthz")
        .set("Origin", origin);

      expect(res.status, origin).toBe(200);
      expect(res.headers["access-control-allow-origin"], origin).toBe(origin);
      expect(res.headers["access-control-allow-credentials"], origin).toBe(
        "true",
      );
    }
  });

  it("allows scoring SSE from production origins", async () => {
    setProductionEnv();
    assertRuntimeEnv();
    const app = createCorsProbeApp();

    for (const origin of [
      "https://bidwar.in",
      "https://bidwarlive.up.railway.app",
    ]) {
      const res = await request(app)
        .get("/api/tournaments/1/scoring/events")
        .set("Origin", origin)
        .set("Accept", "text/event-stream");

      expect(res.status, origin).toBe(200);
      expect(res.headers["access-control-allow-origin"], origin).toBe(origin);
      expect(res.headers["access-control-allow-credentials"], origin).toBe(
        "true",
      );
      expect(res.headers["content-type"], origin).toMatch(/text\/event-stream/);
    }
  });

  it("rejects unknown origins without a wildcard", async () => {
    setProductionEnv();
    assertRuntimeEnv();
    const app = createCorsProbeApp();

    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "https://evil.up.railway.app");

    expect(res.status).toBe(500);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
