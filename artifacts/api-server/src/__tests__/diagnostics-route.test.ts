import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";

const { mockGetBootMetricsSnapshot, mockGetRuntimeConfig } = vi.hoisted(() => ({
  mockGetBootMetricsSnapshot: vi.fn(),
  mockGetRuntimeConfig: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  getBootMetricsSnapshot: mockGetBootMetricsSnapshot,
}));

vi.mock("../lib/runtime-env.js", () => ({
  getRuntimeConfig: mockGetRuntimeConfig,
}));

import diagnosticsRouter from "../routes/diagnostics";

function buildApp(jwtUser?: Record<string, unknown>) {
  const app = express();
  app.use((req, _res, next) => {
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
    mockGetRuntimeConfig.mockReturnValue({
      databaseUrl: "postgresql://owner:secret@ep-abc.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
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

  it("returns 401 when unauthenticated", async () => {
    const res = await request(buildApp()).get("/api/auth/admin/diagnostics/startup");
    expect(res.status).toBe(403);
    // requireMasterAdmin returns 403 when jwt missing/not master (isAdmin falsy)
    expect(res.body.error).toMatch(/Super Admin|authoris/i);
  });

  it("returns 403 for data-entry admin", async () => {
    const res = await request(
      buildApp({ isAdmin: true, adminLevel: "data" }),
    ).get("/api/auth/admin/diagnostics/startup");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Super Admin access required");
  });

  it("returns 200 ready payload for master admin", async () => {
    process.env.APP_DOMAIN = "bidwar-staging.onrender.com";
    process.env.APP_URL = "https://bidwar-staging.onrender.com";
    process.env.NODE_ENV = "production";

    const res = await request(
      buildApp({ isAdmin: true, adminLevel: "master" }),
    ).get("/api/auth/admin/diagnostics/startup");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.startup.ready).toBe(true);
    expect(res.body.startup.startupDdlBatches).toBe(33);
    expect(res.body.startup.systemC.executionTimeMs).toBe(200);
    expect(res.body.startup.systemD.executionTimeMs).toBe(100);
    expect(res.body.database.databaseName).toBe("neondb");
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
