import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import type { Express } from "express";

let app: Express;
let assertFanPlatformBuild: (path: string) => void;

beforeAll(async () => {
  process.env.SERVE_STATIC = "true";
  await import("../lib/bootstrap.js");
  const runtimeEnv = await import("../lib/runtime-env.js");
  assertFanPlatformBuild = runtimeEnv.assertFanPlatformBuild;
  const appModule = await import("../app.js");
  app = appModule.default;
});

describe("Fan Platform Host-Based Routing & SPA Fallback", () => {
  it("serves Fan Platform HTML on GET / when Host is fan.bidwar.in", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app)
      .get("/")
      .set("Host", "fan.bidwar.in");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("<title>BidWar Fan Platform</title>");
    // Crucial: Must NOT have been served by the auction marketing SSR renderer
    expect(res.headers["x-bidwar-ssr"]).toBeUndefined();
  });

  it("serves Fan Platform HTML on GET / when X-Forwarded-Host is fan.bidwar.in", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app)
      .get("/")
      .set("X-Forwarded-Host", "fan.bidwar.in");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("<title>BidWar Fan Platform</title>");
    expect(res.headers["x-bidwar-ssr"]).toBeUndefined();
  });

  it("serves Fan Platform SPA fallback on direct tournament slug route (/VYAPARI)", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app)
      .get("/VYAPARI")
      .set("Host", "fan.bidwar.in");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("<title>BidWar Fan Platform</title>");
    expect(res.text).not.toContain("Page Not Found | BidWar");
  });

  it("serves Fan Platform SPA fallback on direct tournament slug route with query string (/VS581307?tab=matches)", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app)
      .get("/VS581307?tab=matches")
      .set("Host", "fan.bidwar.in");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("<title>BidWar Fan Platform</title>");
  });

  it("returns HTTP 404 for missing static asset files rather than falling back to index.html", async () => {
    const request = (await import("supertest")).default;
    const resJs = await request(app)
      .get("/assets/non-existent-chunk.js")
      .set("Host", "fan.bidwar.in");

    expect(resJs.status).toBe(404);
    expect(resJs.text).not.toContain("<title>BidWar Fan Platform</title>");

    const resPng = await request(app)
      .get("/assets/non-existent-logo.png")
      .set("Host", "fan.bidwar.in");

    expect(resPng.status).toBe(404);
    expect(resPng.text).not.toContain("<title>BidWar Fan Platform</title>");
  });

  it("does not intercept API endpoints on fan.bidwar.in", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app)
      .get("/api/healthz")
      .set("Host", "fan.bidwar.in");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toHaveProperty("status", "ok");
  });

  it("preserves auction marketing homepage on bidwar.in (no fan interception)", async () => {
    const request = (await import("supertest")).default;
    const res = await request(app)
      .get("/")
      .set("Host", "bidwar.in");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).not.toContain("<title>BidWar Fan Platform</title>");
  });
});

describe("assertFanPlatformBuild runtime assertion", () => {
  it("does not throw if fan-platform dist and index.html exist", () => {
    const validFanDist = path.resolve(__dirname, "../../fan-platform/dist");
    if (fs.existsSync(validFanDist)) {
      expect(() => assertFanPlatformBuild(validFanDist)).not.toThrow();
    }
  });

  it("does not throw if serveStatic is false or not in production", () => {
    const fakeDist = path.resolve(__dirname, "../../non-existent-fan-platform/dist");
    expect(() => assertFanPlatformBuild(fakeDist)).not.toThrow();
  });

  it("throws clear error when fan-platform directory is missing in production with serveStatic", async () => {
    const runtimeEnv = await import("../lib/runtime-env.js");
    const origConfig = runtimeEnv.getRuntimeConfig();
    
    // Temporarily mock isProduction and serveStatic to true
    const fakeDist = path.resolve(__dirname, "../../non-existent-fan-platform/dist");
    try {
      // In production mode, missing fanDist must throw
      (origConfig as any).isProduction = true;
      (origConfig as any).serveStatic = true;
      expect(() => runtimeEnv.assertFanPlatformBuild(fakeDist)).toThrow(/fan-platform build directory was not found/);
    } finally {
      (origConfig as any).isProduction = false;
      (origConfig as any).serveStatic = true;
    }
  });
});
