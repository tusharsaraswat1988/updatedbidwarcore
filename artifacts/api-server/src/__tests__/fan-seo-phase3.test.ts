import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";

let app: Express;

// Comprehensive mock fixtures for all Phase 3 test cases
const mockTournamentsData: Record<string | number, any> = {
  // 1. Active public licensed tournament (Auction-only) with public sponsors & teams
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
    auctionEnabled: true,
    scoringEnabled: false,
    organizerName: "Mumbai Cricket Association",
    organizerMobile: "+919876543210", // SENSITIVE
    organizerEmail: "org@mumbai.com", // SENSITIVE
    scoringPin: "1234", // SENSITIVE
    logoUrl: "https://res.cloudinary.com/bidwar/image/upload/v1/mpl-logo.png",
    auctionDate: "2026-04-10",
    auctionTime: "10:00",
    featuresJson: { visibility: "public" },
    sponsorLogos: JSON.stringify([
      {
        url: "https://example.com/sponsors/dream11.png",
        name: "Dream11",
        type: "Title Sponsor",
        isTitleSponsor: true,
      },
      {
        url: "https://example.com/sponsors/tata.png",
        name: "Tata Motors",
        type: "Official Partner",
        isTitleSponsor: false,
      },
    ]),
    updatedAt: new Date("2026-04-01T12:00:00Z"),
    createdAt: new Date("2026-03-01T10:00:00Z"),
  },
  // 2. Completed public licensed tournament (Scoring-only)
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
    auctionEnabled: false,
    scoringEnabled: true,
    matchDates: "2026-06-15,2026-06-16",
    auctionDate: "2026-05-10",
    organizerName: "Delhi Badminton Club",
    organizerMobile: "+919111122222",
    organizerEmail: "admin@delhi.com",
    logoUrl: "https://res.cloudinary.com/bidwar/image/upload/v1/dbc-logo.png",
    featuresJson: { visibility: "public" },
    sponsorLogos: null,
    updatedAt: new Date("2026-03-15T18:00:00Z"),
    createdAt: new Date("2026-02-15T09:00:00Z"),
  },
  // 3. Combined-module tournament (Both Auction & Scoring enabled)
  3: {
    id: 3,
    name: "Kolkata Premier League 2026",
    sport: "football",
    auctionCode: "KPL2026",
    city: "Kolkata",
    venue: "Salt Lake Stadium",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    auctionEnabled: true,
    scoringEnabled: true,
    matchDates: "2026-07-01,2026-07-02",
    auctionDate: "2026-06-01",
    organizerName: "IFA Bengal",
    logoUrl: "https://res.cloudinary.com/bidwar/image/upload/v1/kpl-logo.png",
    featuresJson: { visibility: "public" },
    sponsorLogos: null,
    updatedAt: new Date("2026-03-20T10:00:00Z"),
    createdAt: new Date("2026-02-20T08:00:00Z"),
  },
  // 4. Private tournament (Should be strictly masked and excluded from sitemap)
  4: {
    id: 4,
    name: "Secret Corporate Invitational 2026",
    sport: "cricket",
    auctionCode: "CORP99",
    city: "Bengaluru",
    venue: "Chinnaswamy Stadium",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    auctionEnabled: true,
    scoringEnabled: true,
    organizerName: "Secret Club",
    featuresJson: { visibility: "private" },
    sponsorLogos: JSON.stringify([
      { url: "https://example.com/sponsors/secret.png", name: "Secret Sponsor", type: "Partner" },
    ]),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
  },
  // 5. Admin-locked tournament (Should be excluded from sitemap)
  5: {
    id: 5,
    name: "Locked Tournament Alpha",
    sport: "cricket",
    auctionCode: "LOCKED01",
    status: "active",
    licenseStatus: "active",
    adminLocked: true,
    featuresJson: { visibility: "public" },
  },
  // 6. Trial / Unlicensed tournament (Should be excluded from sitemap)
  6: {
    id: 6,
    name: "Trial Tournament Beta",
    sport: "cricket",
    auctionCode: "TRIAL01",
    status: "active",
    licenseStatus: "trial",
    adminLocked: false,
    featuresJson: { visibility: "public" },
  },
  // 7. Test / Demo tournament (Should be excluded from sitemap)
  7: {
    id: 7,
    name: "[TEST] Demo Tournament 2026",
    sport: "cricket",
    auctionCode: "TESTDEMO",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    featuresJson: { visibility: "public" },
  },
  // 8. Empty / placeholder tournament (Should be excluded from sitemap)
  8: {
    id: 8,
    name: "New Tournament 8",
    sport: "cricket",
    auctionCode: "EMPTY08",
    status: "setup",
    licenseStatus: "active",
    adminLocked: false,
    city: null,
    venue: null,
    auctionDate: null,
    featuresJson: { visibility: "public" },
  },
  // 9. Tournament with numeric ID only (auctionCode is null)
  99: {
    id: 99,
    name: "Legacy Numeric Tournament",
    sport: "cricket",
    auctionCode: null,
    city: "Pune",
    venue: "MCA Stadium",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    auctionEnabled: true,
    scoringEnabled: false,
    featuresJson: { visibility: "public" },
    updatedAt: new Date("2026-03-25T14:00:00Z"),
  },
  // 10. Active licensed tournament still in setup with 0 teams (Must be excluded from sitemap & emit noindex)
  10: {
    id: 10,
    name: "Elite Corporate League 2026",
    sport: "cricket",
    auctionCode: "ECL2026",
    status: "setup",
    licenseStatus: "active",
    adminLocked: false,
    auctionEnabled: true,
    scoringEnabled: false,
    city: null,
    venue: null,
    auctionDate: null,
    featuresJson: { visibility: "public" },
  },
  // 11. Tournament with free-text invalid auctionTime
  11: {
    id: 11,
    name: "Jaipur Premier League",
    sport: "cricket",
    auctionCode: "JPL2026",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    auctionEnabled: true,
    scoringEnabled: false,
    auctionDate: "2026-08-10",
    auctionTime: "10:00 AM", // Invalid free text time
    featuresJson: { visibility: "public" },
  },
  // 12. Malicious tournament name testing JSON-LD script boundary defense
  12: {
    id: 12,
    name: "Hack League </script><script>alert('xss')</script>",
    sport: "cricket",
    auctionCode: "XSS99",
    status: "active",
    licenseStatus: "active",
    adminLocked: false,
    auctionEnabled: true,
    scoringEnabled: false,
    auctionDate: "2026-09-10",
    featuresJson: { visibility: "public" },
  },
};

