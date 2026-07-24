import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";

const { mockGetBootMetricsSnapshot, mockGetRuntimeConfig, mockCollectRuntime } = vi.hoisted(() => ({
  mockGetBootMetricsSnapshot: vi.fn(),
  mockGetRuntimeConfig: vi.fn(),
  mockCollectRuntime: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  getBootMetricsSnapshot: mockGetBootMetricsSnapshot,
  pool: { totalCount: 2, idleCount: 1, waitingCount: 0 },
}));

vi.mock("../lib/runtime-env.js", () => ({
  getRuntimeConfig: mockGetRuntimeConfig,
}));

vi.mock("../lib/diagnostics/collect-runtime-diagnostics.js", () => ({
  collectRuntimeDiagnostics: mockCollectRuntime,
}));

import diagnosticsRouter from "../routes/diagnostics";

function buildApp(jwtUser?: Record<string, unknown>) {
  const app = express();
  app.use((req, _res, next) => {
    // requireMasterAdmin logs on deny; tests don't mount pino-http.
    (req as Request & { log?: { warn: (...args: unknown[]) => void; info: (...args: unknown[]) => void } }).log = {
      warn: () => undefined,
      info: () => undefined,
    };
    if (jwtUser) (req as Request & { jwtUser?: unknown }).jwtUser = jwtUser;
    next();
  });
  app.use("/api", diagnosticsRouter);
  return app;
}

describe("GET /api/auth/admin/diagnostics/startup", () => {
  beforeEach(() => {
    mockGetBootMetricsSnapshot.mockReset();
    mockGetRuntimeConfig.mockReset();
    mockCollectRuntime.mockReset();
    mockGetRuntimeConfig.mockReturnValue({
      databaseUrl: "postgresql://owner:secret@ep-abc.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    });
    mockCollectRuntime.mockReturnValue({
      process: {
        serverStartTime: "2026-07-11T12:00:00.000Z",
        uptimeSeconds: 90,
        uptimeHuman: "1m 30s",
        pid: 99,
        nodeVersion: process.version,
        nodeEnv: "production",
        gitBranch: "develop",
      },
      memory: {
        rssBytes: 1,
        heapUsedBytes: 1,
        heapTotalBytes: 1,
        rssMb: 10,
        heapUsedMb: 5,
        heapTotalMb: 8,
      },
      eventLoopDelayMs: null,
      redis: {
        configured: true,
        status: "ready",
        initAttempted: true,
        commandClientStatus: "ready",
        subscriberClientStatus: "ready",
      },
      sse: {
        status: "active",
        auctionClients: 2,
        scoringClients: 0,
        badmintonClients: 1,
        totalClients: 3,
      },
      databaseConnection: {
        status: "pool_active",
        totalCount: 2,
        idleCount: 1,
        waitingCount: 0,
      },
    });
    mockGetBootMetricsSnapshot.mockReturnValue({
      systemC: {
        executionTimeMs: 200,
        createStatements: 1,
        alterStatements: 1,
        createIndexStatements: 1,
        dropStatements: 0,
        dmlStatements: 0,
        queryBatches: 24,
        failures: 0,
      },
      systemD: {
        executionTimeMs: 100,
        queryCount: 9,
        success: true,
        failure: false,
      },
      systemCSettled: true,
      summaryPrinted: true,
      ready: true,
      totalDatabaseBootTimeMs: 250,
    });
  });

  it("returns 403 when unauthenticated", async () => {
    const res = await request(buildApp()).get("/api/auth/admin/diagnostics/startup");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Super Admin|authoris/i);
  });

  it("returns 403 for data-entry admin", async () => {
    const res = await request(
      buildApp({ isAdmin: true, adminLevel: "data" }),
    ).get("/api/auth/admin/diagnostics/startup");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Super Admin access required");
  });

  it("returns 200 ready payload for master admin including v2 fields", async () => {
    process.env.APP_DOMAIN = "bidwar-staging.onrender.com";
    process.env.APP_URL = "https://bidwar-staging.onrender.com";
    process.env.NODE_ENV = "production";

    const res = await request(
      buildApp({ isAdmin: true, adminLevel: "master" }),
    ).get("/api/auth/admin/diagnostics/startup");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.startup.ready).toBe(true);
    expect(res.body.process.pid).toBe(99);
    expect(res.body.process.gitBranch).toBe("develop");
    expect(res.body.memory.rssMb).toBe(10);
    expect(res.body.redis.status).toBe("ready");
    expect(res.body.sse.totalClients).toBe(3);
    expect(res.body.databaseConnection.status).toBe("pool_active");
    expect(res.body.eventLoopDelayMs).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(JSON.stringify(res.body)).not.toMatch(/DATABASE_URL/i);
  });

  it("returns ready=false when boot metrics are incomplete", async () => {
    mockGetBootMetricsSnapshot.mockReturnValue({
      systemC: null,
      systemD: null,
      systemCSettled: false,
      summaryPrinted: false,
      ready: false,
      totalDatabaseBootTimeMs: null,
    });

    const res = await request(
      buildApp({ isAdmin: true, adminLevel: "master" }),
    ).get("/api/auth/admin/diagnostics/startup");

    expect(res.status).toBe(200);
    expect(res.body.startup.ready).toBe(false);
    expect(res.body.startup.reason).toMatch(/settling/i);
  });
});
