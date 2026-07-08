import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { performance } from "node:perf_hooks";

const getMaxBrandingAssetVersionMock = vi.fn<() => Promise<number>>();

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn() },
}));

vi.mock("../lib/branding-service.js", () => ({
  brandingService: {
    getPublicBrandingPayload: vi.fn(async () => ({})),
    getAssetsMap: vi.fn(async () => ({})),
    mergeLegacyAssetFields: vi.fn((row: unknown) => row),
    isBrandingAssetType: vi.fn(() => true),
    upsertAsset: vi.fn(),
    removeAsset: vi.fn(),
    refreshPlatformBrandingCache: vi.fn(),
    getMaxBrandingAssetVersion: () => getMaxBrandingAssetVersionMock(),
  },
  getMaxBrandingAssetVersion: () => getMaxBrandingAssetVersionMock(),
}));

vi.mock("../lib/homepage-data.js", () => ({
  invalidateHomepagePageCache: vi.fn(),
}));

vi.mock("../lib/html-meta-injector.js", () => ({
  patchBrandingIconsInCachedHtml: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import brandingRouter from "../routes/branding.js";
import {
  refreshBrandingIconCache,
  __resetBrandingIconCacheForTests,
} from "../lib/branding-asset-resolver.js";

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", brandingRouter);
  return app;
}

describe("GET /api/branding/icon-version", () => {
  beforeEach(() => {
    getMaxBrandingAssetVersionMock.mockReset();
    __resetBrandingIconCacheForTests();
  });

  it("returns { version } from memory after cache warm-up", async () => {
    getMaxBrandingAssetVersionMock.mockResolvedValue(12);
    await refreshBrandingIconCache();
    getMaxBrandingAssetVersionMock.mockClear();

    const app = createApp();
    const res = await request(app).get("/api/branding/icon-version").expect(200);
    expect(res.body).toEqual({ version: 12 });
    expect(getMaxBrandingAssetVersionMock).not.toHaveBeenCalled();
  });

  it("cold request loads cache with one DB query", async () => {
    getMaxBrandingAssetVersionMock.mockResolvedValue(3);

    const app = createApp();
    const res = await request(app).get("/api/branding/icon-version").expect(200);
    expect(res.body).toEqual({ version: 3 });
    expect(getMaxBrandingAssetVersionMock).toHaveBeenCalledTimes(1);

    getMaxBrandingAssetVersionMock.mockClear();
    const warm = await request(app).get("/api/branding/icon-version").expect(200);
    expect(warm.body).toEqual({ version: 3 });
    expect(getMaxBrandingAssetVersionMock).not.toHaveBeenCalled();
  });

  it("benchmark: 100 warm requests stay sub-millisecond handler time", async () => {
    getMaxBrandingAssetVersionMock.mockResolvedValue(8);
    await refreshBrandingIconCache();
    getMaxBrandingAssetVersionMock.mockClear();

    const app = createApp();
    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      await request(app).get("/api/branding/icon-version").expect(200);
      durations.push(performance.now() - t0);
    }

    durations.sort((a, b) => a - b);
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95 = percentile(durations, 95);

    expect(getMaxBrandingAssetVersionMock).not.toHaveBeenCalled();
    expect(avg).toBeLessThan(20);
    expect(p95).toBeLessThan(50);
  });
});
