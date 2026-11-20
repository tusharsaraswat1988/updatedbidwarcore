import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express;

let mockTournaments: Array<{ id: number; auctionCode: string | null; name: string; licenseStatus: string }> = [
  { id: 25, auctionCode: "VN830108", name: "Varun Premier League", licenseStatus: "active" },
  { id: 101, auctionCode: "VYAPARI", name: "Vyapari Cricket League", licenseStatus: "active" },
  { id: 202, auctionCode: "RC732504", name: "Royal Cup", licenseStatus: "trial" },
];

function chunkHasValue(chunk: any, t: { id: number; auctionCode: string | null }): boolean {
  if (!chunk) return false;
  const v = chunk?.value !== undefined ? chunk.value : chunk;
  if (v === t.id || String(v) === String(t.id)) return true;
  if (typeof v === "string" && t.auctionCode && v.toUpperCase() === t.auctionCode.toUpperCase()) return true;
  if (chunk?.queryChunks && Array.isArray(chunk.queryChunks)) {
    for (const sub of chunk.queryChunks) {
      if (chunkHasValue(sub, t)) return true;
    }
  }
  return false;
}

function matchesCondition(t: { id: number; auctionCode: string | null }, cond: any): boolean {
  if (!cond) return false;
  if (cond?.right === t.id || String(cond?.right) === String(t.id)) return true;
  if (t.auctionCode && String(cond?.right).toUpperCase() === t.auctionCode.toUpperCase()) return true;

  if (Array.isArray(cond?.queryChunks)) {
    for (const chunk of cond.queryChunks) {
      if (chunkHasValue(chunk, t)) return true;
    }
  }
  if (Array.isArray(cond?.conditions)) {
    for (const c of cond.conditions) {
      if (matchesCondition(t, c)) return true;
    }
  }
  return false;
}

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  const mockDb = {
    ...((actual.db as any) ?? {}),
    select: vi.fn((_fields?: unknown) => ({
      from: vi.fn((_table: unknown) => ({
        where: vi.fn((condition: any) => {
          const results = mockTournaments.filter((t) => matchesCondition(t, condition));

          return {
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn((limitNum: number) => Promise.resolve(results.slice(0, limitNum))),
            then: (resolve: any) => resolve(results),
          };
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn((limitNum: number) => Promise.resolve(mockTournaments.slice(0, limitNum))),
        then: (resolve: any) => resolve(mockTournaments),
      })),
    })),
  };

  return {
    ...actual,
    db: mockDb,
    createPgClient: vi.fn(() => ({
      on: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.BIDWAR_ENV = "local";
  process.env.PORT = "3000";
  process.env.APP_DOMAIN = "bidwar.in,fan.bidwar.in";
  process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/bidwar";
  process.env.SESSION_SECRET = "12345678901234567890123456789012";
  process.env.ADMIN_PASSWORD = "test-admin-password";
  process.env.APP_URL = "https://bidwar.in";
  process.env.SERVE_STATIC = "true";

  const { assertRuntimeEnv } = await import("../lib/runtime-env.js");
  assertRuntimeEnv();

  const appModule = await import("../app.js");
  app = appModule.default;
}, 30000);

describe("BIDWAR FAN PLATFORM SEO — PHASE 1: Crawl Foundation & Host Isolation", () => {
  beforeEach(() => {
    mockTournaments = [
      { id: 25, auctionCode: "VN830108", name: "Varun Premier League", licenseStatus: "active" },
      { id: 101, auctionCode: "VYAPARI", name: "Vyapari Cricket League", licenseStatus: "active" },
      { id: 202, auctionCode: "RC732504", name: "Royal Cup", licenseStatus: "trial" },
    ];
  });

  // 1. Host fan.bidwar.in receives Fan robots.txt
  describe("Requirement 1: Host fan.bidwar.in receives Fan robots.txt", () => {
    it("returns 200 with text/plain and fan-specific directives", async () => {
      const res = await request(app)
        .get("/robots.txt")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toContain("User-agent: *");
      expect(res.text).toContain("Allow: /");
      expect(res.text).toContain("Disallow: /api/");
      expect(res.text).toContain("Sitemap: https://fan.bidwar.in/sitemap-index.xml");
    });
  });

  // 2. Fan robots references only the Fan sitemap
  describe("Requirement 2: Fan robots references only the Fan sitemap", () => {
    it("references strictly fan.bidwar.in/sitemap-index.xml and not marketing sitemaps", async () => {
      const res = await request(app)
        .get("/robots.txt")
        .set("Host", "fan.bidwar.in");

      expect(res.text).toContain("https://fan.bidwar.in/sitemap-index.xml");
      expect(res.text).not.toContain("https://bidwar.in/sitemap-index.xml");
      expect(res.text).not.toContain("sitemap-pages.xml");
      expect(res.text).not.toContain("sitemap-academy.xml");
      expect(res.text).not.toContain("sitemap-blog.xml");
    });
  });

  // 3. Fan robots does not inherit marketing disallow/allow rules
  describe("Requirement 3: Fan robots does not inherit marketing disallow/allow rules", () => {
    it("does not contain /tournament/ or marketing commercial paths", async () => {
      const res = await request(app)
        .get("/robots.txt")
        .set("Host", "fan.bidwar.in");

      expect(res.text).not.toContain("Disallow: /tournament/");
      expect(res.text).not.toContain("Disallow: /admin");
      expect(res.text).not.toContain("Disallow: /organizer");
      expect(res.text).not.toContain("Allow: /pricing");
      expect(res.text).not.toContain("Allow: /bpl");
      expect(res.text).not.toContain("Allow: /academy");
      expect(res.text).not.toContain("Allow: /sports-auction-software");
    });
  });

  // 4. Host bidwar.in retains its existing robots response
  describe("Requirement 4: Host bidwar.in retains its existing robots response", () => {
    it("preserves marketing robots.txt with marketing allow/disallow rules and apex sitemap", async () => {
      const res = await request(app)
        .get("/robots.txt")
        .set("Host", "bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain("Sitemap: https://bidwar.in/sitemap-index.xml");
      expect(res.text).toContain("Disallow: /tournament/");
      expect(res.text).toContain("Disallow: /admin");
      expect(res.text).toContain("Allow: /pricing");
      expect(res.text).toContain("Allow: /bpl");
      expect(res.text).toContain("Allow: /academy");
    });
  });

  // 5. Fan sitemap index is valid XML and host-correct
  describe("Requirement 5: Fan sitemap index is valid XML and host-correct", () => {
    it("serves valid XML sitemap index pointing exclusively to fan child sitemaps", async () => {
      const res = await request(app)
        .get("/sitemap-index.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/xml");
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(res.text).toContain("<loc>https://fan.bidwar.in/sitemap-tournaments.xml</loc>");
      expect(res.text).not.toContain("sitemap-pages.xml");
      expect(res.text).not.toContain("https://bidwar.in/");
    });

    it("serves temporary valid empty tournament sitemap", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/xml");
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    });

    it("redirects legacy /sitemap.xml to /sitemap-index.xml with 301", async () => {
      const res = await request(app)
        .get("/sitemap.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(301);
      expect(res.headers.location).toBe("/sitemap-index.xml");
    });

    it("returns 404 for marketing child sitemaps requested on fan domain", async () => {
      const resPages = await request(app)
        .get("/sitemap-pages.xml")
        .set("Host", "fan.bidwar.in");
      expect(resPages.status).toBe(404);

      const resAcademy = await request(app)
        .get("/sitemap-academy.xml")
        .set("Host", "fan.bidwar.in");
      expect(resAcademy.status).toBe(404);

      const resBlog = await request(app)
        .get("/sitemap-blog.xml")
        .set("Host", "fan.bidwar.in");
      expect(resBlog.status).toBe(404);
    });
  });

  // 6. Unknown Fan tournament URL returns genuine 404
  describe("Requirement 6: Unknown Fan tournament URL returns genuine 404", () => {
    it("isTournamentExisting returns false for nonexistent slug", async () => {
      const { isTournamentExisting } = await import("../lib/fan-seo-policy.js");
      const exists = await isTournamentExisting("nonexistent-slug-xyz123");
      expect(exists).toBe(false);
    });

    it("returns HTTP 404 with lightweight HTML error document containing noindex", async () => {
      const res = await request(app)
        .get("/nonexistent-slug-xyz123")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
      expect(res.text).toContain("Tournament Not Found");
      expect(res.text).toContain("https://fan.bidwar.in/");
      // Must NOT return the 200 SPA shell
      expect(res.text).not.toContain('<title>BidWar Fan Platform</title>');
    });

    it("returns HTTP 404 for multi-segment unknown paths on fan domain", async () => {
      const res = await request(app)
        .get("/unknown/tournament/subpath")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("Tournament Not Found");
    });
  });

  // 7. Existing valid numeric and auctionCode identifiers still resolve
  describe("Requirement 7: Existing valid numeric and auctionCode identifiers still resolve", () => {
    it("returns HTTP 200 with SPA shell for valid numeric ID", async () => {
      const res = await request(app)
        .get("/25")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("BidWar Fan Platform");
    });

    it("returns HTTP 200 with SPA shell for valid alphanumeric auctionCode", async () => {
      const res = await request(app)
        .get("/VYAPARI")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("BidWar Fan Platform");
    });

    it("returns HTTP 200 with SPA shell for trial tournament code (preserves access/privacy rules)", async () => {
      const res = await request(app)
        .get("/RC732504")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("BidWar Fan Platform");
    });
  });

  // 8. Valid tournament pages continue to work on refresh
  describe("Requirement 8: Valid tournament pages continue to work on refresh", () => {
    it("serves SPA index.html on direct browser reload of tournament page", async () => {
      const res1 = await request(app)
        .get("/VN830108")
        .set("Host", "fan.bidwar.in");
      expect(res1.status).toBe(200);

      // Repeat request simulating browser refresh
      const res2 = await request(app)
        .get("/VN830108")
        .set("Host", "fan.bidwar.in");
      expect(res2.status).toBe(200);
      expect(res2.text).toBe(res1.text);
    });

    it("serves SPA index.html on root / route", async () => {
      const res = await request(app)
        .get("/")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("<title>BidWar Fan Platform</title>");
    });
  });

  // 9. API routes and static assets are not intercepted
  describe("Requirement 9: API routes and static assets are not intercepted", () => {
    it("routes /api/* to the API router without being intercepted by Fan slug handler", async () => {
      const res = await request(app)
        .get("/api/healthz")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.body).toHaveProperty("status", "ok");
    });

    it("returns 404 text for missing static assets (never HTML SPA shell)", async () => {
      const res = await request(app)
        .get("/assets/nonexistent-bundle.js")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toBe("Not Found");
    });
  });

  // 10. HEAD returns correct status and headers without body
  describe("Requirement 10: HEAD returns correct status and headers without body", () => {
    it("returns 200 with headers and empty body for HEAD /robots.txt on fan domain", async () => {
      const res = await request(app)
        .head("/robots.txt")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.text).toBeFalsy();
    });

    it("returns 200 with headers and empty body for HEAD /sitemap-index.xml on fan domain", async () => {
      const res = await request(app)
        .head("/sitemap-index.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/xml");
      expect(res.text).toBeFalsy();
    });

    it("returns 200 with headers and empty body for HEAD /:validSlug on fan domain", async () => {
      const res = await request(app)
        .head("/VN830108")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toBeFalsy();
    });

    it("returns 404 with headers and empty body for HEAD /:invalidSlug on fan domain", async () => {
      const res = await request(app)
        .head("/nonexistent-slug-xyz123")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(404);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toBeFalsy();
    });

    it("returns 200 with headers and empty body for HEAD / on marketing domain", async () => {
      const res = await request(app)
        .head("/")
        .set("Host", "bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toBeFalsy();
    });
  });

  // 11. Marketing homepage and existing SEO routes remain unchanged
  describe("Requirement 11: Marketing homepage and existing SEO routes remain unchanged", () => {
    it("serves marketing sitemap-pages.xml on bidwar.in with marketing URLs", async () => {
      const res = await request(app)
        .get("/sitemap-pages.xml")
        .set("Host", "bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/xml");
      expect(res.text).toContain("https://bidwar.in/");
    });

    it("serves marketing sitemap-index.xml on bidwar.in with child sitemaps", async () => {
      const res = await request(app)
        .get("/sitemap-index.xml")
        .set("Host", "bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain("https://bidwar.in/sitemap-pages.xml");
      expect(res.text).toContain("https://bidwar.in/sitemap-academy.xml");
      expect(res.text).toContain("https://bidwar.in/sitemap-blog.xml");
    });

    it("serves marketing homepage on bidwar.in", async () => {
      const res = await request(app)
        .get("/")
        .set("Host", "bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
    });
  });
});
