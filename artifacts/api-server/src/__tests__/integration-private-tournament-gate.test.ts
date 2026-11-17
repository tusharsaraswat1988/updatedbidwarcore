import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { guardPrivateTournamentSpectator } from "../middleware/private-tournament-gate";

// Mock the organizer check middleware to avoid DB dependency in this test
vi.mock("../middleware/require-organizer", () => ({
  canAccessPrivateTournamentData: vi.fn().mockResolvedValue(false),
}));

const app = express();
app.use(express.json());

// Dummy endpoint to test the guard
app.get("/test-gate", async (req, res) => {
  const tournament = { 
    id: 1, 
    scoringPin: "secret",
    featuresJson: { visibility: "private" } 
  };
  if (!(await guardPrivateTournamentSpectator(req, res, tournament as any))) return;
  res.status(200).json({ message: "authorized" });
});

describe("P0 — Integration: guardPrivateTournamentSpectator", () => {
  it("rejects without PIN header (403)", async () => {
    const res = await request(app).get("/test-gate");
    expect(res.status).toBe(403);
  });

  it("rejects with wrong PIN header (403)", async () => {
    const res = await request(app)
      .get("/test-gate")
      .set("x-bidwar-pin", "wrong");
    expect(res.status).toBe(403);
  });

  it("allows with correct PIN header (200)", async () => {
    const res = await request(app)
      .get("/test-gate")
      .set("x-bidwar-pin", "secret");
    expect(res.status).toBe(200);
  });

  it("rejects PIN in query string (403)", async () => {
    const res = await request(app)
      .get("/test-gate?pin=secret");
    expect(res.status).toBe(403);
    // This expects the error message from the middleware update
    expect(res.body.error).toContain("x-bidwar-pin header");
  });

  it("sets no-store headers", async () => {
    const res = await request(app).get("/test-gate");
    expect(res.headers["cache-control"]).toContain("no-store");
  });
});
