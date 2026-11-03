import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
import {
  CANONICAL_STAGING_HOST,
  CANONICAL_STAGING_ORIGIN,
  isProductionBidwarHost,
  isStagingLikeHost,
  resolveTrustedRequestOrigin,
  stagingProductionUrlConflictError,
} from "../lib/public-origin-guard";
import { resolveGoogleOAuthRedirectUri } from "../routes/auth";

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
  "COOKIE_DOMAIN",
  "SERVE_STATIC",
  "GOOGLE_CLIENT_ID",
  "RAILWAY_PUBLIC_DOMAIN",
  "RAILWAY_STATIC_URL",
  "RAILWAY_ENVIRONMENT_NAME",
  "RENDER_EXTERNAL_HOSTNAME",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const val = savedEnv[key];
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function setupProductionEnv() {
  resetRuntimeConfigForTests();
  clearEnv();
  process.env.NODE_ENV = "production";
  process.env.BIDWAR_ENV = "production";
  process.env.PORT = "3000";
  process.env.DATABASE_URL =
    "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
  process.env.SESSION_SECRET = "production-session-secret-at-least-32-chars";
  process.env.ADMIN_PASSWORD = "production-admin-password";
  process.env.APP_DOMAIN = "bidwar.in";
  process.env.APP_PUBLIC_SCHEME = "https";
  process.env.APP_URL = "https://bidwar.in";
  process.env.SERVE_STATIC = "true";
  assertRuntimeEnv();
}

function setupStagingEnv() {
  resetRuntimeConfigForTests();
  clearEnv();
  process.env.NODE_ENV = "production";
  process.env.BIDWAR_ENV = "staging";
  process.env.PORT = "3000";
  process.env.DATABASE_URL =
    "postgresql://u:p@ep-staging-example-pooler.example.neon.tech/neondb?sslmode=require";
  process.env.SESSION_SECRET = "staging-session-secret-at-least-32-chars";
  process.env.ADMIN_PASSWORD = "staging-admin-password";
  process.env.APP_DOMAIN = "stagingbidwar.up.railway.app";
  process.env.APP_PUBLIC_SCHEME = "https";
  process.env.APP_URL = "https://stagingbidwar.up.railway.app";
  process.env.SERVE_STATIC = "true";
  assertRuntimeEnv();
}

