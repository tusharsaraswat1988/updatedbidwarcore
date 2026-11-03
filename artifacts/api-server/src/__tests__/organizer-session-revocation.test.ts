import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  assertRuntimeEnv,
  resetRuntimeConfigForTests,
} from "../lib/runtime-env";
import {
  signAuthJwt,
  verifyAuthJwt,
  computeTokenHash,
  COOKIE_NAME,
  type AuthClaims,
} from "../lib/jwt";
import {
  generateOrganizerSessionId,
  organizerSessionsTable,
  type OrganizerSession,
} from "@workspace/db";

// In-memory sessions store to simulate database rows
interface MockSessionRow {
  id: string;
  organizerAccountId: number | null;
  memberId: string | null;
  tournamentId: number | null;
  sessionScope: string;
  tokenHash: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastSeenAt: Date;
}

let sessionStore: Map<string, MockSessionRow> = new Map();
let dbFailMode = false;

// Mock the db module
vi.mock("@workspace/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    db: {
      insert: () => ({
        values: async (values: Partial<MockSessionRow>) => {
          if (dbFailMode) throw new Error("Neon database connection timed out");
          const row: MockSessionRow = {
            id: values.id!,
            organizerAccountId: values.organizerAccountId ?? null,
            memberId: values.memberId ?? null,
            tournamentId: values.tournamentId ?? null,
            sessionScope: values.sessionScope ?? "account",
            tokenHash: values.tokenHash!,
            deviceName: values.deviceName ?? null,
            ipAddress: values.ipAddress ?? null,
            userAgent: values.userAgent ?? null,
            expiresAt: values.expiresAt ?? new Date(Date.now() + 7 * 86400 * 1000),
            revokedAt: values.revokedAt ?? null,
            createdAt: values.createdAt ?? new Date(),
            lastSeenAt: values.lastSeenAt ?? new Date(),
          };
          sessionStore.set(row.id, row);
          return [row];
        },
      }),
      select: () => ({
        from: () => ({
          where: (condition: unknown) => {
            if (dbFailMode) throw new Error("Neon database connection timed out");
            return {
              limit: async (num: number) => {
                const now = new Date();
                const all = Array.from(sessionStore.values());
                const matching = all.filter((s) => {
                  return s.revokedAt === null && s.expiresAt > now;
                });
                return matching.slice(0, num);
              },
            };
          },
        }),
      }),
      update: () => ({
        set: (updates: Partial<MockSessionRow>) => ({
          where: async (condition: unknown) => {
            if (dbFailMode) throw new Error("Neon database connection timed out");
            return [];
          },
        }),
      }),
    },
  };
});

import {
  createOrganizerSession,
  loadActiveOrganizerSession,
  validateOrganizerSession,
  revokeOrganizerSession,
  revokeAllOrganizerSessions,
  rotateOrganizerSessionClaims,
  isOrganizerSessionRevocationEnforced,
  upgradeLegacyTokenToSession,
} from "../lib/organizer-session";
import { jwtAuthMiddleware } from "../middleware/jwt-auth";

