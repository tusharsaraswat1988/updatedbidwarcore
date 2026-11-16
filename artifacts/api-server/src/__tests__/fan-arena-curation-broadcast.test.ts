import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  validateBroadcastUrl,
  evaluateFanArenaEligibility,
  resolvePublicBroadcasts,
} from "@workspace/platform-core";

// Mock data fixtures
const mockTournaments: Record<number, any> = {
  501: {
    id: 501,
    name: "Premier City Cricket League",
    sport: "cricket",
    city: "Mumbai",
    venue: "Wankhede",
    organizerId: 77,
    organizerName: "Authorized Host",
    organizerMobile: "919988776655",
    organizerEmail: "host@premier.com",
    scoringPin: "4321",
    auctionEnabled: true,
    scoringEnabled: true,
    status: "active",
    licenseStatus: "active", // Licensed by BidWar
    adminLocked: false,
    featuresJson: {
      visibility: "public",
      fanArenaOptIn: true,
      broadcast: {
        auction: {
          url: "https://www.youtube.com/watch?v=live123",
          platform: "youtube",
          enabled: true,
          status: "live",
          title: "Main Auction Live",
        },
        scoring: {
          url: "https://twitch.tv/cricketstream",
          platform: "twitch",
          enabled: false, // Disabled
          status: "live",
        },
      },
      matchBroadcasts: {
        "1001": {
          url: "https://facebook.com/live/match1",
          platform: "facebook",
          enabled: true,
          status: "live",
          title: "Match 1 Stream",
        },
      },
    },
    createdAt: new Date(),
  },
  502: {
    id: 502,
    name: "Opted-Out Public Cup",
    sport: "badminton",
    organizerId: 77,
    auctionEnabled: true,
    scoringEnabled: false,
    status: "setup",
    licenseStatus: "active",
    adminLocked: false,
    featuresJson: {
      visibility: "public",
      fanArenaOptIn: false, // Organizer opted OUT
    },
    createdAt: new Date(),
  },
  503: {
    id: 503,
    name: "Unlicensed Trial Tournament",
    sport: "cricket",
    organizerId: 77,
    auctionEnabled: true,
    scoringEnabled: false,
    status: "setup",
    licenseStatus: "trial", // Not active
    adminLocked: false,
    featuresJson: {
      visibility: "public",
      fanArenaOptIn: true, // Opted in, but NOT licensed or approved
      fanArenaApproved: false,
    },
    createdAt: new Date(),
  },
  504: {
    id: 504,
    name: "Admin Curated Community Trophy",
    sport: "football",
    organizerId: 77,
    auctionEnabled: false,
    scoringEnabled: true,
    status: "setup",
    licenseStatus: "trial",
    adminLocked: false,
    featuresJson: {
      visibility: "public",
      fanArenaOptIn: true,
      fanArenaApproved: true, // Explicitly approved by BidWar Admin!
    },
    createdAt: new Date(),
  },
  505: {
    id: 505,
    name: "Private Member League",
    sport: "badminton",
    organizerId: 77,
    auctionEnabled: true,
    scoringEnabled: true,
    status: "setup",
    licenseStatus: "active",
    adminLocked: false,
    featuresJson: {
      visibility: "private", // Private visibility
      fanArenaOptIn: true,
    },
    createdAt: new Date(),
  },
  506: {
    id: 506,
    name: "Locked Tournament",
    sport: "cricket",
    organizerId: 77,
    auctionEnabled: true,
    scoringEnabled: false,
    status: "setup",
    licenseStatus: "active",
    adminLocked: true, // Locked!
    featuresJson: {
      visibility: "public",
      fanArenaOptIn: true,
    },
    createdAt: new Date(),
  },
  507: {
    id: 507,
    name: "Dev [test] Tournament",
    sport: "cricket",
    organizerId: 77,
    auctionEnabled: true,
    scoringEnabled: false,
    status: "setup",
    licenseStatus: "active",
    adminLocked: false,
    featuresJson: {
      visibility: "public",
      fanArenaOptIn: true,
    },
    createdAt: new Date(),
  },
};

