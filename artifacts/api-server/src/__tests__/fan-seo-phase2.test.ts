import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express;

// Test tournament fixtures representing every required case
const mockTournamentsData: Record<string | number, any> = {
  // 1. Active public licensed tournament
  1: {
    id: 1,
    name: "Mumbai Premier League 2026",
    sport: "cricket",
    auctionCode: "MPL2026",
    city: "Mumbai",
    venue: "Wankhede Stadium",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    organizerName: "Mumbai Cricket Association",
    organizerMobile: "+919876543210", // SENSITIVE
    organizerEmail: "org@mumbai.com", // SENSITIVE
    scoringPin: "1234", // SENSITIVE
    logoUrl: "https://res.cloudinary.com/bidwar/image/upload/v1/mpl-logo.png",
    auctionDate: "2026-04-10",
    featuresJson: { visibility: "public" },
  },
  // 2. Completed public tournament
  2: {
    id: 2,
    name: "Delhi Badminton Championship",
    sport: "badminton",
    auctionCode: "DBC2025",
    city: "New Delhi",
    venue: "Indira Gandhi Arena",
    status: "completed",
    licenseStatus: "completed",
    adminLocked: false,
    organizerName: "Delhi Badminton Club",
    organizerMobile: "+919111122222",
    organizerEmail: "admin@delhi.com",
    logoUrl: "https://res.cloudinary.com/bidwar/image/upload/v1/dbc-logo.png",
    featuresJson: { visibility: "public" },
  },
  // 3. Trial tournament
  3: {
    id: 3,
    name: "Goa Summer Cup",
    sport: "football",
    auctionCode: "GSC2026",
    city: "Panaji",
    status: "active",
    licenseStatus: "trial",
    adminLocked: false,
    organizerName: "Goa Club",
    featuresJson: { visibility: "public" },
  },
  // 4. Private tournament
  4: {
    id: 4,
    name: "Secret Corporate Invitational",
    sport: "cricket",
    auctionCode: "CORP99",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    organizerName: "Private Org",
    featuresJson: { visibility: "private" },
  },
  // 5. Admin-locked tournament
  5: {
    id: 5,
    name: "Locked Tournament Alpha",
    sport: "cricket",
    auctionCode: "LOCKED01",
    status: "active",
    licenseStatus: "active",
    adminLocked: true,
    organizerName: "Locked Org",
    featuresJson: { visibility: "public" },
  },
  // 6. Test/demo tournament
  6: {
    id: 6,
    name: "Internal Demo [TEST] League",
    sport: "cricket",
    auctionCode: "TESTDEMO",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    organizerName: "QA Team",
    featuresJson: { visibility: "public" },
  },
  // 7. Empty/incomplete tournament
  7: {
    id: 7,
    name: "New Tournament 7",
    sport: "cricket",
    auctionCode: "EMPTY07",
    status: "setup",
    licenseStatus: "active",
    adminLocked: false,
    organizerName: "Setup Org",
    city: null,
    venue: null,
    auctionDate: null,
    featuresJson: { visibility: "public" },
  },
};

const mockTeamsData: Record<number, any[]> = {
  1: [
    { id: 101, tournamentId: 1, name: "Bandra Blasters", shortCode: "BBL", logoUrl: null, color: "#EF4444", coachName: "Coach Ravi", ownerMobile: "9998887776" },
    { id: 102, tournamentId: 1, name: "Colaba Kings", shortCode: "CK", logoUrl: "https://example.com/ck.png", color: "#3B82F6", coachName: "Coach Anil", ownerMobile: "9998887775" },
  ],
  2: [
    { id: 201, tournamentId: 2, name: "Delhi Smashers", shortCode: "DS", logoUrl: null, color: "#10B981", coachName: null, ownerMobile: "9998887774" },
  ],
  3: [
    { id: 301, tournamentId: 3, name: "Goa Strikers", shortCode: "GS", logoUrl: null, color: "#F59E0B", coachName: null, ownerMobile: "9998887773" },
  ],
  4: [
    { id: 401, tournamentId: 4, name: "Secret Team A", shortCode: "STA", logoUrl: null, color: "#6366F1", coachName: null, ownerMobile: "9998887772" },
  ],
  5: [],
  6: [],
  7: [], // Empty!
};

const mockMatchesData: Record<number, any[]> = {
  1: [
    { id: 1001, tournamentId: 1, matchLabel: "Match 1", status: "live", homeTeamId: 101, awayTeamId: 102, sportSlug: "cricket" },
  ],
  2: [
    { id: 2001, tournamentId: 2, matchLabel: "Final", status: "completed", homeTeamId: 201, awayTeamId: 201, sportSlug: "badminton" },
  ],
  3: [],
  4: [],
  5: [],
  6: [],
  7: [],
};

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

function matchesTournamentCondition(t: { id: number; auctionCode: string | null }, cond: any): boolean {
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
      if (matchesTournamentCondition(t, c)) return true;
    }
  }
  return false;
}

