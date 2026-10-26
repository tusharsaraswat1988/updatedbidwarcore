import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  assertRuntimeEnv,
  buildPublicUrlForRequest,
  getRequestPublicOrigin,
  resetRuntimeConfigForTests,
} from "../lib/runtime-env";
import {
  COOKIE_NAME,
  OAUTH_COOKIE_NAME,
  setOAuthCookie,
  signOAuthJwt,
  verifyAuthJwt,
  verifyOAuthJwt,
} from "../lib/jwt";
import {
  CANONICAL_STAGING_HOST,
  CANONICAL_STAGING_ORIGIN,
  correctStagingPublicOriginMismatch,
  isProductionBidwarHost,
  isStagingLikeHost,
  resolveTrustedRequestOrigin,
  stagingProductionUrlConflictError,
} from "../lib/public-origin-guard";
import authRouter, {
  resolveGoogleOAuthRedirectUri,
  sanitizeOAuthNext,
} from "../routes/auth";

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
  "GOOGLE_CLIENT_SECRET",
  "RAILWAY_PUBLIC_DOMAIN",
  "RAILWAY_STATIC_URL",
  "RAILWAY_ENVIRONMENT_NAME",
  "RENDER_EXTERNAL_HOSTNAME",
  "RENDER_EXTERNAL_URL",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function setStagingRailwayEnv() {
  clearEnv();
  process.env.NODE_ENV = "production";
  process.env.BIDWAR_ENV = "staging";
  process.env.PORT = "3000";
  process.env.DATABASE_URL =
    "postgresql://u:p@ep-staging-example-pooler.example.neon.tech/neondb?sslmode=require";
  process.env.SESSION_SECRET = "x".repeat(32);
  process.env.ADMIN_PASSWORD = "test-admin-password";
  process.env.APP_DOMAIN = "stagingbidwar.up.railway.app";
  process.env.APP_PUBLIC_SCHEME = "https";
  process.env.APP_URL = "https://stagingbidwar.up.railway.app";
  process.env.SERVE_STATIC = "false";
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  process.env.RAILWAY_ENVIRONMENT_NAME = "staging";
  process.env.RAILWAY_PUBLIC_DOMAIN = "stagingbidwar.up.railway.app";
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
  process.env.SERVE_STATIC = "false";
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  process.env.COOKIE_DOMAIN = ".bidwar.in";
}

function createOAuthApp(): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  // Mock req.log and req.oauthState for the routes
  app.use((req, res, next) => {
    (req as any).log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const oauthCookie = req.cookies?.[OAUTH_COOKIE_NAME];
    (req as any).oauthState = oauthCookie ? verifyOAuthJwt(oauthCookie) ?? {} : {};
    (req as any).jwtUser = {};
    next();
  });
  app.use("/api", authRouter);
  return app;
}

