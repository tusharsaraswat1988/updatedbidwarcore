import { afterEach, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  assertRuntimeEnv,
  getCorsOrigins,
  isCorsOriginAllowed,
  resetRuntimeConfigForTests,
} from "../lib/runtime-env";
import { setAuthCookie, COOKIE_NAME } from "../lib/jwt";
import {
  cookieDomainForResponse,
  configuredSharedCookieDomain,
} from "../lib/auth-cookie-options";

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
  "COOKIE_DOMAIN",
  "SERVE_STATIC",
  "RAILWAY_PUBLIC_DOMAIN",
  "RAILWAY_STATIC_URL",
  "RENDER_EXTERNAL_HOSTNAME",
  "RENDER_EXTERNAL_URL",
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

function setProductionBidwarEnv() {
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
}

function cookieHeaderHasDomain(setCookie: string | string[] | undefined, domain: string): boolean {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const needle = `Domain=${domain}`;
  return headers.some((h) => h.includes(needle) || h.toLowerCase().includes(needle.toLowerCase()));
}

function authSetCookieHeaders(setCookie: string | string[] | undefined): string[] {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return headers.filter((h) => h.startsWith(`${COOKIE_NAME}=`));
}

function createCookieProbeApp(): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.get("/probe-set-auth", (_req, res) => {
    setAuthCookie(res, { organizerAccountId: 42, organizer: {} });
    res.json({
      cookieDomain: cookieDomainForResponse(res) ?? null,
      configured: configuredSharedCookieDomain() ?? null,
    });
  });
  return app;
}

describe("host-aware auth cookies + platform CORS", () => {
  stashEnv();

  afterEach(() => {
    resetRuntimeConfigForTests();
    clearEnv();
    restoreEnv();
  });

  it("preserves Domain=.bidwar.in for bidwar.in requests", async () => {
    setProductionBidwarEnv();
    assertRuntimeEnv();
    expect(configuredSharedCookieDomain()).toBe(".bidwar.in");

    const app = createCookieProbeApp();
    const res = await request(app)
      .get("/probe-set-auth")
      .set("Host", "bidwar.in");

    expect(res.status).toBe(200);
    expect(res.body.cookieDomain).toBe(".bidwar.in");
    const authCookies = authSetCookieHeaders(res.headers["set-cookie"]);
    expect(authCookies.length).toBeGreaterThan(0);
    expect(cookieHeaderHasDomain(authCookies, ".bidwar.in")).toBe(true);
  });

  it("preserves Domain=.bidwar.in for www.bidwar.in requests", async () => {
    setProductionBidwarEnv();
    assertRuntimeEnv();

    const app = createCookieProbeApp();
    const res = await request(app)
      .get("/probe-set-auth")
      .set("Host", "www.bidwar.in");

    expect(res.status).toBe(200);
    expect(res.body.cookieDomain).toBe(".bidwar.in");
    const authCookies = authSetCookieHeaders(res.headers["set-cookie"]);
    expect(cookieHeaderHasDomain(authCookies, ".bidwar.in")).toBe(true);
  });

  it("omits Domain (host-only) on Railway public host when APP_DOMAIN is bidwar.in", async () => {
    setProductionBidwarEnv();
    process.env.RAILWAY_PUBLIC_DOMAIN =
      "updatedbidwarcore-production.up.railway.app";
    assertRuntimeEnv();

    // Prove the failure mode: shared domain is still configured from APP_DOMAIN…
    expect(configuredSharedCookieDomain()).toBe(".bidwar.in");

    const app = createCookieProbeApp();
    const res = await request(app)
      .get("/probe-set-auth")
      .set("Host", "updatedbidwarcore-production.up.railway.app");

    expect(res.status).toBe(200);
    expect(res.body.cookieDomain).toBeNull();
    const authCookies = authSetCookieHeaders(res.headers["set-cookie"]);
    expect(authCookies.length).toBeGreaterThan(0);
    // Live session cookie (not Max-Age=0 clears) must be host-only on Railway.
    const sessionCookies = authCookies.filter((h) => !/Max-Age=0/i.test(h));
    expect(sessionCookies.length).toBeGreaterThan(0);
    expect(cookieHeaderHasDomain(sessionCookies, ".bidwar.in")).toBe(false);
    expect(cookieHeaderHasDomain(sessionCookies, "bidwar.in")).toBe(false);
    expect(cookieHeaderHasDomain(authCookies, ".bidwar.in")).toBe(false);
  });

  it("omits Domain on localhost (development host-only)", async () => {
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
    assertRuntimeEnv();

    const app = createCookieProbeApp();
    const res = await request(app).get("/probe-set-auth").set("Host", "localhost:8080");

    expect(res.status).toBe(200);
    expect(res.body.cookieDomain).toBeNull();
    const authCookies = authSetCookieHeaders(res.headers["set-cookie"]);
    expect(cookieHeaderHasDomain(authCookies, ".bidwar.in")).toBe(false);
  });

  it("accepts Railway public origin via RAILWAY_PUBLIC_DOMAIN without discarding APP_DOMAIN CORS", () => {
    setProductionBidwarEnv();
    process.env.CORS_ORIGINS =
      "https://updatedbidwarcore.onrender.com,http://localhost:5000";
    process.env.RAILWAY_PUBLIC_DOMAIN =
      "updatedbidwarcore-production.up.railway.app";
    assertRuntimeEnv();

    const origins = getCorsOrigins();
    expect(origins).toContain("https://bidwar.in");
    expect(origins).toContain("https://www.bidwar.in");
    expect(origins).toContain("https://updatedbidwarcore.onrender.com");
    expect(origins).toContain("http://localhost:5000");
    expect(origins).toContain(
      "https://updatedbidwarcore-production.up.railway.app",
    );
    expect(
      isCorsOriginAllowed(
        "https://updatedbidwarcore-production.up.railway.app",
      ),
    ).toBe(true);
  });

  it("does not require hardcoding Railway URL when platform env is absent (APP_DOMAIN still wins)", () => {
    setProductionBidwarEnv();
    assertRuntimeEnv();
    const origins = getCorsOrigins();
    expect(origins).toContain("https://bidwar.in");
    expect(origins).toContain("https://www.bidwar.in");
    expect(origins).not.toContain(
      "https://updatedbidwarcore-production.up.railway.app",
    );
  });
});