function findMatchingTournament(cond: any): any | undefined {
  if (!cond) return undefined;
  for (const t of Object.values(mockTournamentsData)) {
    if (matchesTournamentCondition(t, cond)) {
      return t;
    }
  }
  return undefined;
}

function findMatchingTeams(cond: any): any[] {
  if (!cond) return [];
  for (const [tidStr, teams] of Object.entries(mockTeamsData)) {
    const tid = Number(tidStr);
    if (cond.right === tid || String(cond.right) === String(tid)) {
      return teams;
    }
    if (Array.isArray(cond.queryChunks)) {
      for (const chunk of cond.queryChunks) {
        const val = chunk?.value ?? chunk;
        if (val === tid || String(val) === String(tid)) return teams;
      }
    }
  }
  return [];
}

function findMatchingMatches(cond: any): any[] {
  if (!cond) return [];
  for (const [tidStr, matches] of Object.entries(mockMatchesData)) {
    const tid = Number(tidStr);
    if (cond.right === tid || String(cond.right) === String(tid)) {
      return matches;
    }
    if (Array.isArray(cond.queryChunks)) {
      for (const chunk of cond.queryChunks) {
        const val = chunk?.value ?? chunk;
        if (val === tid || String(val) === String(tid)) return matches;
      }
    }
  }
  return [];
}

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  const mockDb = {
    ...((actual.db as any) ?? {}),
    select: vi.fn((fields?: any) => ({
      from: vi.fn((table: any) => ({
        where: vi.fn((condition: any) => {
          let results: any[] = [];

          // Determine which table is being queried
          if (table?.name === "teams" || fields?.shortCode) {
            results = findMatchingTeams(condition);
          } else if (table?.name === "scoring_matches" || fields?.matchLabel) {
            results = findMatchingMatches(condition);
          } else {
            const t = findMatchingTournament(condition);
            results = t ? [t] : [];
          }

          return {
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn((limitNum: number) => Promise.resolve(results.slice(0, limitNum))),
            then: (resolve: any) => resolve(results),
          };
        }),
        orderBy: vi.fn().mockReturnThis(),
      })),
    })),
  };

  return {
    ...actual,
    db: mockDb,
    createPgClient: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      end: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
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

describe("BIDWAR FAN PLATFORM SEO — PHASE 2 VERIFICATION", () => {
  // Case 1: Active public licensed tournament
  describe("Case 1: Active public licensed tournament", () => {
    it("renders HTTP 200, dynamic metadata, 'index, follow' robots, and SSR tournament content", async () => {
      const res = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.headers["x-robots-tag"]).toBe("index, follow");

      // Dynamic Title (Phase 3 module-aware: auction-only)
      expect(res.text).toContain("<title>Mumbai Premier League 2026 — Live Player Auction, Team Purses &amp; Squads | BidWar Fan Platform</title>");

      // Meta Description
      expect(res.text).toContain('<meta name="description" content="Follow the official player auction for Mumbai Premier League 2026 at Wankhede Stadium, Mumbai. Track live owner bidding, team purses, squads with 2 participating teams, and sold player updates on BidWar Fan Platform." />');

      // Robots directive in HTML
      expect(res.text).toContain('<meta name="robots" content="index, follow" />');

      // Canonical URL with fan origin and requested slug
      expect(res.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/MPL2026" />');

      // Open Graph and Twitter metadata
      expect(res.text).toContain('<meta property="og:site_name" content="BidWar Fan Platform" />');
      expect(res.text).toContain('<meta property="og:url" content="https://fan.bidwar.in/MPL2026" />');
      expect(res.text).toContain('<meta property="og:image" content="https://res.cloudinary.com/bidwar/image/upload/v1/mpl-logo.png" />');
      expect(res.text).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(res.text).toContain('<meta name="twitter:title" content="Mumbai Premier League 2026 — Live Player Auction, Team Purses &amp; Squads | BidWar Fan Platform" />');

      // Server-rendered content inside #root
      expect(res.text).toContain('<h1 class="fan-ssr-title">Mumbai Premier League 2026</h1>');
      expect(res.text).toContain("Cricket");
      expect(res.text).toContain("Mumbai");
      expect(res.text).toContain("Wankhede Stadium");
      expect(res.text).toContain("Bandra Blasters");
      expect(res.text).toContain("Colaba Kings");
      expect(res.text).toContain("Organized by <strong style=\"color: #E2E8F0;\">Mumbai Cricket Association</strong>");

      // Privacy: No private mobile numbers, emails, or scoring PIN in HTML
      expect(res.text).not.toContain("+919876543210");
      expect(res.text).not.toContain("org@mumbai.com");
      expect(res.text).not.toContain("1234");
      expect(res.text).not.toContain("9998887776");
    });
  });

  // Case 2: Completed public tournament
  describe("Case 2: Completed public tournament", () => {
    it("renders HTTP 200, archive title, 'index, follow' robots, and historical content", async () => {
      const res = await request(app)
        .get("/DBC2025")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("index, follow");
      expect(res.text).toContain("<title>Delhi Badminton Championship — Final Auction Results &amp; Squads | BidWar Fan Platform</title>");
      expect(res.text).toContain('<meta name="robots" content="index, follow" />');
      expect(res.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/DBC2025" />');
      expect(res.text).toContain("Delhi Smashers");
      expect(res.text).toContain("COMPLETED");
    });
  });

  // Case 3: Trial tournament
  describe("Case 3: Trial tournament", () => {
    it("renders HTTP 200 with 'noindex, follow' robots directives", async () => {
      const res = await request(app)
        .get("/GSC2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("noindex, follow");
      expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
      expect(res.text).toContain("Goa Summer Cup");
      expect(res.text).toContain("TRIAL");
    });
  });

  // Case 4: Private tournament
  describe("Case 4: Private tournament", () => {
    it("renders HTTP 200 with 'noindex, nofollow' robots and does not leak private teams/matches", async () => {
      const res = await request(app)
        .get("/CORP99")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(res.text).toContain('<meta name="robots" content="noindex, nofollow" />');
      expect(res.text).toContain("Protected Tournament");
      expect(res.text).toContain("This tournament is marked private or restricted");

      // Must not leak private team data in server-rendered HTML
      expect(res.text).not.toContain("Secret Team A");
      expect(res.text).not.toContain("9998887772");
    });
  });

  // Case 5: Admin-locked tournament
  describe("Case 5: Admin-locked tournament", () => {
    it("renders HTTP 200 with 'noindex, nofollow' robots and restriction notice", async () => {
      const res = await request(app)
        .get("/LOCKED01")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(res.text).toContain('<meta name="robots" content="noindex, nofollow" />');
      expect(res.text).toContain("Protected Tournament");
    });
  });

  // Case 6: Test/demo tournament
  describe("Case 6: Test/demo tournament", () => {
    it("renders HTTP 200 with 'noindex, nofollow' robots", async () => {
      const res = await request(app)
        .get("/TESTDEMO")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(res.text).toContain('<meta name="robots" content="noindex, nofollow" />');
    });
  });

  // Case 7: Empty/incomplete tournament
  describe("Case 7: Empty/incomplete tournament", () => {
    it("renders HTTP 200 with 'noindex, follow' robots (waiting for published content)", async () => {
      const res = await request(app)
        .get("/EMPTY07")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("noindex, follow");
      expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
    });
  });

  // Case 8: Unknown tournament identifier
  describe("Case 8: Unknown tournament identifier", () => {
    it("returns HTTP 404 with 'noindex, follow' and 404 error HTML", async () => {
      const res = await request(app)
        .get("/UNKNOWN-NONEXISTENT-SLUG")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(404);
      expect(res.headers["x-robots-tag"]).toBe("noindex, follow");
      expect(res.text).toContain("Tournament Not Found");
      expect(res.text).toContain('<meta name="robots" content="noindex, follow" />');
    });
  });

  // Case 9: Numeric tournament identifier
  describe("Case 9: Numeric tournament identifier", () => {
    it("resolves by numeric ID e.g. /1 and normalizes canonical URL to auctionCode", async () => {
      const res = await request(app)
        .get("/1")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/MPL2026" />');
      expect(res.text).toContain("Mumbai Premier League 2026");
    });
  });

  // Case 10: AuctionCode tournament identifier
  describe("Case 10: AuctionCode tournament identifier", () => {
    it("resolves by auctionCode e.g. /MPL2026 and preserves auctionCode in canonical URL", async () => {
      const res = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/MPL2026" />');
      expect(res.text).toContain("Mumbai Premier League 2026");
    });
  });

  // Additional requirement: Host isolation & HEAD method
  describe("Host isolation and HTTP HEAD verification", () => {
    it("canonical URL never points to bidwar.in on fan platform", async () => {
      const res = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.text).toContain('href="https://fan.bidwar.in/MPL2026"');
      expect(res.text).not.toContain('href="https://bidwar.in/MPL2026"');
    });

    it("HEAD /MPL2026 returns identical headers and status 200 with empty body", async () => {
      const res = await request(app)
        .head("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.headers["x-robots-tag"]).toBe("index, follow");
      expect(res.text).toBeUndefined();
    });

    it("HEAD /UNKNOWN-SLUG returns status 404 with empty body", async () => {
      const res = await request(app)
        .head("/UNKNOWN-SLUG-XYZ")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(404);
      expect(res.text).toBeUndefined();
    });

    it("marketing homepage is not affected by fan platform tournament handler", async () => {
      const res = await request(app)
        .get("/")
        .set("Host", "bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("BidWar");
    });
  });
});