describe("Staging Google OAuth Isolation & Verification (P0 Fix)", () => {
  stashEnv();

  beforeEach(() => {
    resetRuntimeConfigForTests();
  });

  afterEach(() => {
    restoreEnv();
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Staging OAuth initiation uses the staging host
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.1: Staging OAuth initiation uses staging host and never points to production", async () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google")
      .set("Host", "stagingbidwar.up.railway.app")
      .set("X-Forwarded-Proto", "https");

    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toBeDefined();

    const url = new URL(location);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");

    // Must use the staging callback URL
    const redirectUri = url.searchParams.get("redirect_uri");
    expect(redirectUri).toBe("https://stagingbidwar.up.railway.app/api/auth/google/callback");
    expect(redirectUri).not.toContain("bidwar.in");

    // Cookie must be set, host-only (no Domain=.bidwar.in), HttpOnly, SameSite=Lax, Secure
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieHeader = Array.isArray(cookies) ? cookies.join("; ") : cookies;
    expect(cookieHeader).toContain(`${OAUTH_COOKIE_NAME}=`);
    expect(cookieHeader).not.toContain("Domain=.bidwar.in");
    expect(cookieHeader).not.toContain("Domain=bidwar.in");
    expect(cookieHeader.toLowerCase()).toContain("samesite=lax");
    expect(cookieHeader.toLowerCase()).toContain("httponly");
    expect(cookieHeader.toLowerCase()).toContain("secure");
  });

  it("Phase 4.1: Staging OAuth initiation auto-corrects even when APP_URL is accidentally set to production", async () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "staging";
    process.env.PORT = "3000";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-staging-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.ADMIN_PASSWORD = "test-admin-password";
    // Simulated misconfiguration: staging copied production APP_URL/APP_DOMAIN
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.APP_PUBLIC_SCHEME = "https";
    process.env.APP_URL = "https://bidwar.in";
    process.env.RAILWAY_ENVIRONMENT_NAME = "staging";
    process.env.RAILWAY_PUBLIC_DOMAIN = "stagingbidwar.up.railway.app";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

    assertRuntimeEnv();

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google")
      .set("Host", "stagingbidwar.up.railway.app")
      .set("X-Forwarded-Host", "stagingbidwar.up.railway.app")
      .set("X-Forwarded-Proto", "https");

    expect(res.status).toBe(302);
    const url = new URL(res.headers.location);
    const redirectUri = url.searchParams.get("redirect_uri");

    // MUST NOT redirect to production!
    expect(redirectUri).toBe("https://stagingbidwar.up.railway.app/api/auth/google/callback");
    expect(redirectUri).not.toContain("bidwar.in");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Staging callback completes without redirecting to production
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.2: Staging callback completes and redirects locally on the staging host", async () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const stateToken = "valid-staging-state-token-1234567890";
    const signedOAuthCookie = signOAuthJwt({
      state: stateToken,
      next: "/organizer/tournaments",
    });

    // Mock Google token exchange and userinfo responses
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return {
          ok: true,
          json: async () => ({
            access_token: "mock-google-access-token",
            expires_in: 3600,
          }),
        } as any;
      }
      if (urlStr.includes("googleapis.com/oauth2/v2/userinfo")) {
        return {
          ok: true,
          json: async () => ({
            id: "google-user-id-999",
            email: "test-organizer@example.com",
            name: "Staging Organizer",
          }),
        } as any;
      }
      return originalFetch(url);
    });

    const app = createOAuthApp();
    const res = await request(app)
      .get(`/api/auth/google/callback?code=mock-auth-code&state=${stateToken}`)
      .set("Host", "stagingbidwar.up.railway.app")
      .set("Cookie", [`${OAUTH_COOKIE_NAME}=${signedOAuthCookie}`]);

    // The callback should redirect locally to complete-profile (if new user) or /organizer
    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toBeDefined();

    // Must be a relative path or on staging domain — NEVER production!
    expect(location).not.toContain("bidwar.in");
    expect(
      location.startsWith("/") || location.startsWith("https://stagingbidwar.up.railway.app"),
    ).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Valid state succeeds; missing or mismatched state remains rejected
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.3: Mismatched OAuth state is rejected and remains on staging with google_state_mismatch", async () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const signedOAuthCookie = signOAuthJwt({
      state: "expected-secret-state-token",
      next: "/organizer",
    });

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google/callback?code=mock-auth-code&state=TAMPERED_STATE")
      .set("Host", "stagingbidwar.up.railway.app")
      .set("Cookie", [`${OAUTH_COOKIE_NAME}=${signedOAuthCookie}`]);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/organizer?error=google_state_mismatch");
    expect(res.headers.location).not.toContain("bidwar.in");
  });

  it("Phase 4.3: Missing OAuth cookie is rejected with google_state_mismatch on staging", async () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google/callback?code=mock-auth-code&state=some-state")
      .set("Host", "stagingbidwar.up.railway.app");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/organizer?error=google_state_mismatch");
    expect(res.headers.location).not.toContain("bidwar.in");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. State/session cookie survives cross-site Google redirect correctly
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.4: Staging cookies are host-only without Domain apex attribute", async () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google")
      .set("Host", "stagingbidwar.up.railway.app");

    const rawCookies = res.headers["set-cookie"] as string[];
    expect(rawCookies).toBeDefined();

    const oauthCookieHeader = rawCookies.find((c) => c.startsWith(`${OAUTH_COOKIE_NAME}=`));
    expect(oauthCookieHeader).toBeDefined();

    // Crucial: Browsers reject Domain=.up.railway.app. It MUST be host-only.
    expect(oauthCookieHeader).not.toMatch(/Domain=/i);
    expect(oauthCookieHeader).toContain("Path=/");
    expect(oauthCookieHeader).toContain("SameSite=Lax");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Production continues using its production callback and redirect
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.5: Production OAuth initiation continues using bidwar.in without regression", async () => {
    setProductionBidwarEnv();
    assertRuntimeEnv();

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google")
      .set("Host", "bidwar.in");

    expect(res.status).toBe(302);
    const url = new URL(res.headers.location);
    const redirectUri = url.searchParams.get("redirect_uri");

    expect(redirectUri).toBe("https://bidwar.in/api/auth/google/callback");
    expect(redirectUri).not.toContain("railway.app");
  });

  it("Phase 4.5: Production resolves trusted request origin correctly", () => {
    setProductionBidwarEnv();
    assertRuntimeEnv();

    expect(
      resolveTrustedRequestOrigin({
        requestHost: "bidwar.in",
        appHosts: ["bidwar.in", "www.bidwar.in"],
        publicScheme: "https",
        publicOrigin: "https://bidwar.in",
        bidwarEnv: "production",
      }),
    ).toBe("https://bidwar.in");

    expect(
      resolveTrustedRequestOrigin({
        requestHost: "www.bidwar.in",
        appHosts: ["bidwar.in", "www.bidwar.in"],
        publicScheme: "https",
        publicOrigin: "https://bidwar.in",
        bidwarEnv: "production",
      }),
    ).toBe("https://www.bidwar.in");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Untrusted redirect destinations are rejected (Open Redirect Protection)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.6: Rejects protocol-relative open redirects", () => {
    expect(sanitizeOAuthNext("//evil.com")).toBeUndefined();
    expect(sanitizeOAuthNext("//evil.com/path")).toBeUndefined();
    expect(sanitizeOAuthNext("/\\evil.com")).toBeUndefined();
    expect(sanitizeOAuthNext("\\evil.com")).toBeUndefined();
  });

  it("Phase 4.6: Rejects absolute URLs and non-relative schemes", () => {
    expect(sanitizeOAuthNext("https://evil.com")).toBeUndefined();
    expect(sanitizeOAuthNext("http://evil.com")).toBeUndefined();
    expect(sanitizeOAuthNext("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeOAuthNext("data:text/html,evil")).toBeUndefined();
  });

  it("Phase 4.6: Blocks internal sensitive/looping paths", () => {
    expect(sanitizeOAuthNext("/organizer")).toBeUndefined();
    expect(sanitizeOAuthNext("/complete-profile")).toBeUndefined();
    expect(sanitizeOAuthNext("/complete-profile?step=otp")).toBeUndefined();
    expect(sanitizeOAuthNext("/api/sensitive")).toBeUndefined();
  });

  it("Phase 4.6: Allows safe application relative paths", () => {
    expect(sanitizeOAuthNext("/organizer/tournaments")).toBe("/organizer/tournaments");
    expect(sanitizeOAuthNext("/tournament/42/auction")).toBe("/tournament/42/auction");
    expect(sanitizeOAuthNext("/mobile/organizer/login")).toBe("/mobile/organizer/login");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Authentication failure remains on the originating environment
  // ─────────────────────────────────────────────────────────────────────────────
  it("Phase 4.7: User cancelled error remains on staging host", async () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const app = createOAuthApp();
    const res = await request(app)
      .get("/api/auth/google/callback?error=access_denied")
      .set("Host", "stagingbidwar.up.railway.app");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/organizer?error=google_cancelled");
    expect(res.headers.location).not.toContain("bidwar.in");
  });

  it("Phase 4.7: resolveGoogleOAuthRedirectUri never emits bidwar.in when host is staging", () => {
    setStagingRailwayEnv();
    assertRuntimeEnv();

    const headers = {
      host: "stagingbidwar.up.railway.app",
      "x-forwarded-host": "stagingbidwar.up.railway.app",
    };

    const redirectUri = resolveGoogleOAuthRedirectUri(headers);
    expect(redirectUri).toBe("https://stagingbidwar.up.railway.app/api/auth/google/callback");
    expect(redirectUri).not.toContain("bidwar.in");
  });
});
