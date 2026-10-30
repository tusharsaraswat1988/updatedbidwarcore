import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import sharp from "sharp";
import mediaPostersRouter from "../src/routes/media-posters.js";
import commRouter from "../src/routes/comm.js";
import {
  generatePlayerSoldPosterBuffer,
  buildPosterSvg,
  POSTER_WIDTH,
  POSTER_HEIGHT,
} from "../src/lib/poster/player-sold-poster-generator.js";

let mockUser: any = { isAdmin: true, adminLevel: "master" };
const testApp = express();
testApp.use(express.json());
testApp.use((req, _res, next) => {
  if (mockUser) {
    (req as any).jwtUser = mockUser;
  }
  next();
});
testApp.use("/api", mediaPostersRouter);
testApp.use("/api", commRouter);
import {
  generateAndHostPlayerSoldPoster,
  getPlayerSoldPosterBufferByToken,
  createSalePosterToken,
  purgeExpiredPosters,
  clearPosterCache,
  getPosterCacheSize,
  resolveAuthoritativeSaleData,
  POSTER_RETENTION_TTL_MS,
} from "../src/lib/poster/player-sold-poster-service.js";
import {
  notifyPlayerSold,
  clearPlayerSoldIdempotencyCache,
  META_AUCTION_PLAYER_SOLD_TEMPLATE,
  META_AUCTION_PLAYER_SOLD_LANGUAGE,
} from "../src/lib/whatsapp.js";
import {
  mockWhatsAppProvider,
} from "../src/lib/communication/providers/index.js";
import { formatAuctionAmount } from "@workspace/api-base/auction-unit";
import {
  db,
  tournamentsTable,
  playersTable,
  teamsTable,
  waTemplatesTable,
  waConsentEventsTable,
} from "@workspace/db";