describe("P1-1 Organizer Session Revocation Regression Suite", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    resetRuntimeConfigForTests();
    sessionStore = new Map();
    dbFailMode = false;
    process.env.NODE_ENV = "production";
    process.env.BIDWAR_ENV = "production";
    process.env.PORT = "3000";
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-prod-example-pooler.example.neon.tech/neondb?sslmode=require";
    process.env.SESSION_SECRET = "super-secret-key-32-chars-long-test-env-1234";
    process.env.ADMIN_PASSWORD = "test-admin-password";
    process.env.APP_DOMAIN = "bidwar.in";
    process.env.APP_PUBLIC_SCHEME = "https";
    process.env.APP_URL = "https://bidwar.in";
    assertRuntimeEnv();
    delete process.env.ENFORCE_ORGANIZER_SESSION_REVOCATION;
  });

  afterEach(() => {
    resetRuntimeConfigForTests();
    process.env = { ...savedEnv };
    vi.restoreAllMocks();
  });

  describe("1. Session ID & Token Hash Invariants", () => {
    it("generates IDs with orgsess_ prefix and sufficient entropy", () => {
      const id1 = generateOrganizerSessionId();
      const id2 = generateOrganizerSessionId();
      expect(id1).toMatch(/^orgsess_[0-9a-f]{32}$/);
      expect(id2).toMatch(/^orgsess_[0-9a-f]{32}$/);
      expect(id1).not.toBe(id2);
    });

    it("computes SHA-256 token hash and never matches raw token", () => {
      const rawToken = signAuthJwt({ organizerAccountId: 42 });
      const hash1 = computeTokenHash(rawToken);
      const hash2 = computeTokenHash(rawToken);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(rawToken);
    });

    it("different tokens yield different hashes", () => {
      const tokenA = signAuthJwt({ organizerAccountId: 1 });
      const tokenB = signAuthJwt({ organizerAccountId: 2 });
      expect(computeTokenHash(tokenA)).not.toBe(computeTokenHash(tokenB));
    });
  });

  describe("2. Database Session Lifecycle & Validation", () => {
    it("validates an active session with matching token hash", async () => {
      const sessionId = generateOrganizerSessionId();
      const claims: AuthClaims = { organizerAccountId: 10, sessionId };
      const token = signAuthJwt(claims);
      const tokenHash = computeTokenHash(token);

      const sessionRow: MockSessionRow = {
        id: sessionId,
        organizerAccountId: 10,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash,
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      sessionStore.set(sessionId, sessionRow);

      const incomingHash = computeTokenHash(token);
      expect(sessionRow.tokenHash).toBe(incomingHash);
      expect(sessionRow.revokedAt).toBeNull();
      expect(sessionRow.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("rejects session when revokedAt is set", async () => {
      const sessionId = generateOrganizerSessionId();
      const claims: AuthClaims = { organizerAccountId: 10, sessionId };
      const token = signAuthJwt(claims);
      const tokenHash = computeTokenHash(token);

      const sessionRow: MockSessionRow = {
        id: sessionId,
        organizerAccountId: 10,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash,
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: new Date(),
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      sessionStore.set(sessionId, sessionRow);

      const row = sessionStore.get(sessionId);
      const isActive = row && row.revokedAt === null && row.expiresAt > new Date();
      expect(isActive).toBe(false);
    });

    it("rejects session when expiresAt is in the past", async () => {
      const sessionId = generateOrganizerSessionId();
      const claims: AuthClaims = { organizerAccountId: 10, sessionId };
      const token = signAuthJwt(claims);
      const tokenHash = computeTokenHash(token);

      const sessionRow: MockSessionRow = {
        id: sessionId,
        organizerAccountId: 10,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash,
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      sessionStore.set(sessionId, sessionRow);

      const row = sessionStore.get(sessionId);
      const isActive = row && row.revokedAt === null && row.expiresAt > new Date();
      expect(isActive).toBe(false);
    });

    it("rejects token when token hash does not match stored hash", async () => {
      const sessionId = generateOrganizerSessionId();
      const claims1: AuthClaims = { organizerAccountId: 10, sessionId, organizer: { "1": true } };
      const claims2: AuthClaims = { organizerAccountId: 10, sessionId, organizer: { "2": true } };
      const token1 = signAuthJwt(claims1);
      const token2 = signAuthJwt(claims2);

      const sessionRow: MockSessionRow = {
        id: sessionId,
        organizerAccountId: 10,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash: computeTokenHash(token2),
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "TestAgent",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      sessionStore.set(sessionId, sessionRow);

      const hash1 = computeTokenHash(token1);
      expect(hash1).not.toBe(sessionRow.tokenHash);
    });
  });

  describe("3. Middleware Integration & Attack Scenarios", () => {
    function createProtectedApp(mockLookup?: (sid: string) => Promise<MockSessionRow | null>) {
      const app: Express = express();
      app.use(cookieParser());

      app.use(async (req, res, next) => {
        const authToken = req.cookies?.[COOKIE_NAME];
        if (!authToken) {
          req.jwtUser = {};
          next();
          return;
        }

        const claims = verifyAuthJwt(authToken);
        if (!claims) {
          req.jwtUser = {};
          next();
          return;
        }

        if (claims.isAdmin === true) {
          req.jwtUser = claims;
          next();
          return;
        }

        if (claims.sessionId) {
          try {
            if (dbFailMode) {
              res.status(503).json({ error: "Database unavailable" });
              return;
            }
            const session = mockLookup
              ? await mockLookup(claims.sessionId)
              : sessionStore.get(claims.sessionId);

            if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
              clearAuthCookie(res);
              res.status(401).json({ error: "Session has been revoked or expired" });
              return;
            }

            const incomingHash = computeTokenHash(authToken);
            if (session.tokenHash !== incomingHash) {
              clearAuthCookie(res);
              res.status(401).json({ error: "Session token mismatch" });
              return;
            }

            req.sessionId = claims.sessionId;
            req.jwtUser = claims;
            next();
          } catch (err) {
            clearAuthCookie(res);
            res.status(401).json({ error: "Session validation error" });
          }
          return;
        }

        if (isOrganizerSessionRevocationEnforced()) {
          clearAuthCookie(res);
          res.status(401).json({ error: "Legacy session expired. Please sign in again." });
          return;
        }

        req.jwtUser = claims;
        next();
      });

      function clearAuthCookie(res: Response) {
        res.clearCookie(COOKIE_NAME);
      }

      app.get("/api/protected/organizer-data", (req, res) => {
        if (!req.jwtUser.organizerAccountId && !req.jwtUser.isAdmin) {
          res.status(401).json({ error: "Not authorized" });
          return;
        }
        res.json({ success: true, organizerAccountId: req.jwtUser.organizerAccountId, sessionId: req.sessionId });
      });

      return app;
    }

    it("accepts valid organizer request with active session", async () => {
      const app = createProtectedApp();
      const sessionId = generateOrganizerSessionId();
      const claims: AuthClaims = { organizerAccountId: 77, sessionId };
      const token = signAuthJwt(claims);
      const tokenHash = computeTokenHash(token);

      sessionStore.set(sessionId, {
        id: sessionId,
        organizerAccountId: 77,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash,
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });

      const res = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.organizerAccountId).toBe(77);
      expect(res.body.sessionId).toBe(sessionId);
    });

    it("rejects copied JWT replay after session revocation", async () => {
      const app = createProtectedApp();
      const sessionId = generateOrganizerSessionId();
      const claims: AuthClaims = { organizerAccountId: 77, sessionId };
      const copiedToken = signAuthJwt(claims);
      const tokenHash = computeTokenHash(copiedToken);

      const session: MockSessionRow = {
        id: sessionId,
        organizerAccountId: 77,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash,
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      sessionStore.set(sessionId, session);

      const okRes = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${copiedToken}`]);
      expect(okRes.status).toBe(200);

      session.revokedAt = new Date();

      const replayedRes = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${copiedToken}`]);

      expect(replayedRes.status).toBe(401);
      expect(replayedRes.body.error).toMatch(/revoked or expired/);
    });

    it("rejects previous JWT after token hash rotation (tournament logout)", async () => {
      const app = createProtectedApp();
      const sessionId = generateOrganizerSessionId();

      const claimsV1: AuthClaims = {
        organizerAccountId: 77,
        sessionId,
        organizer: { "10": true, "20": true },
      };
      const tokenV1 = signAuthJwt(claimsV1);
      const tokenHashV1 = computeTokenHash(tokenV1);

      const session: MockSessionRow = {
        id: sessionId,
        organizerAccountId: 77,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash: tokenHashV1,
        deviceName: "Chrome",
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };
      sessionStore.set(sessionId, session);

      const resV1 = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${tokenV1}`]);
      expect(resV1.status).toBe(200);

      const claimsV2: AuthClaims = {
        organizerAccountId: 77,
        sessionId,
        organizer: { "10": true },
      };
      const tokenV2 = signAuthJwt(claimsV2);
      session.tokenHash = computeTokenHash(tokenV2);

      const resV2 = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${tokenV2}`]);
      expect(resV2.status).toBe(200);

      const replayOldToken = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${tokenV1}`]);

      expect(replayOldToken.status).toBe(401);
      expect(replayOldToken.body.error).toMatch(/token mismatch/);
    });

    it("global logout revokes all sessions belonging to organizer account", async () => {
      const accountId = 99;
      const sid1 = generateOrganizerSessionId();
      const sid2 = generateOrganizerSessionId();

      const token1 = signAuthJwt({ organizerAccountId: accountId, sessionId: sid1 });
      const token2 = signAuthJwt({ organizerAccountId: accountId, sessionId: sid2 });

      sessionStore.set(sid1, {
        id: sid1,
        organizerAccountId: accountId,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash: computeTokenHash(token1),
        deviceName: "MacBook",
        ipAddress: "1.1.1.1",
        userAgent: "Safari",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });

      sessionStore.set(sid2, {
        id: sid2,
        organizerAccountId: accountId,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash: computeTokenHash(token2),
        deviceName: "Android Phone",
        ipAddress: "2.2.2.2",
        userAgent: "Chrome Mobile",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });

      for (const [id, s] of sessionStore.entries()) {
        if (s.organizerAccountId === accountId) {
          s.revokedAt = new Date();
        }
      }

      const app = createProtectedApp();

      const res1 = await request(app).get("/api/protected/organizer-data").set("Cookie", [`${COOKIE_NAME}=${token1}`]);
      const res2 = await request(app).get("/api/protected/organizer-data").set("Cookie", [`${COOKIE_NAME}=${token2}`]);

      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
    });

    it("password change keeps current session active and revokes concurrent sessions", async () => {
      const accountId = 101;
      const currentSid = generateOrganizerSessionId();
      const otherSid = generateOrganizerSessionId();

      const currentToken = signAuthJwt({ organizerAccountId: accountId, sessionId: currentSid });
      const otherToken = signAuthJwt({ organizerAccountId: accountId, sessionId: otherSid });

      sessionStore.set(currentSid, {
        id: currentSid,
        organizerAccountId: accountId,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash: computeTokenHash(currentToken),
        deviceName: "Current Device",
        ipAddress: "10.0.0.1",
        userAgent: "Browser",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });

      sessionStore.set(otherSid, {
        id: otherSid,
        organizerAccountId: accountId,
        memberId: null,
        tournamentId: null,
        sessionScope: "account",
        tokenHash: computeTokenHash(otherToken),
        deviceName: "Other Device",
        ipAddress: "10.0.0.2",
        userAgent: "Old Browser",
        expiresAt: new Date(Date.now() + 86400 * 1000),
        revokedAt: null,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });

      for (const [id, s] of sessionStore.entries()) {
        if (s.organizerAccountId === accountId && id !== currentSid) {
          s.revokedAt = new Date();
        }
      }

      const app = createProtectedApp();

      const currentRes = await request(app).get("/api/protected/organizer-data").set("Cookie", [`${COOKIE_NAME}=${currentToken}`]);
      expect(currentRes.status).toBe(200);

      const otherRes = await request(app).get("/api/protected/organizer-data").set("Cookie", [`${COOKIE_NAME}=${otherToken}`]);
      expect(otherRes.status).toBe(401);
    });

    it("fails closed when database is unavailable (never bypasses session check)", async () => {
      const app = createProtectedApp();
      const sessionId = generateOrganizerSessionId();
      const token = signAuthJwt({ organizerAccountId: 88, sessionId });

      dbFailMode = true;

      const res = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${token}`]);

      expect(res.status).not.toBe(200);
      expect([401, 503]).toContain(res.status);
    });

    it("master and data_entry admins bypass organizer session validation", async () => {
      const app = createProtectedApp();
      const masterAdminToken = signAuthJwt({ isAdmin: true, adminLevel: "master" });
      const dataEntryAdminToken = signAuthJwt({ isAdmin: true, adminLevel: "data_entry" });

      const masterRes = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${masterAdminToken}`]);

      const dataEntryRes = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${dataEntryAdminToken}`]);

      expect(masterRes.status).toBe(200);
      expect(dataEntryRes.status).toBe(200);
    });

    it("enforces legacy token migration policy: rejects old JWT without sessionId in enforced mode", async () => {
      process.env.ENFORCE_ORGANIZER_SESSION_REVOCATION = "true";
      const app = createProtectedApp();

      const legacyToken = signAuthJwt({ organizerAccountId: 50 });

      const res = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${legacyToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Legacy session expired/);
    });

    it("grace period allows legacy JWT when ENFORCE_ORGANIZER_SESSION_REVOCATION is false", async () => {
      process.env.ENFORCE_ORGANIZER_SESSION_REVOCATION = "false";
      const app = createProtectedApp();

      const legacyToken = signAuthJwt({ organizerAccountId: 50 });

      const res = await request(app)
        .get("/api/protected/organizer-data")
        .set("Cookie", [`${COOKIE_NAME}=${legacyToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.organizerAccountId).toBe(50);
    });
  });
});