function makeMockQueryArray<T>(items: T[]): T[] & {
  orderBy: () => any;
  limit: () => any;
  groupBy: () => any;
} {
  const arr = [...items] as any;
  arr.orderBy = () => arr;
  arr.limit = () => arr;
  arr.groupBy = () => arr;
  return arr;
}

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: () => ({
        from: (table: any) => ({
          where: (expr: any) => {
            const targetId = expr?.queryChunks?.find((chunk: any) => typeof chunk === "number");
            if (targetId && mockTournaments[targetId]) {
              return makeMockQueryArray([mockTournaments[targetId]]);
            }
            if (targetId) {
              return makeMockQueryArray([]);
            }
            // Return all tournaments for discovery filtering
            return makeMockQueryArray(Object.values(mockTournaments));
          },
          groupBy: () => makeMockQueryArray([]),
          orderBy: () => makeMockQueryArray([]),
          limit: () => ({
            where: () => makeMockQueryArray([]),
          }),
        }),
      }),
      update: () => ({
        set: (patch: any) => ({
          where: (expr: any) => {
            const targetId = expr?.queryChunks?.find((chunk: any) => typeof chunk === "number");
            if (targetId && mockTournaments[targetId]) {
              Object.assign(mockTournaments[targetId], patch);
            }
            return Promise.resolve();
          },
        }),
      }),
    },
    tournamentsTable: {
      id: "id",
      name: "name",
      sport: "sport",
      city: "city",
      venue: "venue",
      organizerId: "organizerId",
      organizerName: "organizerName",
      adminLocked: "adminLocked",
      auctionEnabled: "auctionEnabled",
      scoringEnabled: "scoringEnabled",
      featuresJson: "featuresJson",
      licenseStatus: "licenseStatus",
      status: "status",
      createdAt: "createdAt",
    },
    scoringMatchesTable: {
      id: "id",
      tournamentId: "tournamentId",
      status: "status",
      homeTeamId: "homeTeamId",
      awayTeamId: "awayTeamId",
      brandingJson: "brandingJson",
    },
    teamsTable: {
      id: "id",
      name: "name",
      tournamentId: "tournamentId",
    },
  };
});

// Mock requireOrganizer to verify security checks
let mockCallerRole: "anonymous" | "organizer_77" | "unauthorized_organizer" | "admin" = "anonymous";

vi.mock("../middleware/require-organizer", () => {
  return {
    requireTournamentOrganizer: vi.fn(async (req: any, res: any, tournamentId: number) => {
      if (mockCallerRole === "admin") return true;
      if (mockCallerRole === "organizer_77" && tournamentId === 501) return true;
      res.status(403).json({ error: "Authentication required" });
      return false;
    }),
    canAccessPrivateTournamentData: vi.fn(async (_req: any, _tournamentId: number) => {
      return mockCallerRole === "admin" || mockCallerRole === "organizer_77";
    }),
  };
});

vi.mock("../middleware/require-admin", () => {
  return {
    requireAdmin: vi.fn((req: any, res: any, next: any) => {
      if (mockCallerRole === "admin") {
        next();
      } else {
        res.status(401).json({ error: "Admin access required" });
      }
    }),
  };
});

import fanDiscoveryRouter from "../routes/fan-discovery";
import fanBroadcastRouter from "../routes/fan-broadcast";