const mockTeamsData: Record<number, any[]> = {
  1: [
    { id: 101, tournamentId: 1, name: "Bandra Blasters", shortCode: "BBL", logoUrl: null, color: "#EF4444", coachName: "Coach Ravi" },
    { id: 102, tournamentId: 1, name: "Colaba Kings", shortCode: "CK", logoUrl: "https://example.com/ck.png", color: "#3B82F6", coachName: "Coach Anil" },
  ],
  2: [
    { id: 201, tournamentId: 2, name: "Delhi Smashers", shortCode: "DS", logoUrl: null, color: "#10B981", coachName: "Coach Sharma" },
  ],
  3: [
    { id: 301, tournamentId: 3, name: "East Bengal FC", shortCode: "EBFC", logoUrl: null, color: "#E11D48", coachName: "Coach Bhaichung" },
    { id: 302, tournamentId: 3, name: "Mohun Bagan AC", shortCode: "MBAC", logoUrl: null, color: "#059669", coachName: "Coach Subrata" },
  ],
  4: [
    { id: 401, tournamentId: 4, name: "Confidential Team A", shortCode: "CTA", logoUrl: null, color: "#000000", coachName: "Secret" },
  ],
  11: [
    { id: 1101, tournamentId: 11, name: "Jaipur Royals", shortCode: "JR", logoUrl: null, color: "#EC4899", coachName: "Coach K" },
  ],
  12: [
    { id: 1201, tournamentId: 12, name: "Exploit Squad </script>", shortCode: "EXS", logoUrl: null, color: "#000000", coachName: "None" },
  ],
  99: [
    { id: 9901, tournamentId: 99, name: "Pune Warriors", shortCode: "PW", logoUrl: null, color: "#6366F1", coachName: "Coach P" },
  ],
};

