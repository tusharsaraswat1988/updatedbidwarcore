import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn() },
  pool: { query: vi.fn() },
  tournamentsTable: {},
  intelligenceArchivesTable: {},
}));

vi.mock("../lib/rate-limiters", () => ({
  globalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  heavyLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import intelligenceRouter from "../routes/intelligence";
import settingsRouter from "../routes/settings";

/** Mirrors artifacts/api-server/src/routes/index.ts mount order. */
function mountLikeProduction(app: express.Express) {
  app.use("/api", intelligenceRouter);
  app.use("/api", settingsRouter);
}

describe("public settings routes", () => {
  it("GET /api/settings/features is public even when intelligence router is mounted first", async () => {
    process.env.SCORING = "true";
    const app = express();
    mountLikeProduction(app);

    const res = await request(app).get("/api/settings/features");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      scoring: true,
      badminton: true,
      cricket: true,
    });
  });
});