describe("PHASE 5 — Fan Arena Curation & Broadcast Links", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api", fanDiscoveryRouter);
    app.use("/api", fanBroadcastRouter);
    mockCallerRole = "anonymous";
  });

  describe("1. Broadcast URL Validation & SSRF Protections", () => {
    it("accepts valid HTTPS URLs from YouTube, Facebook, Twitch, and generic providers", () => {
      const yt = validateBroadcastUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(yt.valid).toBe(true);
      expect(yt.platform).toBe("youtube");

      const fb = validateBroadcastUrl("https://fb.watch/xyz123/");
      expect(fb.valid).toBe(true);
      expect(fb.platform).toBe("facebook");

      const twitch = validateBroadcastUrl("https://twitch.tv/cricketlive");
      expect(twitch.valid).toBe(true);
      expect(twitch.platform).toBe("twitch");

      const custom = validateBroadcastUrl("https://stream.myarena.org/live");
      expect(custom.valid).toBe(true);
      expect(custom.platform).toBe("other");
    });

    it("rejects non-HTTPS schemes (http, javascript, data, file, ftp)", () => {
      expect(validateBroadcastUrl("http://youtube.com/watch?v=123").valid).toBe(false);
      expect(validateBroadcastUrl("javascript:alert(1)").valid).toBe(false);
      expect(validateBroadcastUrl("data:text/html,<script>alert(1)</script>").valid).toBe(false);
      expect(validateBroadcastUrl("file:///etc/passwd").valid).toBe(false);
      expect(validateBroadcastUrl("ftp://stream.com/live").valid).toBe(false);
    });

    it("strictly blocks SSRF loopback, private IPv4, and cloud metadata destinations", () => {
      // Loopback
      expect(validateBroadcastUrl("https://localhost:8080/stream").valid).toBe(false);
      expect(validateBroadcastUrl("https://127.0.0.1/admin").valid).toBe(false);
      expect(validateBroadcastUrl("https://[::1]/live").valid).toBe(false);

      // Private RFC 1918
      expect(validateBroadcastUrl("https://10.0.0.1/live").valid).toBe(false);
      expect(validateBroadcastUrl("https://172.16.0.1/stream").valid).toBe(false);
      expect(validateBroadcastUrl("https://192.168.1.1/video").valid).toBe(false);

      // Cloud Metadata
      expect(validateBroadcastUrl("https://169.254.169.254/latest/meta-data").valid).toBe(false);

      // Internal hostnames
      expect(validateBroadcastUrl("https://internal.corp/stream").valid).toBe(false);
      expect(validateBroadcastUrl("https://server.local/live").valid).toBe(false);
    });

    it("rejects malformed syntax, empty strings, and overly long URLs", () => {
      expect(validateBroadcastUrl("").valid).toBe(false);
      expect(validateBroadcastUrl("   ").valid).toBe(false);
      expect(validateBroadcastUrl("not-a-url").valid).toBe(false);
      expect(validateBroadcastUrl("https://" + "a".repeat(600) + ".com").valid).toBe(false);
    });
  });

  describe("2. Canonical 7-Point Fan Arena Eligibility Logic", () => {
    it("evaluates licensed + public + opted-in tournament as eligible", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[501]);
      expect(res.eligible).toBe(true);
      expect(res.reasons).toHaveLength(0);
      expect(res.details.isOptedIn).toBe(true);
      expect(res.details.isLicensedOrApproved).toBe(true);
      expect(res.details.isPublic).toBe(true);
    });

    it("evaluates admin-approved tournament as eligible even if trial license", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[504]);
      expect(res.eligible).toBe(true);
      expect(res.details.isLicensedOrApproved).toBe(true);
    });

    it("rejects tournaments without organizer opt-in", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[502]);
      expect(res.eligible).toBe(false);
      expect(res.reasons).toContain("Organizer has not opted in to Fan Arena listing.");
    });

    it("rejects unlicensed tournaments without admin approval", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[503]);
      expect(res.eligible).toBe(false);
      expect(res.reasons).toContain("Tournament requires a BidWar live license or curation approval.");
    });

    it("rejects private or unlisted tournaments", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[505]);
      expect(res.eligible).toBe(false);
      expect(res.reasons).toContain("Tournament visibility is not public (unlisted or private).");
    });

    it("rejects admin-locked tournaments", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[506]);
      expect(res.eligible).toBe(false);
      expect(res.reasons).toContain("Tournament is locked by administrator.");
    });

    it("rejects test / demo / simulation tournaments", () => {
      const res = evaluateFanArenaEligibility(mockTournaments[507]);
      expect(res.eligible).toBe(false);
      expect(res.reasons).toContain("Tournament is marked as a test, demo, or simulation event.");
    });
  });

  describe("3. Organizer Broadcast Management API Security", () => {
    it("blocks unauthenticated callers from reading broadcast settings", async () => {
      mockCallerRole = "anonymous";
      const res = await request(app).get("/api/tournaments/501/broadcast");
      expect(res.status).toBe(403);
    });

    it("blocks unauthenticated callers from updating broadcast links", async () => {
      mockCallerRole = "anonymous";
      const res = await request(app)
        .put("/api/tournaments/501/broadcast")
        .send({
          broadcast: {
            auction: { url: "https://youtube.com/live/123", enabled: true, status: "live" },
          },
        });
      expect(res.status).toBe(403);
    });

    it("allows authorized tournament organizer to read broadcast settings & eligibility", async () => {
      mockCallerRole = "organizer_77";
      const res = await request(app).get("/api/tournaments/501/broadcast");
      expect(res.status).toBe(200);
      expect(res.body.tournamentId).toBe(501);
      expect(res.body.fanArenaOptIn).toBe(true);
      expect(res.body.eligibility.eligible).toBe(true);
      expect(res.body.broadcast.auction.url).toBe("https://www.youtube.com/watch?v=live123");
    });

    it("rejects unsafe URLs submitted by organizer with 400 Validation Error", async () => {
      mockCallerRole = "organizer_77";
      const res = await request(app)
        .put("/api/tournaments/501/broadcast")
        .send({
          broadcast: {
            auction: { url: "http://insecure-http.com/stream", enabled: true, status: "live" },
          },
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid auction broadcast URL");
    });

    it("rejects SSRF destinations submitted by organizer with 400 Validation Error", async () => {
      mockCallerRole = "organizer_77";
      const res = await request(app)
        .put("/api/tournaments/501/broadcast")
        .send({
          broadcast: {
            scoring: { url: "https://169.254.169.254/meta-data", enabled: true, status: "live" },
          },
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid scoring broadcast URL");
    });

    it("allows organizer to save valid broadcast links and toggles", async () => {
      mockCallerRole = "organizer_77";
      const res = await request(app)
        .put("/api/tournaments/501/broadcast")
        .send({
          fanArenaOptIn: true,
          broadcast: {
            auction: {
              url: "https://www.youtube.com/watch?v=updated789",
              enabled: true,
              status: "live",
              title: "Updated Live Stream",
            },
            scoring: null, // cleared
          },
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.broadcast.auction.url).toBe("https://www.youtube.com/watch?v=updated789");
    });

    it("allows organizer to toggle Fan Arena opt-in via dedicated endpoint", async () => {
      mockCallerRole = "organizer_77";
      const res = await request(app)
        .put("/api/tournaments/501/fan-arena")
        .send({ optIn: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.fanArenaOptIn).toBe(true);
    });
  });

  describe("4. Super Admin Curation Approval API", () => {
    it("blocks non-admin callers from modifying curation approval", async () => {
      mockCallerRole = "organizer_77";
      const res = await request(app)
        .post("/api/auth/admin/tournaments/503/fan-arena-approval")
        .send({ approved: true });
      expect(res.status).toBe(401);
    });

    it("allows Super Admin to approve a tournament for Fan Arena curation", async () => {
      mockCallerRole = "admin";
      const res = await request(app)
        .post("/api/auth/admin/tournaments/503/fan-arena-approval")
        .send({ approved: true });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.fanArenaApproved).toBe(true);
      expect(res.body.eligibility.eligible).toBe(true); // Now eligible!
    });
  });

  describe("5. Public Discovery Feed Curation & Broadcast Metadata", () => {
    it("only returns tournaments meeting all 7 eligibility criteria", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=50");
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();

      const returnedIds = res.body.items.map((i: any) => i.id);

      // Eligible tournaments: 501 (licensed + opted-in) and 504 (approved + opted-in)
      expect(returnedIds).toContain(501);
      expect(returnedIds).toContain(504);

      // Ineligible tournaments must NOT be returned in discovery feed:
      expect(returnedIds).not.toContain(502); // Opted out
      expect(returnedIds).not.toContain(506); // Admin locked
      expect(returnedIds).not.toContain(507); // Test tournament
      expect(returnedIds).not.toContain(505); // Private tournament
    });

    it("includes safe public broadcast metadata on discovery cards and suppresses disabled streams", async () => {
      const res = await request(app).get("/api/fan/tournaments?limit=50");
      expect(res.status).toBe(200);

      const card501 = res.body.items.find((i: any) => i.id === 501);
      expect(card501).toBeDefined();

      // Enabled auction broadcast is present
      expect(card501.broadcast).toBeDefined();
      expect(card501.broadcast.auction).toBeDefined();
      expect(card501.broadcast.auction.url).toContain("youtube.com");
      expect(card501.broadcast.auction.platform).toBe("youtube");

      // Disabled scoring broadcast is suppressed from public card
      expect(card501.broadcast.scoring).toBeUndefined();

      // Zero sensitive data leakage
      expect(card501).not.toHaveProperty("organizerMobile");
      expect(card501).not.toHaveProperty("organizerEmail");
      expect(card501).not.toHaveProperty("scoringPin");
    });
  });
});
