import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assertRuntimeEnv, getRuntimeConfig, getSessionSecret, resetRuntimeConfigForTests } from "../lib/runtime-env";
import { signSponsorDisplaySession, verifySponsorDisplaySession } from "../lib/sponsor-display-session";
import {
  getSponsorMediaReadiness,
  recordSponsorMediaReadiness,
  resetSponsorMediaReadinessForTests,
  surfaceReadyFor,
} from "../lib/sponsor-media-readiness";
import { listSponsorMediaSlots } from "../lib/sponsor-media-service";
import sponsorMediaRouter from "../routes/sponsor-media";

vi.mock("../lib/sponsor-media-service", () => ({
  listSponsorMediaSlots: vi.fn(),
  getSponsorMediaSlot: vi.fn(),
  beginSponsorMediaProcessing: vi.fn(),
  deleteSponsorMediaAssets: vi.fn(),
  toSponsorMediaView: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use(sponsorMediaRouter);

function readyBody(version: number, surface: "obs" | "led" = "obs") {
  return {
    surface,
    slots: [{ slotNumber: 2, version, status: "ready" }],
    playback: { status: "idle", slotNumber: null, cueId: null },
  };
}

beforeAll(() => {
  try {
    getRuntimeConfig();
  } catch {
    process.env.NODE_ENV ??= "test";
    process.env.BIDWAR_ENV ??= "local";
    process.env.PORT ??= "3000";
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/test_db";
    process.env.SESSION_SECRET ??= "x".repeat(32);
    process.env.ADMIN_PASSWORD ??= "test-admin-password";
    process.env.APP_DOMAIN ??= "localhost";
    process.env.APP_URL ??= "http://localhost:3000";
    resetRuntimeConfigForTests();
    assertRuntimeEnv();
  }
});

beforeEach(() => {
  resetSponsorMediaReadinessForTests();
  vi.mocked(listSponsorMediaSlots).mockResolvedValue([
    {
      id: 9,
      tournamentId: 10,
      slotNumber: 2,
      version: 5,
      processingStatus: "ready",
      active: true,
    },
  ] as never);
});

describe("sponsor display readiness auth", () => {
  it("rejects an unauthenticated readiness report", async () => {
    const response = await request(app)
      .post("/tournaments/10/scoring/sponsor-media/readiness")
      .send(readyBody(5));
    expect(response.status).toBe(401);
    expect(getSponsorMediaReadiness(10).obs).toBeNull();
  });

  it("rejects a user session presented as a display", async () => {
    const token = jwt.sign({ purpose: "scorer", scorerId: 1, sessionId: "s" }, getSessionSecret());
    const response = await request(app)
      .post("/tournaments/10/scoring/sponsor-media/readiness")
      .set("authorization", `Bearer ${token}`)
      .send(readyBody(5));
    expect(response.status).toBe(401);
  });

  it("rejects an LED session that claims to be OBS", async () => {
    const token = signSponsorDisplaySession({ tournamentId: 10, surface: "led" });
    const response = await request(app)
      .post("/tournaments/10/scoring/sponsor-media/readiness")
      .set("authorization", `Bearer ${token}`)
      .send(readyBody(5, "obs"));
    expect(response.status).toBe(403);
    expect(getSponsorMediaReadiness(10).obs).toBeNull();
    expect(getSponsorMediaReadiness(10).led).toBeNull();
  });

  it("rejects a display session for a different tournament", async () => {
    const token = signSponsorDisplaySession({ tournamentId: 10, surface: "obs" });
    const response = await request(app)
      .post("/tournaments/11/scoring/sponsor-media/readiness")
      .set("authorization", `Bearer ${token}`)
      .send(readyBody(5));
    expect(response.status).toBe(403);
    expect(getSponsorMediaReadiness(11).obs).toBeNull();
  });

  it("accepts the matching OBS display for the current version only", async () => {
    const token = signSponsorDisplaySession({ tournamentId: 10, surface: "obs" });
    const response = await request(app)
      .post("/tournaments/10/scoring/sponsor-media/readiness")
      .set("authorization", `Bearer ${token}`)
      .send(readyBody(5));
    expect(response.status).toBe(200);
    const readiness = getSponsorMediaReadiness(10);
    expect(surfaceReadyFor(readiness.obs, 2, 5)).toBe(true);
    expect(readiness.led).toBeNull();
  });

  it("does not treat a version 4 report as ready for version 5", async () => {
    const token = signSponsorDisplaySession({ tournamentId: 10, surface: "obs" });
    const response = await request(app)
      .post("/tournaments/10/scoring/sponsor-media/readiness")
      .set("authorization", `Bearer ${token}`)
      .send(readyBody(4));
    expect(response.status).toBe(200);
    const readiness = getSponsorMediaReadiness(10);
    expect(surfaceReadyFor(readiness.obs, 2, 5)).toBe(false);
    expect(surfaceReadyFor(readiness.obs, 2, 4)).toBe(false);
  });

  it("keeps the display token valid after in-memory readiness is cleared", async () => {
    const token = signSponsorDisplaySession({ tournamentId: 10, surface: "obs" });
    expect(verifySponsorDisplaySession(token)?.surface).toBe("obs");
    resetSponsorMediaReadinessForTests();
    expect(getSponsorMediaReadiness(10).obs).toBeNull();
    expect(verifySponsorDisplaySession(token)?.tournamentId).toBe(10);
    const response = await request(app)
      .post("/tournaments/10/scoring/sponsor-media/readiness")
      .set("authorization", `Bearer ${token}`)
      .send(readyBody(5));
    expect(response.status).toBe(200);
    expect(surfaceReadyFor(getSponsorMediaReadiness(10).obs, 2, 5)).toBe(true);
  });

  it("drops a silent screen without clearing the other", () => {
    const now = 5_000_000;
    const playback = { status: "idle" as const, slotNumber: null, cueId: null };
    recordSponsorMediaReadiness(10, {
      surface: "obs",
      reportedAt: now,
      slots: [{ slotNumber: 2, version: 5, status: "ready" }],
      playback,
    });
    recordSponsorMediaReadiness(10, {
      surface: "led",
      reportedAt: now - 31_000,
      slots: [{ slotNumber: 2, version: 5, status: "ready" }],
      playback,
    });
    const readiness = getSponsorMediaReadiness(10, now);
    expect(surfaceReadyFor(readiness.obs, 2, 5)).toBe(true);
    expect(readiness.led).toBeNull();
  });
});
