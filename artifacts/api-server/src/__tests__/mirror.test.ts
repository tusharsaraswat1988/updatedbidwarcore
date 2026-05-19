import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── DB mock ───────────────────────────────────────────────────────────────────
const { mockDbWhere, mockDbUpdateWhere } = vi.hoisted(() => ({
  mockDbWhere: vi.fn(),
  mockDbUpdateWhere: vi.fn().mockResolvedValue([]),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mockDbWhere }) }),
    update: () => ({ set: () => ({ where: mockDbUpdateWhere }) }),
    insert: () => ({ values: vi.fn().mockResolvedValue([]) }),
  },
  pool: { query: vi.fn() },
  tournamentsTable: { id: {} },
  teamsTable: { id: {} },
  playersTable: { id: {} },
  bidsTable: {},
  categoriesTable: {},
  auctionSessionsTable: { id: {} },
}));

vi.mock("../lib/broadcast", () => ({
  addSseClient: vi.fn(),
  removeSseClient: vi.fn(),
  broadcastToTournament: vi.fn(),
}));

vi.mock("../lib/rate-limiters", () => ({
  cheerLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  globalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  exportLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/whatsapp", () => ({
  notifyPlayerSold: vi.fn(),
  notifyPlayerUnsold: vi.fn(),
  notifyPlayerReAuction: vi.fn(),
}));

vi.mock("../lib/purse-protection", () => ({ computeTeamPurseProtection: vi.fn() }));
vi.mock("../lib/name-filter", () => ({ isNameClean: vi.fn().mockReturnValue(true) }));
vi.mock("../lib/cheer-constants", () => ({ CHEER_DEFAULT_PRESETS: [] }));
vi.mock("../lib/auction-logger", () => ({
  logBidEvent: vi.fn(),
  logPlayerAuctionStart: vi.fn(),
  logPlayerAuctionEnd: vi.fn(),
  logTimerEvent: vi.fn(),
}));

import router from "../routes/auction";

// ── Helpers ────────────────────────────────────────────────────────────────────
const TOKEN = "b".repeat(64);
const FUTURE_EXPIRY = new Date(Date.now() + 48 * 60 * 60 * 1000);

function makeTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    name: "Mirror Test Tournament",
    localModeEnabled: true,
    exportToken: TOKEN,
    exportTokenExpiresAt: FUTURE_EXPIRY,
    exportTokenSyncedAt: null,
    exportTokenLastMirrorAt: null,
    status: "active",
    ...overrides,
  };
}

const VALID_MIRROR_BODY = {
  status: "bidding",
  currentPlayerCloudId: null,
  currentBidTeamCloudId: null,
  currentBid: null,
  timerEndsAt: null,
  lastAction: null,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { log: Record<string, ReturnType<typeof vi.fn>> }).log = {
      warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(),
    };
    next();
  });
  app.use("/api", router);
  return app;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("POST /api/tournaments/:id/auction/mirror — token security", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("401 — missing X-Export-Token header", async () => {
    mockDbWhere.mockResolvedValue([makeTournament()]);
    const res = await request(app)
      .post("/api/tournaments/77/auction/mirror")
      .send(VALID_MIRROR_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing X-Export-Token/i);
  });

  it("404 — tournament not found", async () => {
    mockDbWhere.mockResolvedValue([]);
    const res = await request(app)
      .post("/api/tournaments/9999/auction/mirror")
      .set("X-Export-Token", TOKEN)
      .send(VALID_MIRROR_BODY);
    expect(res.status).toBe(404);
  });

  it("403 — tournament has no export token configured", async () => {
    mockDbWhere.mockResolvedValue([makeTournament({ exportToken: null })]);
    const res = await request(app)
      .post("/api/tournaments/77/auction/mirror")
      .set("X-Export-Token", TOKEN)
      .send(VALID_MIRROR_BODY);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/No export token configured/i);
  });

  it("403 — wrong token value", async () => {
    mockDbWhere.mockResolvedValue([makeTournament()]);
    const res = await request(app)
      .post("/api/tournaments/77/auction/mirror")
      .set("X-Export-Token", "z".repeat(64))
      .send(VALID_MIRROR_BODY);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Invalid export token/i);
  });

  it("403 — expired token (beyond 5-min drift window)", async () => {
    const expiredAt = new Date(Date.now() - 10 * 60 * 1000);
    mockDbWhere.mockResolvedValue([makeTournament({ exportTokenExpiresAt: expiredAt })]);
    const res = await request(app)
      .post("/api/tournaments/77/auction/mirror")
      .set("X-Export-Token", TOKEN)
      .send(VALID_MIRROR_BODY);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/expired/i);
  });

  it("accepts a token within the 5-minute clock-drift grace period", async () => {
    const edgeExpiry = new Date(Date.now() - 4 * 60 * 1000);
    mockDbWhere.mockResolvedValue([makeTournament({ exportTokenExpiresAt: edgeExpiry })]);
    const res = await request(app)
      .post("/api/tournaments/77/auction/mirror")
      .set("X-Export-Token", TOKEN)
      .send(VALID_MIRROR_BODY);
    // Should pass token validation (may fail at session logic, but not 401/403)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("mirror endpoint has no replay block — same token is reusable across calls", async () => {
    // Mirror is a high-frequency endpoint (called every 1-3s during live auction).
    // Unlike sync, it must NOT block reuse of the same valid token.
    const syncedAt = new Date(Date.now() - 30 * 1000);
    mockDbWhere.mockResolvedValue([makeTournament({ exportTokenSyncedAt: syncedAt })]);
    const res = await request(app)
      .post("/api/tournaments/77/auction/mirror")
      .set("X-Export-Token", TOKEN)
      .send(VALID_MIRROR_BODY);
    // exportTokenSyncedAt being set does NOT block mirror — only sync
    expect(res.status).not.toBe(409);
  });
});