function createCorsProbeApp(): Express {
  const app = express();
  app.use(
    cors({
      origin: corsOriginDelegate,
      credentials: true,
    }),
  );
  app.get("/probe", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("P1-2 Production / Staging Origin Isolation Tests", () => {
  stashEnv();

  beforeEach(() => {
    resetRuntimeConfigForTests();
  });

  afterEach(() => {
    resetRuntimeConfigForTests();
    clearEnv();
    restoreEnv();
  });

  describe("1. CORS Boundary Enforcement", () => {
    it("production strictly rejects staging Railway origin", async () => {
      setupProductionEnv();
      const origins = getCorsOrigins();

      expect(origins).not.toContain("https://stagingbidwar.up.railway.app");
      expect(isCorsOriginAllowed("https://stagingbidwar.up.railway.app")).toBe(false);

      const app = createCorsProbeApp();
      const res = await request(app)
        .get("/probe")
        .set("Origin", "https://stagingbidwar.up.railway.app");

      // CORS header must not be sent for rejected origin
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("production allows canonical production domains", async () => {
      setupProductionEnv();

      expect(isCorsOriginAllowed("https://bidwar.in")).toBe(true);
      expect(isCorsOriginAllowed("https://www.bidwar.in")).toBe(true);

      const app = createCorsProbeApp();
      const res = await request(app).get("/probe").set("Origin", "https://bidwar.in");
      expect(res.headers["access-control-allow-origin"]).toBe("https://bidwar.in");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("staging allows staging origin and rejects unapproved production calls", async () => {
      setupStagingEnv();

      expect(isCorsOriginAllowed("https://stagingbidwar.up.railway.app")).toBe(true);
      expect(isCorsOriginAllowed("https://bidwar.in")).toBe(false);

      const app = createCorsProbeApp();
      const stagingRes = await request(app)
        .get("/probe")
        .set("Origin", "https://stagingbidwar.up.railway.app");
      expect(stagingRes.headers["access-control-allow-origin"]).toBe(
        "https://stagingbidwar.up.railway.app",
      );

      const prodRes = await request(app).get("/probe").set("Origin", "https://bidwar.in");
      expect(prodRes.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("both environments reject arbitrary Railway domains", async () => {
      setupProductionEnv();
      expect(isCorsOriginAllowed("https://evil-bidwar.up.railway.app")).toBe(false);
      expect(isCorsOriginAllowed("https://malicious.railway.app")).toBe(false);
      expect(isCorsOriginAllowed("https://other-service.up.railway.app")).toBe(false);

      resetRuntimeConfigForTests();
      setupStagingEnv();
      expect(isCorsOriginAllowed("https://evil-bidwar.up.railway.app")).toBe(false);
      expect(isCorsOriginAllowed("https://malicious.railway.app")).toBe(false);
      expect(isCorsOriginAllowed("https://other-service.up.railway.app")).toBe(false);
    });

    it("credentialed CORS never uses wildcard origin", async () => {
      setupProductionEnv();
      const app = createCorsProbeApp();

      const res = await request(app)
        .get("/probe")
        .set("Origin", "https://random-attacker-site.com");

      expect(res.headers["access-control-allow-origin"]).not.toBe("*");
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("2. Google OAuth Callback Origin Selection", () => {
    it("production resolves callback to production domain", () => {
      setupProductionEnv();

      const headers = { host: "bidwar.in" };
      const redirectUri = resolveGoogleOAuthRedirectUri(headers);
      expect(redirectUri).toBe("https://bidwar.in/api/auth/google/callback");
    });

    it("staging resolves callback to staging domain", () => {
      setupStagingEnv();

      const headers = { host: "stagingbidwar.up.railway.app" };
      const redirectUri = resolveGoogleOAuthRedirectUri(headers);
      expect(redirectUri).toBe("https://stagingbidwar.up.railway.app/api/auth/google/callback");
    });

    it("production rejects staging host in Host header and falls back safely", () => {
      setupProductionEnv();

      // Attacker attempts to trick production into redirecting to staging
      const headers = { host: "stagingbidwar.up.railway.app" };
      const redirectUri = resolveGoogleOAuthRedirectUri(headers);
      // Production must NOT redirect to staging!
      expect(redirectUri).toBe("https://bidwar.in/api/auth/google/callback");
    });

    it("staging rejects production host in Host header and falls back safely", () => {
      setupStagingEnv();

      const headers = { host: "bidwar.in" };
      const redirectUri = resolveGoogleOAuthRedirectUri(headers);
      // Staging must NOT redirect to production!
      expect(redirectUri).toBe("https://stagingbidwar.up.railway.app/api/auth/google/callback");
    });

    it("arbitrary host header is safely ignored by OAuth callback resolver", () => {
      setupProductionEnv();

      const headers = { host: "evil-phishing-site.com" };
      const redirectUri = resolveGoogleOAuthRedirectUri(headers);
      expect(redirectUri).toBe("https://bidwar.in/api/auth/google/callback");
    });
  });

  describe("3. Environment Conflict & Failure Safeguards", () => {
    it("fails assertRuntimeEnv when BIDWAR_ENV=production but domain is staging", () => {
      resetRuntimeConfigForTests();
      clearEnv();
      process.env.NODE_ENV = "production";
      process.env.BIDWAR_ENV = "production";
      process.env.PORT = "3000";
      process.env.DATABASE_URL =
        "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
      process.env.SESSION_SECRET = "production-session-secret-at-least-32-chars";
      process.env.ADMIN_PASSWORD = "production-admin-password";
      process.env.APP_DOMAIN = "stagingbidwar.up.railway.app"; // Disallowed staging host in production!
      process.env.APP_PUBLIC_SCHEME = "https";
      process.env.APP_URL = "https://stagingbidwar.up.railway.app";

      expect(() => assertRuntimeEnv()).toThrow();
    });

    it("fails assertRuntimeEnv when SESSION_SECRET is too short (< 32 chars)", () => {
      resetRuntimeConfigForTests();
      clearEnv();
      process.env.NODE_ENV = "production";
      process.env.BIDWAR_ENV = "production";
      process.env.PORT = "3000";
      process.env.DATABASE_URL =
        "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
      process.env.SESSION_SECRET = "short-secret";
      process.env.ADMIN_PASSWORD = "production-admin-password";
      process.env.APP_DOMAIN = "bidwar.in";
      process.env.APP_PUBLIC_SCHEME = "https";
      process.env.APP_URL = "https://bidwar.in";

      expect(() => assertRuntimeEnv()).toThrow();
    });

    it("detects staging vs production conflict helper correctly", () => {
      const err = stagingProductionUrlConflictError({
        bidwarEnv: "staging",
        publicOrigin: "https://bidwar.in",
        appHosts: ["bidwar.in"],
      });
      expect(typeof err).toBe("string");
      expect(err).toMatch(/cannot point to production|still https:\/\/bidwar.in/i);
    });

    it("returns null from conflict helper when staging config is consistent", () => {
      const err = stagingProductionUrlConflictError({
        bidwarEnv: "staging",
        publicOrigin: "https://stagingbidwar.up.railway.app",
        appHosts: ["stagingbidwar.up.railway.app"],
      });
      expect(err).toBeNull();
    });
  });
});
