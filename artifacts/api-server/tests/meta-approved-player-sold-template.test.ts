import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter, {
  CANONICAL_WA_TEMPLATES,
  ensureCanonicalTemplatesSeeded,
} from "../src/routes/comm";
import {
  notifyPlayerSold,
  clearPlayerSoldIdempotencyCache,
  resolvePlayerSoldImageUrl,
  META_AUCTION_PLAYER_SOLD_TEMPLATE,
  META_AUCTION_PLAYER_SOLD_LANGUAGE,
  META_AUCTION_PLAYER_SOLD_CATEGORY,
} from "../src/lib/whatsapp";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
  MetaDirectProvider,
} from "../src/lib/communication/providers";
import {
  db,
  tournamentsTable,
  playersTable,
  teamsTable,
  waTemplatesTable,
  waConsentEventsTable,
  commLogsTable,
} from "@workspace/db";
import { logger } from "../src/lib/logger";
import { isTournamentLicensedForComm } from "../src/lib/comm-sender";

describe("BIDWAR — Meta-Approved WhatsApp auction_player_sold Template Integration", () => {
  const originalEnv = { ...process.env };
  let mockProvider: MockWhatsAppProvider;

  const licensedTournament = {
    id: 101,
    name: "Indian Premier League 2026",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "https://bidwar.in";
    clearPlayerSoldIdempotencyCache();

    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();
    vi.restoreAllMocks();

    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([licensedTournament]),
              limit: vi.fn().mockResolvedValue([licensedTournament]),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([licensedTournament]),
              }),
            };
          }
          if (table === waConsentEventsTable) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
                limit: vi.fn().mockResolvedValue([]),
              }),
            };
          }
          if (table === waTemplatesTable) {
            return {
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: 1,
                  templateName: "auction_player_sold",
                  category: "utility",
                  description: "Approved player sold template",
                  status: "approved",
                },
              ]),
              where: vi.fn().mockResolvedValue([
                {
                  id: 1,
                  templateName: "auction_player_sold",
                  category: "utility",
                  status: "approved",
                },
              ]),
            };
          }
          if (table === playersTable) {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 10,
                    name: "Shubman Gill",
                    mobileNumber: "9876543210",
                    whatsappConsent: true,
                  },
                ]),
              }),
            };
          }
          return {
            where: vi.fn().mockResolvedValue([]),
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          };
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
    clearPlayerSoldIdempotencyCache();
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Exact Meta Template Name, Language, Category & Canonical Registry
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Exact Meta Template Specification", () => {
    it("defines auction_player_sold as canonical with language 'en' and utility category", () => {
      expect(META_AUCTION_PLAYER_SOLD_TEMPLATE).toBe("auction_player_sold");
      expect(META_AUCTION_PLAYER_SOLD_LANGUAGE).toBe("en");
      expect(META_AUCTION_PLAYER_SOLD_CATEGORY).toBe("utility");

      const tpl = CANONICAL_WA_TEMPLATES["auction_player_sold"];
      expect(tpl).toBeDefined();
      expect(tpl.templateName).toBe("auction_player_sold");
      expect(tpl.category).toBe("utility");
      expect(tpl.language).toBe("en");
      expect(tpl.headerType).toBe("image");
      expect(tpl.metaApproved).toBe(true);
      expect(tpl.variables).toHaveLength(4);
    });

    it("verifies the exact approved template body matches Meta WhatsApp Manager source of truth", () => {
      const tpl = CANONICAL_WA_TEMPLATES["auction_player_sold"];
      expect(tpl.body).toContain("🏏 PLAYER SOLD!");
      expect(tpl.body).toContain("Congratulations, {{1}}! 🎉");
      expect(tpl.body).toContain("You have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.");
      expect(tpl.body).toContain("Wishing you and your team great success in the tournament!");
      expect(tpl.body).toContain("BIDWAR | From Auction to Champions");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Exact Four-Variable Mapping & Order
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Variable Mapping and Ordering ({{1}} to {{4}})", () => {
    it("maps {{1}}=player, {{2}}=team, {{3}}=amount, {{4}}=tournament in exact order", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Rohit Sharma",
        teamName: "Mumbai Warriors",
        amount: 25000000,
        tournamentName: "Indian Premier League 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      const messages = mockProvider.getSentMessages();
      expect(messages).toHaveLength(1);

      const msg = messages[0];
      expect(msg.templateName).toBe("auction_player_sold");
      expect(msg.templateLanguage).toBe("en");
      expect(msg.type).toBe("template");

      const bodyComponent = msg.templateComponents?.find((c) => c.type === "body");
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent?.parameters).toHaveLength(4);

      // Verify exact parameter ordering and values
      expect(bodyComponent?.parameters[0]).toEqual({ type: "text", text: "Rohit Sharma" });
      expect(bodyComponent?.parameters[1]).toEqual({ type: "text", text: "Mumbai Warriors" });
      expect(bodyComponent?.parameters[2]).toEqual({ type: "text", text: "₹2,50,00,000" });
      expect(bodyComponent?.parameters[3]).toEqual({ type: "text", text: "Indian Premier League 2026" });

      // Fallback/preview textBody check
      expect(msg.textBody).toContain("Congratulations, Rohit Sharma! 🎉");
      expect(msg.textBody).toContain("sold to *Mumbai Warriors* for *₹2,50,00,000* in the *Indian Premier League 2026* auction");
    });

    it("safely sanitizes Unicode and special characters without sending literal {{1}} placeholders", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "विराट कोहली (Captain)",
        teamName: "Royal Challengers™ & Bangalore",
        amount: 18000000,
        tournamentName: "T20 Cup 2026 🏏",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      const msg = mockProvider.getSentMessages()[0];
      const bodyComponent = msg.templateComponents?.find((c) => c.type === "body");

      expect(bodyComponent?.parameters[0].text).toBe("विराट कोहली (Captain)");
      expect(bodyComponent?.parameters[1].text).toBe("Royal Challengers™ & Bangalore");
      expect(bodyComponent?.parameters[2].text).toBe("₹1,80,00,000");
      expect(bodyComponent?.parameters[3].text).toBe("T20 Cup 2026 🏏");

      expect(msg.textBody).not.toContain("{{1}}");
      expect(msg.textBody).not.toContain("{{2}}");
      expect(msg.textBody).not.toContain("{{3}}");
      expect(msg.textBody).not.toContain("{{4}}");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Image Header Attachment & Source Resolution
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Image Header Component & Source Resolution", () => {
    it("attaches image header parameter pointing to accessible URL", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Hardik Pandya",
        teamName: "Mumbai Warriors",
        amount: 15000000,
        tournamentName: "IPL 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      const msg = mockProvider.getSentMessages()[0];

      const headerComponent = msg.templateComponents?.find((c) => c.type === "header");
      expect(headerComponent).toBeDefined();
      expect(headerComponent?.parameters).toHaveLength(1);
      expect(headerComponent?.parameters[0].type).toBe("image");
      expect(headerComponent?.parameters[0].image?.link).toMatch(
        /^https:\/\/bidwar\.in\/(api\/media\/player-sold-poster\/[a-f0-9]+\.png|assets\/branding\/player-sold-banner\.jpg)$/,
      );
    });

    it("respects custom WHATSAPP_PLAYER_SOLD_IMAGE_URL environment override", () => {
      process.env.WHATSAPP_PLAYER_SOLD_IMAGE_URL = "https://cdn.bidwar.in/wa/custom-sold.jpg";
      const resolved = resolvePlayerSoldImageUrl();
      expect(resolved).toBe("https://cdn.bidwar.in/wa/custom-sold.jpg");
    });

    it("fails safely when header image URL is invalid or malformed", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Jasprit Bumrah",
        teamName: "Mumbai Warriors",
        amount: 12000000,
        tournamentName: "IPL 2026",
        whatsappConsent: true,
        headerImageUrl: "not-a-valid-http-url",
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Missing or invalid header image URL");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Duplicate Event / Idempotency Suppression
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Idempotency & Duplicate Event Prevention", () => {
    it("suppresses duplicate dispatches for the same player sale within TTL", async () => {
      const opts = {
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 777,
        playerName: "MS Dhoni",
        teamId: 2,
        teamName: "Chennai Super Kings",
        amount: 20000000,
        tournamentName: "IPL 2026",
        whatsappConsent: true,
      };

      // First call -> success
      const firstRes = await notifyPlayerSold(opts);
      expect(firstRes.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);

      // Second immediate call (e.g. network retry or duplicated webhook event)
      const secondRes = await notifyPlayerSold(opts);
      expect(secondRes.success).toBe(true);
      expect(secondRes.blocked).toBe(true);
      expect(secondRes.messageSid).toBe("suppressed_duplicate_idempotency");
      // Must not deliver a second message to provider
      expect(mockProvider.getSentMessages()).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Consent Enforcement & Fail-Closed Guards
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Consent Lifecycle & Fail-Closed Enforcement", () => {
    it("blocks WhatsApp dispatch when consent is false (no SMS fallback)", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Unconsented Player",
        teamName: "Test Team",
        amount: 500000,
        tournamentName: "IPL 2026",
        whatsappConsent: false,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("missing_or_unverified_consent");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("blocks WhatsApp dispatch when consent is revoked via STOP / opt-out", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waConsentEventsTable) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ eventType: "STOP_REVOKED" }]),
                }),
              }),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Opted Out Player",
        teamName: "Test Team",
        amount: 500000,
        tournamentName: "IPL 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("STOP");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Meta Direct Cloud API Adapter Compatibility
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Meta Direct Provider Cloud API Payload Verification", () => {
    it("constructs native Meta Graph API payload with image header and 4 body parameters", async () => {
      const metaProvider = new MetaDirectProvider({
        phoneNumberId: "1234567890",
        accessToken: "EAAG_TEST_TOKEN",
        apiVersion: "v19.0",
      });

      let capturedPayload: any = null;
      let capturedUrl = "";

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        capturedUrl = url.toString();
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.META_APPROVED_MSG_123" }] }),
          { status: 200 },
        );
      });

      const res = await metaProvider.send({
        to: "919876543210",
        type: "template",
        templateName: "auction_player_sold",
        templateLanguage: "en",
        templateComponents: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: { link: "https://bidwar.in/assets/branding/player-sold-banner.jpg" },
              },
            ],
          },
          {
            type: "body",
            parameters: [
              { type: "text", text: "KL Rahul" },
              { type: "text", text: "Lucknow Super Giants" },
              { type: "text", text: "₹17,00,00,000" },
              { type: "text", text: "IPL 2026" },
            ],
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.META_APPROVED_MSG_123");
      expect(capturedUrl).toContain("https://graph.facebook.com/v19.0/1234567890/messages");
      expect(capturedPayload.type).toBe("template");
      expect(capturedPayload.template.name).toBe("auction_player_sold");
      expect(capturedPayload.template.language.code).toBe("en");
      expect(capturedPayload.template.components[0].type).toBe("header");
      expect(capturedPayload.template.components[0].parameters[0].image.link).toBe(
        "https://bidwar.in/assets/branding/player-sold-banner.jpg",
      );
      expect(capturedPayload.template.components[1].type).toBe("body");
      expect(capturedPayload.template.components[1].parameters[0].text).toBe("KL Rahul");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Communication Center Route API Integration
  // ───────────────────────────────────────────────────────────────────────────
  describe("7. Communication Center Template Registry & Send Route", () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).jwtUser = { isAdmin: true, adminLevel: "master" };
      next();
    });
    app.use("/", commRouter);

    it("GET /auth/admin/communicate/templates returns auction_player_sold with image header metadata", async () => {
      const res = await request(app).get("/auth/admin/communicate/templates");
      expect(res.body.error).toBeUndefined();
      expect(res.status).toBe(200);

      const soldTmpl = res.body.find((t: any) => t.templateName === "auction_player_sold");
      expect(soldTmpl).toBeDefined();
      expect(soldTmpl.category).toBe("utility");
      expect(soldTmpl.headerType).toBe("image");
      expect(soldTmpl.headerImageUrl).toContain("/assets/branding/player-sold-banner.jpg");
      expect(soldTmpl.language).toBe("en");
      expect(soldTmpl.metaApproved).toBe(true);
      expect(soldTmpl.variables).toHaveLength(4);
    });

    it("POST /auth/admin/communicate/send with auction_player_sold dispatches template with image header", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          tournamentId: 101,
          channel: "whatsapp",
          templateName: "auction_player_sold",
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateVariables: {
            "1": "Shubman Gill",
            "2": "Gujarat Titans",
            "3": "₹16,50,00,000",
            "4": "IPL 2026",
          },
        });

      expect(res.body.error).toBeUndefined();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sent).toBe(1);

      const sent = mockProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      expect(sent[0].type).toBe("template");
      expect(sent[0].templateName).toBe("auction_player_sold");
      expect(sent[0].templateLanguage).toBe("en");

      const header = sent[0].templateComponents?.find((c) => c.type === "header");
      expect(header?.parameters[0].image?.link).toMatch(
        /^https:\/\/bidwar\.in\/(api\/media\/player-sold-poster\/[a-f0-9]+\.png|assets\/branding\/player-sold-banner\.jpg)$/,
      );
    });

    it("POST /auth/admin/communicate/send rejects dispatches with missing required variables", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          templateName: "auction_player_sold",
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateVariables: {
            "1": "Shubman Gill",
            // missing 2, 3, 4
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing required template variable(s)");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Tournament-Level WhatsApp Disablement (Discounted / In-Person License)
  // ───────────────────────────────────────────────────────────────────────────
  describe("7. Tournament-Level WhatsApp Disablement (Discounted / In-Person License)", () => {
    it("isTournamentLicensedForComm returns false when whatsappNotifications is false even with active license", () => {
      // 1. Active license + no feature override -> allowed
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "active",
          adminLocked: false,
        }),
      ).toBe(true);

      // 2. Active license + whatsappNotifications: true -> allowed
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "active",
          adminLocked: false,
          featuresJson: { whatsappNotifications: true },
        }),
      ).toBe(true);

      // 3. Active license BUT admin disabled WhatsApp (e.g. paid lesser amount in person) -> strictly BLOCKED
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "active",
          adminLocked: false,
          featuresJson: { whatsappNotifications: false },
        }),
      ).toBe(false);

      // 4. Also works if passed as resolved features object
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "active",
          adminLocked: false,
          features: { whatsappNotifications: false },
        }),
      ).toBe(false);
    });

    it("evaluatePushPolicy suppresses WhatsApp push when tournament has whatsappNotifications disabled", async () => {
      const { CommunicationPolicyEngine } = await import(
        "../src/lib/communication/policy-engine"
      );
      const engine = new CommunicationPolicyEngine();

      const policy = await engine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournamentId: 101,
        recipientMobile: "+919876543210",
        recipientConsent: true,
        templateName: "auction_player_sold",
        tournament: {
          licenseStatus: "active",
          adminLocked: false,
          featuresJson: { whatsappNotifications: false },
        },
      });

      expect(policy.allowed).toBe(false);
      expect(policy.reason).toBe(
        "WhatsApp communications explicitly disabled by admin for this tournament",
      );
    });
  });
});