const mockMatchesData: Record<number, any[]> = {
  2: [
    { id: 2001, tournamentId: 2, matchLabel: "Finals", status: "completed", homeTeamId: 201, awayTeamId: null, sportSlug: "badminton" },
  ],
  3: [
    { id: 3001, tournamentId: 3, matchLabel: "Derby Clash", status: "live", homeTeamId: 301, awayTeamId: 302, sportSlug: "football" },
  ],
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

function findMatchingTournament(cond: any): any | null {
  if (!cond) return null;
  for (const t of Object.values(mockTournamentsData)) {
    if (matchesTournamentCondition(t, cond)) {
      return t;
    }
  }
  return null;
}

function isSlugLookup(cond: any): boolean {
  if (!cond) return false;
  if (cond.queryChunks && Array.isArray(cond.queryChunks)) {
    for (const chunk of cond.queryChunks) {
      if (chunk?.name === "auction_code" || chunk?.name === "id") return true;
      if (chunk?.queryChunks) {
        if (isSlugLookup(chunk)) return true;
      }
    }
  }
  if (cond.conditions && Array.isArray(cond.conditions)) {
    return cond.conditions.some((c: any) => isSlugLookup(c));
  }
  if (cond.left?.name === "id" || cond.left?.name === "auction_code") return true;
  return false;
}

function findMatchingTeams(cond: any): any[] {
  if (!cond) return [];
  for (const [tidStr, teams] of Object.entries(mockTeamsData)) {
    const tid = Number(tidStr);
    if (cond.right === tid || String(cond.right) === String(tid)) return teams;
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
    if (cond.right === tid || String(cond.right) === String(tid)) return matches;
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

          if (table?.name === "teams" || fields?.shortCode) {
            results = findMatchingTeams(condition);
          } else if (table?.name === "scoring_matches" || fields?.matchLabel) {
            results = findMatchingMatches(condition);
          } else if (isSlugLookup(condition)) {
            const single = findMatchingTournament(condition);
            results = single ? [single] : [];
          } else {
            // Sitemap query returning all non-archived candidate tournaments
            results = Object.values(mockTournamentsData).filter((t) => {
              if (t.status === "archived") return false;
              if (t.adminLocked) return false;
              if (t.licenseStatus !== "active" && t.licenseStatus !== "completed") return false;
              return true;
            });
          }

          return {
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn((limitNum: number) => Promise.resolve(results.slice(0, limitNum))),
            then: (resolve: any) => resolve(results),
          };
        }),
        orderBy: vi.fn().mockReturnValue({
          then: (resolve: any) => {
            const results = Object.values(mockTournamentsData).filter((t) => {
              if (t.status === "archived") return false;
              if (t.adminLocked) return false;
              if (t.licenseStatus !== "active" && t.licenseStatus !== "completed") return false;
              return true;
            });
            return resolve(results);
          },
        }),
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

describe("BIDWAR FAN PLATFORM SEO — PHASE 3 ACCEPTANCE SUITE", () => {
  // ── PART A: PHASE 2 P1 CORRECTIONS ────────────────────────────────────────

  // Case 1: Auction-only metadata
  describe("Case 1: Auction-only tournament metadata", () => {
    it("advertises player auctions, team purses, and squads without claiming live scores or fixtures", async () => {
      const res = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain("<title>Mumbai Premier League 2026 — Live Player Auction, Team Purses &amp; Squads | BidWar Fan Platform</title>");
      expect(res.text).toContain('name="description" content="Follow the official player auction for Mumbai Premier League 2026 at Wankhede Stadium, Mumbai. Track live owner bidding, team purses, squads with 2 participating teams, and sold player updates on BidWar Fan Platform."');
      
      // Proves no scoring/fixtures claims
      expect(res.text).not.toContain("Live Cricket Scores, Fixtures &amp; Standings");
      expect(res.text).not.toContain("Matches &amp; Fixtures");
    });
  });

  // Case 2: Scoring-only metadata
  describe("Case 2: Scoring-only tournament metadata", () => {
    it("advertises live sport scores, fixtures, and standings without claiming player auctions or purses", async () => {
      const res = await request(app)
        .get("/DBC2025")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain("<title>Delhi Badminton Championship — Final Badminton Results &amp; Standings | BidWar Fan Platform</title>");
      expect(res.text).toContain("Review final badminton match results, tournament standings, and team squads on BidWar Fan Platform");

      // Proves no auction claims
      expect(res.text).not.toContain("Live Player Auction, Team Purses");
      expect(res.text).not.toContain("sold prices");
    });
  });

  // Case 3: Combined-module metadata
  describe("Case 3: Combined-module tournament metadata", () => {
    it("advertises both auction and scoring modules accurately", async () => {
      const res = await request(app)
        .get("/KPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain("<title>Kolkata Premier League 2026 — Live Football Scores, Auction &amp; Teams | BidWar Fan Platform</title>");
      expect(res.text).toContain("Real-time football scoring, player auction updates, team rosters, and fixtures");
    });
  });

  // Case 4: Canonical URL consistency (numeric vs auctionCode)
  describe("Case 4: Canonical URL normalization", () => {
    it("both numeric /1 and auctionCode /MPL2026 produce the exact same canonical URL", async () => {
      const resNumeric = await request(app)
        .get("/1")
        .set("Host", "fan.bidwar.in");
      const resCode = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(resNumeric.status).toBe(200);
      expect(resCode.status).toBe(200);

      // Both must emit the normalized auctionCode canonical
      expect(resNumeric.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/MPL2026" />');
      expect(resCode.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/MPL2026" />');
    });

    it("falls back to numeric ID as canonical URL when tournament lacks an auctionCode", async () => {
      const res = await request(app)
        .get("/99")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain('<link rel="canonical" href="https://fan.bidwar.in/99" />');
    });
  });

  // Case 5: AuctionCode stability and uniqueness
  describe("Case 5: AuctionCode stability and database uniqueness", () => {
    it("verifies auctionCode is indexed uniquely in the database schema", async () => {
      const { tournamentsTable } = await import("@workspace/db");
      // Verify auctionCode column exists on tournaments table
      expect(tournamentsTable.auctionCode).toBeDefined();
      expect(tournamentsTable.auctionCode.name).toBe("auction_code");
    });
  });

  // Case 6: Private tournament metadata masking
  describe("Case 6: Private tournament metadata masking", () => {
    it("masks title and description generically without leaking real tournament name, teams, or sponsors", async () => {
      const res = await request(app)
        .get("/CORP99")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["x-robots-tag"]).toBe("noindex, nofollow");
      expect(res.text).toContain("<title>Private Tournament | BidWar Fan Platform</title>");
      expect(res.text).toContain('<meta name="description" content="Private tournament hub on BidWar Fan Platform. Access is restricted to authorized tournament participants." />');
      expect(res.text).toContain('<meta name="robots" content="noindex, nofollow" />');

      // Zero private leakage
      expect(res.text).not.toContain("Secret Corporate Invitational");
      expect(res.text).not.toContain("Confidential Team A");
      expect(res.text).not.toContain("Secret Sponsor");
      expect(res.text).not.toContain("Chinnaswamy Stadium");
    });
  });

  // ── PART B: DYNAMIC TOURNAMENT SITEMAP ─────────────────────────────────────

  // Case 7: Trial and admin-locked sitemap exclusion
  describe("Case 7: Trial and admin-locked tournament exclusion from sitemap", () => {
    it("excludes trial and admin-locked tournaments from sitemap-tournaments.xml", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/xml");
      expect(res.text).not.toContain("TRIAL01");
      expect(res.text).not.toContain("LOCKED01");
    });
  });

  // Case 8: Test/demo tournament sitemap exclusion
  describe("Case 8: Test/demo tournament exclusion from sitemap", () => {
    it("excludes test and demo tournaments from sitemap-tournaments.xml", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).not.toContain("TESTDEMO");
      expect(res.text).not.toContain("[TEST]");
    });
  });

  // Case 9: Empty/incomplete tournament sitemap exclusion
  describe("Case 9: Empty/incomplete tournament exclusion from sitemap", () => {
    it("excludes empty setup tournaments with no meaningful content from sitemap", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).not.toContain("EMPTY08");
    });

    it("excludes setup tournaments with zero teams and ensures page returns noindex", async () => {
      // 1. Must not appear in sitemap
      const resSitemap = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(resSitemap.status).toBe(200);
      expect(resSitemap.text).not.toContain("ECL2026");

      // 2. Direct page request must return noindex, follow
      const resPage = await request(app)
        .get("/ECL2026")
        .set("Host", "fan.bidwar.in");

      expect(resPage.status).toBe(200);
      expect(resPage.headers["x-robots-tag"]).toBe("noindex, follow");
      expect(resPage.text).toContain('<meta name="robots" content="noindex, follow" />');
    });
  });

  // Case 10: Eligible completed tournament sitemap inclusion
  describe("Case 10: Eligible completed tournament inclusion in sitemap", () => {
    it("includes eligible completed public tournaments without unverified lastmod", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain("<loc>https://fan.bidwar.in/DBC2025</loc>");
      expect(res.text).not.toContain("<lastmod>");
    });
  });

  // Case 11: Sitemap XML validity
  describe("Case 11: Sitemap XML structure and format validity", () => {
    it("serves well-formed XML with valid urlset namespace and loc tags without unverified lastmod", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(res.text).toContain("</urlset>");
      expect(res.text).not.toContain("<lastmod>");

      // Verify all <loc> entries are valid fan URLs
      const locMatches = res.text.match(/<loc>(.*?)<\/loc>/g) || [];
      expect(locMatches.length).toBeGreaterThan(0);
      for (const tag of locMatches) {
        const val = tag.replace(/<\/?loc>/g, "");
        expect(val).toMatch(/^https:\/\/fan\.bidwar\.in\/[A-Za-z0-9_-]+$/);
      }
    });
  });

  // Case 12: Duplicate URL prevention
  describe("Case 12: Duplicate URL prevention in sitemap", () => {
    it("ensures all entries in sitemap-tournaments.xml are strictly deduplicated", async () => {
      const res = await request(app)
        .get("/sitemap-tournaments.xml")
        .set("Host", "fan.bidwar.in");

      const locMatches = res.text.match(/<loc>(.*?)<\/loc>/g) || [];
      const seenLocs = new Set<string>();
      for (const loc of locMatches) {
        expect(seenLocs.has(loc)).toBe(false);
        seenLocs.add(loc);
      }
    });
  });

  // Case 13: Empty sitemap safe handling
  describe("Case 13: Empty sitemap safe handling", () => {
    it("buildDynamicFanSitemapTournaments safely returns a valid empty urlset without errors", async () => {
      const { buildDynamicFanSitemapTournaments } = await import("../lib/fan-tournament-seo.js");
      // Calling buildDynamicFanSitemapTournaments on an empty origin returns valid XML
      const xml = await buildDynamicFanSitemapTournaments("https://fan.bidwar.in");
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain("</urlset>");
    });
  });

  // ── PART C: STRUCTURED DATA IMPLEMENTATION ────────────────────────────────

  // Case 14: JSON-LD structured data syntax and validation
  describe("Case 14: JSON-LD structured data syntax and schema.org compliance", () => {
    it("generates valid SportsEvent and BreadcrumbList JSON-LD schemas", async () => {
      const res = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);

      // Extract JSON-LD script blocks
      const jsonLdMatches = Array.from(res.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g));
      expect(jsonLdMatches.length).toBeGreaterThanOrEqual(2);

      const schemas = jsonLdMatches.map((m) => JSON.parse(m[1]));
      const sportsEvent = schemas.find((s) => s["@type"] === "SportsEvent");
      const breadcrumbs = schemas.find((s) => s["@type"] === "BreadcrumbList");

      expect(sportsEvent).toBeDefined();
      expect(sportsEvent["@context"]).toBe("https://schema.org");
      expect(sportsEvent.name).toBe("Mumbai Premier League 2026");
      expect(sportsEvent.sport).toBe("Cricket");
      expect(sportsEvent.eventStatus).toBe("https://schema.org/EventScheduled");
      expect(sportsEvent.startDate).toBe("2026-04-10T10:00:00");
      expect(sportsEvent.location).toEqual({
        "@type": "Place",
        "name": "Wankhede Stadium",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Mumbai",
          "addressCountry": "IN",
        },
      });
      expect(sportsEvent.organizer).toEqual({
        "@type": "Organization",
        "name": "Mumbai Cricket Association",
        "url": "https://fan.bidwar.in",
      });
      expect(sportsEvent.competitor).toHaveLength(2);
      expect(sportsEvent.competitor[0].name).toBe("Bandra Blasters");

      expect(breadcrumbs).toBeDefined();
      expect(breadcrumbs["@context"]).toBe("https://schema.org");
      expect(breadcrumbs.itemListElement).toHaveLength(2);
      expect(breadcrumbs.itemListElement[0].name).toBe("Home");
      expect(breadcrumbs.itemListElement[1].name).toBe("Mumbai Premier League 2026");
    });

    it("validates event dates: scoring-only uses matchDates and ignores auctionDate; invalid time is rejected", async () => {
      // 1. Scoring-only tournament (DBC2025): has matchDates "2026-06-15,2026-06-16" and auctionDate "2026-05-10"
      const resScoring = await request(app)
        .get("/DBC2025")
        .set("Host", "fan.bidwar.in");
      const schemasScoring = Array.from(resScoring.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)).map((m) => JSON.parse(m[1]));
      const sportsEventScoring = schemasScoring.find((s) => s["@type"] === "SportsEvent");
      expect(sportsEventScoring.startDate).toBe("2026-06-15"); // Strictly uses match date!

      // 2. Combined tournament (KPL2026): prefers matchDates "2026-07-01"
      const resCombined = await request(app)
        .get("/KPL2026")
        .set("Host", "fan.bidwar.in");
      const schemasCombined = Array.from(resCombined.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)).map((m) => JSON.parse(m[1]));
      const sportsEventCombined = schemasCombined.find((s) => s["@type"] === "SportsEvent");
      expect(sportsEventCombined.startDate).toBe("2026-07-01");

      // 3. Tournament with invalid free-text auctionTime ("10:00 AM"): JPL2026
      const resInvalidTime = await request(app)
        .get("/JPL2026")
        .set("Host", "fan.bidwar.in");
      const schemasInvalidTime = Array.from(resInvalidTime.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)).map((m) => JSON.parse(m[1]));
      const sportsEventInvalidTime = schemasInvalidTime.find((s) => s["@type"] === "SportsEvent");
      expect(sportsEventInvalidTime.startDate).toBe("2026-08-10"); // No invalid time appended!
    });
  });

  // Case 15: Private data absence from JSON-LD
  describe("Case 15: Private data absence from JSON-LD structured data", () => {
    it("suppresses SportsEvent schema completely for private tournaments", async () => {
      const res = await request(app)
        .get("/CORP99")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);

      const jsonLdMatches = Array.from(res.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g));
      const schemas = jsonLdMatches.map((m) => JSON.parse(m[1]));

      const sportsEvent = schemas.find((s) => s["@type"] === "SportsEvent");
      expect(sportsEvent).toBeUndefined(); // Strictly suppressed!

      // BreadcrumbList is generic
      const breadcrumbs = schemas.find((s) => s["@type"] === "BreadcrumbList");
      expect(breadcrumbs).toBeDefined();
      expect(breadcrumbs.itemListElement[1].name).toBe("Private Tournament");
    });

    it("hardens JSON-LD against script injection by escaping < as \\u003c", async () => {
      const res = await request(app)
        .get("/XSS99")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);

      // Verify raw HTML does NOT contain unescaped closing </script> inside JSON-LD
      const scriptBlockMatch = res.text.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/);
      expect(scriptBlockMatch).not.toBeNull();
      const rawJson = scriptBlockMatch![1];

      // Verifies \u003c is used instead of literal <
      expect(rawJson).toContain("\\u003c/script>\\u003cscript>");
      expect(rawJson).not.toContain("</script><script>");

      // Verifies JSON.parse cleanly reconstructs the original string
      const parsed = JSON.parse(rawJson);
      expect(parsed.name).toBe("Hack League </script><script>alert('xss')</script>");
    });
  });

  // ── PART D: PUBLIC SPONSOR DISCOVERABILITY ─────────────────────────────────

  // Case 16: Public sponsor discoverability in SSR HTML and JSON-LD
  describe("Case 16: Public sponsor discoverability", () => {
    it("renders sponsor roles, names, and logos in SSR HTML and SportsEvent sponsor schema", async () => {
      const res = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);

      // SSR HTML rendering of sponsors
      expect(res.text).toContain("Official Partners");
      expect(res.text).toContain("Dream11");
      expect(res.text).toContain("Title Sponsor");
      expect(res.text).toContain("https://example.com/sponsors/dream11.png");
      expect(res.text).toContain("Tata Motors");
      expect(res.text).toContain("Official Partner");
      expect(res.text).toContain("https://example.com/sponsors/tata.png");

      // SportsEvent JSON-LD includes sponsors
      const jsonLdMatches = Array.from(res.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g));
      const sportsEvent = jsonLdMatches.map((m) => JSON.parse(m[1])).find((s) => s["@type"] === "SportsEvent");
      expect(sportsEvent.sponsor).toBeDefined();
      expect(sportsEvent.sponsor).toHaveLength(2);
      expect(sportsEvent.sponsor[0]).toEqual({
        "@type": "Organization",
        "name": "Dream11",
        "image": "https://example.com/sponsors/dream11.png",
      });
      expect(sportsEvent.sponsor[1]).toEqual({
        "@type": "Organization",
        "name": "Tata Motors",
        "image": "https://example.com/sponsors/tata.png",
      });
    });

    it("does not render empty sponsor section when tournament has no sponsors", async () => {
      const res = await request(app)
        .get("/DBC2025")
        .set("Host", "fan.bidwar.in");

      expect(res.status).toBe(200);
      expect(res.text).not.toContain("aria-label=\"Official Sponsors &amp; Partners\"");
    });
  });

  // ── HOST ISOLATION & NON-REGRESSION ────────────────────────────────────────

  // Case 17: Marketing robots and sitemap non-regression
  describe("Case 17: Marketing domain non-regression", () => {
    it("preserves marketing robots.txt and sitemaps on bidwar.in without interference from fan changes", async () => {
      const resRobots = await request(app)
        .get("/robots.txt")
        .set("Host", "bidwar.in");

      expect(resRobots.status).toBe(200);
      expect(resRobots.text).toContain("Sitemap: https://bidwar.in/sitemap-index.xml");
      expect(resRobots.text).toContain("Disallow: /tournament/");
      expect(resRobots.text).toContain("Allow: /pricing");
    });
  });

  // Case 18: Fan hostname isolation
  describe("Case 18: Fan hostname isolation", () => {
    it("never references bidwar.in on fan platform endpoints", async () => {
      const resRobots = await request(app)
        .get("/robots.txt")
        .set("Host", "fan.bidwar.in");
      const resSitemapIndex = await request(app)
        .get("/sitemap-index.xml")
        .set("Host", "fan.bidwar.in");
      const resTournament = await request(app)
        .get("/MPL2026")
        .set("Host", "fan.bidwar.in");

      expect(resRobots.text).not.toContain("https://bidwar.in");
      expect(resSitemapIndex.text).not.toContain("https://bidwar.in");
      expect(resTournament.text).not.toContain('href="https://bidwar.in/');
    });
  });
});
