import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

const mockRequireVerifiedOwnerSession = vi.fn();
const mockCleanupStalePushData = vi.fn();
const mockRevokeOwnerSession = vi.fn();
const mockAssertTeamInTournament = vi.fn();

const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
const mockDbDelete = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInnerJoin = vi.fn();
const mockDbFrom = vi.fn();
const mockDbWhere = vi.fn();

vi.mock("../lib/owner-session", () => ({
  requireVerifiedOwnerSession: (...args: unknown[]) => mockRequireVerifiedOwnerSession(...args),
  cleanupStalePushData: (...args: unknown[]) => mockCleanupStalePushData(...args),
  revokeOwnerSession: (...args: unknown[]) => mockRevokeOwnerSession(...args),
  assertTeamInTournament: (...args: unknown[]) => mockAssertTeamInTournament(...args),
}));

vi.mock("../lib/rate-limiters", () => ({
  pushSubscribeLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return {
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(),
        }),
      };
    },
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return {
        from: (...fromArgs: unknown[]) => {
          mockDbFrom(...fromArgs);
          return {
            where: (...whereArgs: unknown[]) => {
              mockDbWhere(...whereArgs);
              return Promise.resolve([{ id: 1 }]);
            },
            innerJoin: (...joinArgs: unknown[]) => {
              mockDbInnerJoin(...joinArgs);
              return {
                where: (...whereArgs: unknown[]) => {
                  mockDbWhere(...whereArgs);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDbDelete(...args);
      return { where: () => Promise.resolve() };
    },
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return { set: () => ({ where: () => Promise.resolve() }) };
    },
  },
  pushSubscriptionsTable: {
    endpoint: {},
    tournamentId: {},
    teamId: {},
    verifiedAt: {},
    ownerSessionId: {},
    lastSeenAt: {},
  },
  ownerSessionsTable: { id: {}, expiresAt: {} },
  tournamentsTable: { id: {} },
  teamsTable: { id: {} },
}));

import pushRouter from "../routes/push";

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(pushRouter);
  return app;
}

describe("POST /tournaments/:tournamentId/push-subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = "test-public";
    process.env.VAPID_PRIVATE_KEY = "test-private";
  });

  it("returns 401 when owner session is missing", async () => {
    mockRequireVerifiedOwnerSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Owner session required",
    });

    const app = makeApp();
    const res = await request(app)
      .post("/tournaments/1/push-subscribe?teamId=2")
      .send({
        endpoint: "https://push.example/abc",
        keys: { p256dh: "key", auth: "auth" },
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Owner session required/i);
  });

  it("returns 403 when owner session is for a different team", async () => {
    mockRequireVerifiedOwnerSession.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Owner session not authorized for this team",
    });

    const app = makeApp();
    const res = await request(app)
      .post("/tournaments/1/push-subscribe?teamId=2")
      .send({
        endpoint: "https://push.example/abc",
        keys: { p256dh: "key", auth: "auth" },
      });

    expect(res.status).toBe(403);
  });

  it("stores verified subscription when owner session is valid", async () => {
    mockRequireVerifiedOwnerSession.mockResolvedValue({
      ok: true,
      session: { sessionId: "sess-1", tournamentId: 1, teamId: 2 },
    });
    mockAssertTeamInTournament.mockResolvedValue(true);

    const app = makeApp();
    const res = await request(app)
      .post("/tournaments/1/push-subscribe?teamId=2")
      .send({
        endpoint: "https://push.example/abc",
        keys: { p256dh: "key", auth: "auth" },
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.sessionId).toBe("sess-1");
    expect(mockDbInsert).toHaveBeenCalled();
  });
});
