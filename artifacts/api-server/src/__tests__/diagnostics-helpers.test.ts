import { describe, it, expect } from "vitest";
import { maskDatabaseUrl, maskHostname } from "../lib/diagnostics/mask-database-url";
import { classifyEnvironment } from "../lib/diagnostics/classify-environment";
import { buildStartupDiagnosticsPayload } from "../lib/diagnostics/build-startup-payload";
import type { BootMetricsSnapshot } from "@workspace/db/boot-metrics";
import type { RuntimeDiagnostics } from "../lib/diagnostics/collect-runtime-diagnostics";

const runtimeFixture: RuntimeDiagnostics = {
  process: {
    serverStartTime: "2026-07-11T12:00:00.000Z",
    uptimeSeconds: 120,
    uptimeHuman: "2m 0s",
    pid: 4242,
    nodeVersion: "v22.0.0",
    nodeEnv: "production",
    gitBranch: "develop",
  },
  memory: {
    rssBytes: 100_000_000,
    heapUsedBytes: 40_000_000,
    heapTotalBytes: 60_000_000,
    rssMb: 95.4,
    heapUsedMb: 38.1,
    heapTotalMb: 57.2,
  },
  eventLoopDelayMs: null,
  redis: {
    configured: false,
    status: "disabled",
    initAttempted: true,
    commandClientStatus: null,
    subscriberClientStatus: null,
  },
  sse: {
    status: "idle",
    auctionClients: 0,
    scoringClients: 0,
    badmintonClients: 0,
    totalClients: 0,
  },
  databaseConnection: {
    status: "pool_idle",
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0,
  },
};

describe("maskDatabaseUrl", () => {
  it("masks host and returns database name without credentials", () => {
    const result = maskDatabaseUrl(
      "postgresql://neondb_owner:s3cret-pass@ep-long-sky-aorboyzr-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
    );
    expect(result.databaseName).toBe("neondb");
    expect(result.sslModePresent).toBe(true);
    expect(result.hostMasked).not.toContain("s3cret");
    expect(result.hostMasked).not.toContain("neondb_owner");
    expect(result.hostMasked).toContain("****");
    expect(result.hostMasked).toMatch(/neon\.tech$/);
  });

  it("never echoes password material in any field", () => {
    const secret = "SuperSecretPassword99!";
    const result = maskDatabaseUrl(
      `postgres://user:${encodeURIComponent(secret)}@db.example.com:5432/appdb`,
    );
    const joined = JSON.stringify(result);
    expect(joined).not.toContain(secret);
    expect(joined).not.toContain("user");
    expect(result.databaseName).toBe("appdb");
  });
});

describe("maskHostname", () => {
  it("redacts early labels on neon-style hosts", () => {
    const masked = maskHostname("ep-long-sky-aorboyzr-pooler.c-2.ap-southeast-1.aws.neon.tech");
    expect(masked.startsWith("ep-****")).toBe(true);
    expect(masked).toContain("ap-southeast-1.aws.neon.tech");
    expect(masked).not.toContain("long-sky");
  });
});

describe("classifyEnvironment", () => {
  it("classifies localhost as local", () => {
    expect(
      classifyEnvironment({
        nodeEnv: "development",
        appDomain: "localhost",
        appUrl: "http://localhost:3000",
      }),
    ).toBe("local");
  });

  it("classifies bidwar-staging as staging", () => {
    expect(
      classifyEnvironment({
        nodeEnv: "production",
        appDomain: "bidwar-staging.onrender.com",
        appUrl: "https://bidwar-staging.onrender.com",
      }),
    ).toBe("staging");
  });

  it("classifies bidwar.in as production", () => {
    expect(
      classifyEnvironment({
        nodeEnv: "production",
        appDomain: "bidwar.in",
        appUrl: "https://bidwar.in",
      }),
    ).toBe("production");
  });

  it("honors BIDWAR_ENV override", () => {
    expect(
      classifyEnvironment({
        bidwarEnv: "staging",
        nodeEnv: "production",
        appDomain: "bidwar.in",
        appUrl: "https://bidwar.in",
      }),
    ).toBe("staging");
  });
});

describe("buildStartupDiagnosticsPayload", () => {
  const readySnapshot: BootMetricsSnapshot = {
    systemC: {
      executionTimeMs: 100,
      createStatements: 1,
      alterStatements: 2,
      createIndexStatements: 3,
      dropStatements: 0,
      dmlStatements: 1,
      queryBatches: 24,
      failures: 0,
    },
    systemD: {
      executionTimeMs: 50,
      queryCount: 9,
      success: true,
      failure: false,
    },
    systemCSettled: true,
    summaryPrinted: true,
    ready: true,
    totalDatabaseBootTimeMs: 120,
  };

  it("returns ready payload with derived batch and failure counts", () => {
    const payload = buildStartupDiagnosticsPayload({
      snapshot: readySnapshot,
      databaseUrl: "postgresql://u:p@db.example.com/mydb?sslmode=require",
      runtime: runtimeFixture,
      appDomain: "bidwar-staging.onrender.com",
      appUrl: "https://bidwar-staging.onrender.com",
      nodeEnv: "production",
      now: new Date("2026-07-11T13:20:00.000Z"),
    });

    expect(payload.ok).toBe(true);
    expect(payload.startup.ready).toBe(true);
    expect(payload.startup.startupDdlBatches).toBe(33);
    expect(payload.startup.startupFailures).toBe(0);
    expect(payload.startup.totalDatabaseBootTimeMs).toBe(120);
    expect(payload.environment).toBe("staging");
    expect(payload.process.pid).toBe(4242);
    expect(payload.process.nodeVersion).toBe("v22.0.0");
    expect(payload.build.gitBranch).toBe("develop");
    expect(payload.memory.rssMb).toBe(95.4);
    expect(payload.redis.status).toBe("disabled");
    expect(payload.sse.status).toBe("idle");
    expect(payload.databaseConnection.status).toBe("pool_idle");
    expect(payload.eventLoopDelayMs).toBeNull();
    expect(JSON.stringify(payload)).not.toMatch(/password|DATABASE_URL|s3cret/i);
    expect(payload.database.hostMasked).not.toContain("u:p");
  });

  it("returns ready=false when metrics are settling", () => {
    const settling: BootMetricsSnapshot = {
      systemC: null,
      systemD: {
        executionTimeMs: 10,
        queryCount: 9,
        success: true,
        failure: false,
      },
      systemCSettled: false,
      summaryPrinted: false,
      ready: false,
      totalDatabaseBootTimeMs: null,
    };

    const payload = buildStartupDiagnosticsPayload({
      snapshot: settling,
      databaseUrl: "postgresql://u:p@localhost/db",
      runtime: runtimeFixture,
      nodeEnv: "development",
      appDomain: "localhost",
    });

    expect(payload.startup.ready).toBe(false);
    expect(payload.startup.reason).toMatch(/settling/i);
    expect(payload.startup.startupDdlBatches).toBeNull();
    expect(payload.startup.startupFailures).toBeNull();
  });
});
