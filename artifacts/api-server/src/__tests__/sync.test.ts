import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── DB mock ──────────────────────────────────────────────────────────────────
// vi.hoisted runs before module-level code so the reference is valid inside
// the vi.mock factory below.
const { mockDbWhere, mockDbUpdateWhere, mockDbInsertValues } = vi.hoisted(() => ({
  mockDbWhere: vi.fn(),
  mockDbUpdateWhere: vi.fn().mockResolvedValue([]),
  mockDbInsertValues: vi.fn().mockResolvedValue([]),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mockDbWhere }) }),
    update: () => ({ set: () => ({ where: mockDbUpdateWhere }) }),
    insert: () => ({ values: mockDbInsertValues }),
  },
  pool: { query: vi.fn() },
  tournamentsTable: { id: {} },
  teamsTable: { id: {} },
  playersTable: { id: {} },
  bidsTable: {},
  categoriesTable: {},
}));

vi.mock("../lib/broadcast", () => ({ broadcastToTournament: vi.fn() }));
vi.mock("../lib/rate-limiters", () => ({
  exportLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  globalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ── Import router AFTER mocks are registered ─────────────────────────────────
import router from "../routes/tournaments";

// ── Helpers ───────────────────────────────────────────────────────────────────
const TOKEN = "a".repeat(64);
const FUTURE_EXPIRY = new Date(Date.now() + 48 * 60 * 60 * 1000);

function makeTournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 99,
    name: "Test Tournament",
    localModeEnabled: true,
    exportToken: TOKEN,
    exportTokenExpiresAt: FUTURE_EXPIRY,
    exportTokenSyncedAt: null,
    exportTokenLastMirrorAt: null,
    status: "active",
    ...overrides,
  };
}

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

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("POST /api/tournaments/:id/sync — token security", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  it("401 — missing X-Export-Token header", async () => {
    mockDbWhere.mockResolvedValue([makeTournament()]);
    const res = await request(app).post("/api/tournaments/99/sync").send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing X-Export-Token/i);
  });

  it("404 — tournament not found", async () => {
    mockDbWhere.mockResolvedValue([]);
    const res = await request(app)
      .post("/api/tournaments/9999/sync")
      .set("X-Export-Token", TOKEN)
      .send({});
    expect(res.status).toBe(404);
  });

  it("403 — tournament has no export token configured", async () => {
    mockDbWhere.mockResolvedValue([makeTournament({ exportToken: null })]);
    const res = await request(app)
      .post("/api/tournaments/99/sync")
      .set("X-Export-Token", TOKEN)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/No export token configured/i);
  });

  it("403 — wrong token value", async () => {
    mockDbWhere.mockResolvedValue([makeTournament()]);
    const res = await request(app)
      .post("/api/tournaments/99/sync")
      .set("X-Export-Token", "z".repeat(64))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Invalid export token/i);
  });

  it("403 — expired token (beyond 5-min drift window)", async () => {
    const expiredAt = new Date(Date.now() - 10 * 60 * 1000);
    mockDbWhere.mockResolvedValue([makeTournament({ exportTokenExpiresAt: expiredAt })]);
    const res = await request(app)
      .post("/api/tournaments/99/sync")
      .set("X-Export-Token", TOKEN)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/expired/i);
  });

  it("accepts a token within the 5-minute clock-drift grace period", async () => {
    const edgeExpiry = new Date(Date.now() - 4 * 60 * 1000);
    mockDbWhere.mockResolvedValue([makeTournament({ exportTokenExpiresAt: edgeExpiry })]);
    const res = await request(app)
      .post("/api/tournaments/99/sync")
      .set("X-Export-Token", TOKEN)
      .send({});
    // Should pass token validation — may fail later with 400 (invalid payload)
    // but NOT 401 or 403.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("409 — replay: token already used for a prior sync", async () => {
    const syncedAt = new Date(Date.now() - 60 * 1000);
    mockDbWhere.mockResolvedValue([makeTournament({ exportTokenSyncedAt: syncedAt })]);
    const res = await request(app)
      .post("/api/tournaments/99/sync")
      .set("X-Export-Token", TOKEN)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already been used for sync/i);
    expect(res.body.syncedAt).toBeTruthy();
  });

  it("stamps exportTokenSyncedAt on successful sync", async () => {
    mockDbWhere.mockResolvedValue([makeTournament()]);
    const validPayload = { playerResults: [], teamPurses: [], bids: [] };
    const res = await request(app)
      .post("/api/tournaments/99/sync")
      .set("X-Export-Token", TOKEN)
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // The final db.update() sets exportTokenSyncedAt; check it was called
    expect(mockDbUpdateWhere).toHaveBeenCalled();
  });
});
