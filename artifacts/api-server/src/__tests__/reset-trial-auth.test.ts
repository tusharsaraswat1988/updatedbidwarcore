import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";

const TOURNAMENT_ID = 7;
const ORGANIZER_ACCOUNT_ID = 42;

const mockTournament = {
  id: TOURNAMENT_ID,
  organizerId: ORGANIZER_ACCOUNT_ID,
  organizerPassword: null,
  status: "setup",
  resetCount: 0,
  lastResetAt: null,
  lastResetBy: null,
  name: "Test Cup",
};

const { mockDbSelect, mockTransaction, mockBroadcast } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockTransaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
  mockBroadcast: vi.fn().mockResolvedValue({ status: "idle" }),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mockDbSelect }) }),
    transaction: mockTransaction,
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue([]) }) }),
    delete: () => ({ where: vi.fn().mockResolvedValue([]) }),
  },
  tournamentsTable: { id: {}, organizerId: {}, organizerPassword: {}, status: {}, resetCount: {}, lastResetAt: {}, lastResetBy: {}, name: {} },
  playersTable: { id: {}, tournamentId: {}, status: {}, teamId: {}, soldPrice: {}, retainedPrice: {} },
  teamsTable: { id: {}, tournamentId: {}, purseUsed: {} },
  bidsTable: { tournamentId: {} },
  purseBoostersTable: { tournamentId: {}, status: {} },
  auctionSessionsTable: { tournamentId: {} },
  auctionIntelEventsTable: { tournamentId: {} },
  auctionIntelSnapshotsTable: { tournamentId: {} },
  auctionIntelReportsTable: { tournamentId: {} },
}));

vi.mock("../lib/runtime-env", () => ({
  getAdminPassword: () => "admin-secret",
  getPublicOrigin: () => "http://localhost",
  getRuntimeConfig: () => ({ isProduction: false }),
}));

vi.mock("../lib/intelligence-cache", () => ({
  invalidateIntelCacheForTournament: vi.fn(),
}));

vi.mock("../lib/broadcast", () => ({
  broadcastToTournament: mockBroadcast,
}));

vi.mock("../lib/audit-service", () => ({
  auditLog: vi.fn(),
}));

import auctionRouter from "../routes/auction";

function buildApp(jwtUser?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as Request & { jwtUser?: unknown }).jwtUser = jwtUser ?? {};
    next();
  });
  app.use(auctionRouter);
  return app;
}

describe("POST /tournaments/:id/auction/reset-trial — organizer auth", () => {
  beforeEach(() => {
    mockDbSelect.mockReset();
    mockDbSelect
      .mockResolvedValueOnce([mockTournament])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it("returns 401 when no session and no tournament password", async () => {
    const app = buildApp();

    const res = await request(app)
      .post(`/tournaments/${TOURNAMENT_ID}/auction/reset-trial`)
      .send({ password: "", reason: "", resetContext: "organizer" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/sign-in required/i);
  });

  it("returns 403 when signed-in account does not own the tournament", async () => {
    const app = buildApp({ organizerAccountId: 99 });

    const res = await request(app)
      .post(`/tournaments/${TOURNAMENT_ID}/auction/reset-trial`)
      .send({ password: "", reason: "", resetContext: "organizer" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission/i);
  });
});