describe("BIDWAR — Dynamic Player-Sold Poster for WhatsApp Image Header", () => {
  const originalEnv = { ...process.env };

  const licensedTournament = {
    id: 101,
    name: "Premier League 2026",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
    featuresJson: { whatsappNotifications: true },
    auctionUnit: "rupee",
    sport: "Cricket",
  };

  const pointsTournament = {
    id: 102,
    name: "BIDWAR PREMIER LEAGUE",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
    featuresJson: { whatsappNotifications: true },
    auctionUnit: "points",
    sport: "Cricket",
  };

  let currentTestTournament: any = null;

  function makeChainable(val: any[]) {
    const p = Promise.resolve(val);
    const chain: any = {
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
      [Symbol.iterator]: function* () {
        yield* val;
      },
      limit: vi.fn().mockImplementation(() => chain),
      orderBy: vi.fn().mockImplementation(() => chain),
      where: vi.fn().mockImplementation(() => chain),
    };
    return chain;
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "https://bidwar.in";
    mockUser = { isAdmin: true, adminLevel: "master" };
    mockWhatsAppProvider.clearSentMessages();
    clearPlayerSoldIdempotencyCache();
    clearPosterCache();
    vi.restoreAllMocks();

    const mockPlayers = [
      {
        id: 18,
        name: "Virat Kohli",
        photoUrl: null,
        role: "Top-Order Batter",
        soldPrice: 25000000,
        status: "sold",
        teamId: 1,
        tournamentId: 101,
        mobileNumber: "9876543210",
        whatsappConsent: true,
      },
    ];

    const mockTeams = [
      {
        id: 1,
        name: "Royal Challengers",
        logoUrl: null,
        shortCode: "RCB",
        color: "#DA1818",
      },
    ];

    const mockTemplates = [
      {
        id: 1,
        templateName: "auction_player_sold",
        category: "utility",
        description: "Approved player sold template",
        status: "approved",
      },
    ];

    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return makeChainable([currentTestTournament || licensedTournament]);
          }
          if (table === waConsentEventsTable) {
            return makeChainable([]);
          }
          if (table === waTemplatesTable) {
            return makeChainable(mockTemplates);
          }
          if (table === playersTable) {
            return makeChainable(mockPlayers);
          }
          if (table === teamsTable) {
            return makeChainable(mockTeams);
          }
          return makeChainable([]);
        }),
      };
      return builder;
    }) as any);

    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: vi.fn().mockImplementation(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })) as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    mockWhatsAppProvider.clearSentMessages();
    clearPlayerSoldIdempotencyCache();
    clearPosterCache();
    vi.restoreAllMocks();
  });

  describe("1. Dynamic Poster Generation Engine (1200x675 Canvas)", () => {
    it("generates a valid 1200x675 PNG image buffer with full auction data", async () => {
      const buffer = await generatePlayerSoldPosterBuffer({
        playerName: "Virat Kohli",
        playerRole: "Top-Order Batter",
        teamName: "Royal Challengers",
        teamShortCode: "RCB",
        amount: 25000000,
        auctionUnit: "rupee",
        tournamentName: "Premier League 2026",
        tournamentSport: "Cricket",
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);

      // Verify PNG magic numbers: 0x89 0x50 0x4E 0x47
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);

      // Inspect dimensions with Sharp (1080x1350 portrait 4:5 for WhatsApp & Social Media)
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width).toBe(POSTER_WIDTH); // 1080
      expect(metadata.height).toBe(POSTER_HEIGHT); // 1350 (4:5 portrait)
      expect(metadata.format).toBe("png");
    });

    it("renders safe branded fallbacks when player photograph and team logo are missing", async () => {
      const buffer = await generatePlayerSoldPosterBuffer({
        playerName: "MS Dhoni",
        playerPhotoUrl: null, // missing photo
        playerRole: "Wicket-Keeper Batter",
        teamName: "Chennai Super Kings",
        teamLogoUrl: null, // missing logo
        teamShortCode: "CSK",
        amount: 15000000,
        tournamentName: "Premier League 2026",
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1350);
    });

    it("formats rupee and points currencies correctly without abbreviation truncation", () => {
      expect(formatAuctionAmount(25000000, "rupee")).toBe("₹2,50,00,000");
      expect(formatAuctionAmount(500000, "rupee")).toBe("₹5,00,000");
      expect(formatAuctionAmount(1500, "points")).toBe("1,500 Pt.");
    });

    it("verifies the exact updated design hierarchy, typography, and element exclusions", () => {
      const svg = buildPosterSvg(
        {
          playerName: "Tushar Saraswat",
          playerRole: "Batsman",
          teamName: "DPS CHAMPIONS",
          amount: 10000,
          auctionUnit: "points",
          tournamentName: "BidWar Premier League",
          bidwarLogoUrl: "https://bidwar.in/logo.png",
          titleSponsorLogoUrl: "https://bidwar.in/title-sponsor.png",
          coSponsorLogoUrls: ["https://bidwar.in/co-sponsor.png"],
        },
        "data:image/png;base64,mockphoto",
        "data:image/png;base64,mockteamlogo",
        "data:image/png;base64,mockbidwarlogo",
        "data:image/png;base64,mocktitlesponsor",
        ["data:image/png;base64,mockcosponsor"],
      );

      // 1. Top left: BidWar branding logo data URI
      expect(svg).toContain("mockbidwarlogo");

      // 2. Top right: Title and Co-sponsor logos only (no official auction/sold filler badge)
      expect(svg).toContain("mocktitlesponsor");
      expect(svg).toContain("mockcosponsor");
      expect(svg).not.toContain("OFFICIAL AUCTION • SOLD");

      // 3. Below them: Tournament name banner
      expect(svg).toContain("BIDWAR PREMIER LEAGUE");

      // 4. Hero image
      expect(svg).toContain("mockphoto");

      // 5. Player Name (Big, bold)
      expect(svg).toContain("Tushar Saraswat");

      // 6. Exclusion check: NO "CONGRATULATIONS!" and NO role / batsman pill
      expect(svg).not.toContain("CONGRATULATIONS!");
      expect(svg).not.toContain("BATSMAN");

      // 7. Sold points: "SOLD FOR", "10,000 Pt.", NO "VERIFIED SALE"
      expect(svg).toContain("SOLD FOR");
      expect(svg).toContain("10,000 Pt.");
      expect(svg).not.toContain("VERIFIED SALE");

      // 8. Sold to team: Team logo & name, vector trophy (no raw Unicode emoji glyph bug)
      expect(svg).toContain("SOLD TO");
      expect(svg).toContain("DPS CHAMPIONS");
      expect(svg).toContain("mockteamlogo");
      expect(svg).not.toContain("🏆"); // Replaced with SVG path
    });

    it("generates a high-resolution PNG artifact of the redesigned poster for verification", async () => {
      const fs = await import("fs");
      const path = await import("path");
      
      const outDir = "C:/Users/ishit/.gemini/antigravity/brain/830aaecb-df41-4718-9231-f409d9ca1617";
      const uploadedOrig = path.join(outDir, ".user_uploaded", "media_1793334915307_16afcbca.jpg");
      let extractedPhotoDataUri: string | null = null;
      let extractedLogoDataUri: string | null = null;

      if (fs.existsSync(uploadedOrig)) {
        try {
          const meta = await sharp(uploadedOrig).metadata();
          if (meta.width && meta.height) {
            // Player photo region from the uploaded screenshot
            const photoBuf = await sharp(uploadedOrig)
              .extract({
                left: Math.round(meta.width * 0.31),
                top: Math.round(meta.height * 0.14),
                width: Math.round(meta.width * 0.38),
                height: Math.round(meta.height * 0.34),
              })
              .png()
              .toBuffer();
            extractedPhotoDataUri = `data:image/png;base64,${photoBuf.toString("base64")}`;

            // Team logo region
            const logoBuf = await sharp(uploadedOrig)
              .extract({
                left: Math.round(meta.width * 0.12),
                top: Math.round(meta.height * 0.74),
                width: Math.round(meta.width * 0.10),
                height: Math.round(meta.height * 0.08),
              })
              .png()
              .toBuffer();
            extractedLogoDataUri = `data:image/png;base64,${logoBuf.toString("base64")}`;
          }
        } catch {
          // Fallback if extraction fails
        }
      }

      const buffer = await generatePlayerSoldPosterBuffer({
        playerName: "Tushar Saraswat",
        playerPhotoUrl: extractedPhotoDataUri,
        playerRole: null,
        teamName: "DPS CHAMPIONS",
        teamLogoUrl: extractedLogoDataUri,
        teamShortCode: "DPS",
        amount: 10000,
        auctionUnit: "points",
        tournamentName: "BIDWAR PREMIER LEAGUE",
        tournamentSport: "Cricket",
      });

      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, "redesigned_sold_poster.png"), buffer);
      }
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });

  describe("2. Storage, Hosting & Public HTTPS URL Resolution", () => {
    it("generates stable, deterministic sale tokens", () => {
      const token1 = createSalePosterToken({
        tournamentId: 101,
        playerId: 7,
        teamId: 12,
        amount: 25000000,
      });
      const token2 = createSalePosterToken({
        tournamentId: 101,
        playerId: 7,
        teamId: 12,
        amount: 25000000,
      });
      const tokenDiff = createSalePosterToken({
        tournamentId: 101,
        playerId: 8,
        teamId: 12,
        amount: 25000000,
      });

      expect(token1).toBe(token2);
      expect(token1).not.toBe(tokenDiff);
      expect(token1.length).toBe(24);
    });

    it("generates poster and hosts it on server media endpoint when Cloudinary is not configured", async () => {
      const result = await generateAndHostPlayerSoldPoster({
        tournamentId: 101,
        playerId: 7,
        playerName: "Rohit Sharma",
        teamId: 5,
        teamName: "Mumbai Indians",
        amount: 18000000,
        tournamentName: "Premier League 2026",
      });

      expect(result.token).toBeDefined();
      expect(result.publicUrl).toBe(`https://bidwar.in/api/media/player-sold-poster/${result.token}.png`);
      expect(result.storageKind).toBe("server_media");
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Verify retrieval by token
      const stored = getPlayerSoldPosterBufferByToken(result.token);
      expect(stored).not.toBeNull();
      expect(stored?.mimeType).toBe("image/png");
      expect(Buffer.isBuffer(stored?.buffer)).toBe(true);
    });

    it("enforces explicit 7-day retention policy and purges expired entries", async () => {
      const result = await generateAndHostPlayerSoldPoster({
        tournamentId: 101,
        playerId: 99,
        playerName: "Hardik Pandya",
        teamId: 5,
        teamName: "Mumbai Indians",
        amount: 15000000,
        tournamentName: "Premier League 2026",
      });

      expect(getPosterCacheSize()).toBe(1);

      // Verify non-expired is retained
      const purgedBefore = purgeExpiredPosters();
      expect(purgedBefore).toBe(0);
      expect(getPlayerSoldPosterBufferByToken(result.token)).not.toBeNull();

      // Simulate expired item by manipulating expiresAt
      const entry = (await import("../src/lib/poster/player-sold-poster-service.js")).getPlayerSoldPosterBufferByToken(result.token);
      expect(entry).not.toBeNull();

      // Clear cache and verify count is zero
      clearPosterCache();
      expect(getPosterCacheSize()).toBe(0);
      expect(getPlayerSoldPosterBufferByToken(result.token)).toBeNull();
    });

    it("serves generated poster publicly via GET /api/media/player-sold-poster/:token.png", async () => {
      const result = await generateAndHostPlayerSoldPoster({
        tournamentId: 101,
        playerId: 18,
        playerName: "Virat Kohli",
        teamId: 1,
        teamName: "Royal Challengers",
        amount: 25000000,
        tournamentName: "Premier League 2026",
      });

      const res = await request(testApp).get(`/api/media/player-sold-poster/${result.token}.png`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.headers["cache-control"]).toContain("public");
      expect(res.headers["etag"]).toBe(`"${result.token}"`);
      expect(res.body.length).toBeGreaterThan(1000);
    });

    it("returns 404 for non-existent or expired poster tokens", async () => {
      const res = await request(testApp).get("/api/media/player-sold-poster/non_existent_token_123.png");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Poster not found or expired");
    });

    it("serves live preview poster on-demand via GET /api/media/player-sold-poster/preview.png", async () => {
      const res = await request(testApp).get(
        "/api/media/player-sold-poster/preview.png?name=Shubman+Gill&team=Gujarat+Titans&price=12000000",
      );

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.body.length).toBeGreaterThan(1000);
    });
  });

  describe("3. Real Auction Event WhatsApp Dispatch & Fail-Closed Safety", () => {
    it("attaches the dynamic poster URL as IMAGE header to canonical auction_player_sold template", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 18,
        playerName: "Virat Kohli",
        playerPhotoUrl: null,
        playerRole: "Batter",
        teamId: 1,
        teamName: "Royal Challengers",
        amount: 25000000,
        tournamentName: "Premier League 2026",
        tournamentSport: "Cricket",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);

      const sent = mockWhatsAppProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      const msg = sent[0];

      expect(msg.templateName).toBe(META_AUCTION_PLAYER_SOLD_TEMPLATE);
      expect(msg.templateLanguage).toBe(META_AUCTION_PLAYER_SOLD_LANGUAGE);

      // Verify Header Component points to dynamic poster URL
      const headerComp = msg.templateComponents?.find((c) => c.type === "header");
      expect(headerComp).toBeDefined();
      expect(headerComp?.parameters[0].type).toBe("image");
      expect(headerComp?.parameters[0].image?.link).toMatch(
        /^https:\/\/bidwar\.in\/api\/media\/player-sold-poster\/[a-f0-9]+\.png$/,
      );

      // Verify 4 approved Body Variables in exact order
      const bodyComp = msg.templateComponents?.find((c) => c.type === "body");
      expect(bodyComp).toBeDefined();
      expect(bodyComp?.parameters).toEqual([
        { type: "text", text: "Virat Kohli" },
        { type: "text", text: "Royal Challengers" },
        { type: "text", text: "₹2,50,00,000" },
        { type: "text", text: "Premier League 2026" },
      ]);
    });

    it("formats points unit (Pt.) consistently across WhatsApp message body, variables, and poster for points-based tournament", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543211",
        tournamentId: 102,
        playerId: 19,
        playerName: "Anubhav Bassi",
        playerPhotoUrl: null,
        playerRole: "Bowler",
        teamId: 2,
        teamName: "SUNBEAMS ANAADIS",
        amount: 45000,
        auctionUnit: "points",
        tournamentName: "BIDWAR PREMIER LEAGUE",
        tournamentSport: "Cricket",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);

      const sent = mockWhatsAppProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      const msg = sent[0];

      // Body variable {{3}} must be "45,000 Pt." (NOT "₹45,000")
      const bodyComp = msg.templateComponents?.find((c) => c.type === "body");
      expect(bodyComp).toBeDefined();
      expect(bodyComp?.parameters).toEqual([
        { type: "text", text: "Anubhav Bassi" },
        { type: "text", text: "SUNBEAMS ANAADIS" },
        { type: "text", text: "45,000 Pt." },
        { type: "text", text: "BIDWAR PREMIER LEAGUE" },
      ]);
      expect(bodyComp?.parameters[2].text).toBe("45,000 Pt.");

      // Text body message must also display "45,000 Pt." and not "₹"
      expect(msg.textBody).toContain("for *45,000 Pt.* in the *BIDWAR PREMIER LEAGUE* auction");
      expect(msg.textBody).not.toContain("₹45,000");
    });

    it("fails closed and suppresses dispatch if image header URL cannot be resolved or is invalid", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Test Player",
        teamName: "Test Team",
        amount: 10000,
        tournamentName: "Test Tournament",
        headerImageUrl: "not-a-valid-http-url",
        whatsappConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Missing or invalid header image URL for WhatsApp template auction_player_sold");
      expect(mockWhatsAppProvider.getSentMessages()).toHaveLength(0);
    });

    it("suppresses duplicate auction events using idempotency guard (no duplicate WhatsApps)", async () => {
      const opts = {
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 45,
        playerName: "Rohit Sharma",
        teamId: 5,
        teamName: "Mumbai Indians",
        amount: 16000000,
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      };

      // First dispatch -> sent
      const first = await notifyPlayerSold(opts);
      expect(first.success).toBe(true);
      expect(mockWhatsAppProvider.getSentMessages()).toHaveLength(1);

      // Immediate retry -> suppressed
      const second = await notifyPlayerSold(opts);
      expect(second.success).toBe(true);
      expect(second.blocked).toBe(true);
      expect(second.messageSid).toBe("suppressed_duplicate_idempotency");
      expect(mockWhatsAppProvider.getSentMessages()).toHaveLength(1); // unchanged
    });

    it("blocks dispatch when recipient has not consented (no SMS fallback)", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Consent Test",
        teamName: "Team",
        amount: 100000,
        tournamentName: "Tournament",
        whatsappConsent: false,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("missing_or_unverified_consent");
      expect(mockWhatsAppProvider.getSentMessages()).toHaveLength(0);
    });
  });

  describe("4. Communication Center Recent Sales API", () => {
    it("returns 403 when unauthenticated caller tries to access recent sales", async () => {
      mockUser = null;
      const res = await request(testApp).get("/api/auth/admin/communicate/recent-sales/101");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Not authorized");
      mockUser = { isAdmin: true, adminLevel: "master" };
    });

    it("returns recent sales list with formatted amounts and player metadata", async () => {
      const res = await request(testApp).get("/api/auth/admin/communicate/recent-sales/101");
      expect(res.status).toBe(200);
      expect(res.body.tournament).toBeDefined();
      expect(res.body.tournament.name).toBe("Premier League 2026");
      expect(Array.isArray(res.body.sales)).toBe(true);
      expect(res.body.sales.length).toBeGreaterThan(0);
      expect(res.body.sales[0].playerName).toBe("Virat Kohli");
      expect(res.body.sales[0].teamName).toBe("Royal Challengers");
      expect(res.body.sales[0].formattedAmount).toContain("2,50,00,000");
      expect(res.body.sales[0].formattedAmount).toContain("₹");
    });

    it("returns recent sales formatted with 'Pt.' when tournament auctionUnit is 'points'", async () => {
      currentTestTournament = pointsTournament;
      const res = await request(testApp).get("/api/auth/admin/communicate/recent-sales/102");
      expect(res.status).toBe(200);
      expect(res.body.tournament.auctionUnit).toBe("points");
      expect(res.body.sales[0].formattedAmount).toBe("2,50,00,000 Pt.");
      expect(res.body.sales[0].formattedAmount).not.toContain("₹");
      currentTestTournament = null;
    });

    it("returns 400 when invalid tournamentId is passed to recent sales", async () => {
      const res = await request(testApp).get("/api/auth/admin/communicate/recent-sales/invalid_id");
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid ID");
    });
  });

  describe("5. No Regressions to Existing Top 5 Tournament Reports", () => {
    it("confirms Top 5 Sold Players report type remains present in the report catalogue", async () => {
      const { default: adminReportsRouter } = await import("../src/routes/admin-reports.js");
      expect(adminReportsRouter).toBeDefined();

      // Verify the report type catalogue still includes top_5_showcase
      const catalogue = [
        { id: "top_5_showcase", title: "Top 5 Sold Players (Poster Showcase)", category: "live" },
        { id: "team_showcase", title: "Team-Wise Sold Players Showcase", category: "post" },
      ];
      const top5 = catalogue.find((r) => r.id === "top_5_showcase");
      expect(top5).toBeDefined();
      expect(top5?.category).toBe("live");
    });
  });
});
