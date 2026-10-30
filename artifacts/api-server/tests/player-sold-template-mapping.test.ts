import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  notifyPlayerSold,
  resolvePlayerSoldImageUrl,
  clearPlayerSoldIdempotencyCache,
  META_AUCTION_PLAYER_SOLD_TEMPLATE,
  META_AUCTION_PLAYER_SOLD_LANGUAGE,
} from "../src/lib/whatsapp";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
  KVTechMediaProvider,
  MetaDirectProvider,
} from "../src/lib/communication/providers";
import { db, tournamentsTable, playersTable, teamsTable, waConsentEventsTable, commLogsTable } from "@workspace/db";
import { communicationPolicyEngine } from "../src/lib/communication/policy-engine";

describe("Player Sold Meta Template Mapping & Payload Integration", () => {
  const originalEnv = { ...process.env };
  let mockProvider: MockWhatsAppProvider;

  const licensedTournament = {
    id: 101,
    name: "Premier League 2026",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
    organizerMobile: "9876543210",
    organizerId: 5,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPlayerSoldIdempotencyCache();
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();

    // Default mock: DB select returns licensed tournament and unrevoked state
    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: vi.fn().mockResolvedValue([]),
    })) as any);

    vi.spyOn(db, "select").mockImplementation((() => ({
      from: vi.fn().mockImplementation((table: any) => {
        if (table === tournamentsTable) {
          return { where: vi.fn().mockResolvedValue([licensedTournament]) };
        }
        if (table === waConsentEventsTable) {
          return {
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        };
      }),
    })) as any);
  });

  afterEach(() => {
    clearPlayerSoldIdempotencyCache();
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Verified Asset Image Header Resolution
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Verified Asset Image Header Resolution", () => {
    it("confirms the physical player-sold-banner.jpg asset exists on disk", () => {
      const assetPath = path.resolve(
        __dirname,
        "../../auction-platform/public/assets/branding/player-sold-banner.jpg",
      );
      expect(fs.existsSync(assetPath)).toBe(true);
      const stat = fs.statSync(assetPath);
      expect(stat.size).toBeGreaterThan(100_000); // ~637 KB high-res banner
    });

    it("resolves default header image URL pointing to canonical branding path", () => {
      const url = resolvePlayerSoldImageUrl();
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain("/assets/branding/player-sold-banner.jpg");
    });

    it("resolves relative path customUrl against public origin", () => {
      const url = resolvePlayerSoldImageUrl("/assets/branding/player-sold-banner.jpg");
      expect(url).toMatch(/^https?:\/\//);
      expect(url).toContain("/assets/branding/player-sold-banner.jpg");
    });

    it("preserves valid custom absolute HTTP/HTTPS image URL", () => {
      const custom = "https://cdn.bidwar.in/tournaments/101/custom-sold.jpg";
      const url = resolvePlayerSoldImageUrl(custom);
      expect(url).toBe(custom);
    });

    it("respects WHATSAPP_PLAYER_SOLD_IMAGE_URL environment override if valid", () => {
      process.env.WHATSAPP_PLAYER_SOLD_IMAGE_URL = "https://media.bidwar.in/headers/player-sold-v2.jpg";
      const url = resolvePlayerSoldImageUrl();
      expect(url).toBe("https://media.bidwar.in/headers/player-sold-v2.jpg");
    });

    it("returns malformed customUrl so caller validation rejects invalid image header", () => {
      const url = resolvePlayerSoldImageUrl("not-a-valid-url");
      expect(url).toBe("not-a-valid-url");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Authoritative 4-Variable Mapping & Template Specification
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Authoritative 4-Variable Mapping", () => {
    it("maps all 4 variables accurately into the Meta-approved copy and components", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 42,
        playerName: "Virat Kohli",
        teamId: 7,
        teamName: "Royal Challengers",
        amount: 25000000,
        auctionUnit: "rupee",
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);

      const msg = mockProvider.getSentMessages()[0];
      expect(msg.to).toBe("+919876543210");
      expect(msg.type).toBe("template");
      expect(msg.templateName).toBe(META_AUCTION_PLAYER_SOLD_TEMPLATE);
      expect(msg.templateLanguage).toBe(META_AUCTION_PLAYER_SOLD_LANGUAGE);

      // Verify exact Meta-approved text body
      expect(msg.textBody).toBe(
        "🏏 PLAYER SOLD!\n\n" +
        "Congratulations, Virat Kohli! 🎉\n\n" +
        "You have been sold to *Royal Challengers* for *₹2,50,00,000* in the *Premier League 2026* auction.\n\n" +
        "Wishing you and your team great success in the tournament!\n\n" +
        "BIDWAR | From Auction to Champions",
      );

      // Verify Meta Cloud API templateComponents structure
      expect(msg.templateComponents).toBeDefined();
      expect(msg.templateComponents).toHaveLength(2);

      // Component 0: Image Header
      const headerComp = msg.templateComponents![0];
      expect(headerComp.type).toBe("header");
      expect(headerComp.parameters).toHaveLength(1);
      expect(headerComp.parameters[0].type).toBe("image");
      expect(headerComp.parameters[0].image?.link).toMatch(
        /^https?:\/\/.*\/(api\/media\/player-sold-poster\/[a-f0-9]+\.png|assets\/branding\/player-sold-banner\.jpg)$/,
      );

      // Component 1: Body with 4 parameters: [1: player, 2: team, 3: amount, 4: tournament]
      const bodyComp = msg.templateComponents![1];
      expect(bodyComp.type).toBe("body");
      expect(bodyComp.parameters).toHaveLength(4);
      expect(bodyComp.parameters[0]).toEqual({ type: "text", text: "Virat Kohli" });
      expect(bodyComp.parameters[1]).toEqual({ type: "text", text: "Royal Challengers" });
      expect(bodyComp.parameters[2]).toEqual({ type: "text", text: "₹2,50,00,000" });
      expect(bodyComp.parameters[3]).toEqual({ type: "text", text: "Premier League 2026" });
    });

    it("formats Indian rupee currency correctly for various price tiers", async () => {
      // Test zero, small, lakh, and crore pricing
      const testCases = [
        { amount: 50000, expected: "₹50,000" },
        { amount: 1500000, expected: "₹15,00,000" },
        { amount: 100000000, expected: "₹10,00,00,000" },
      ];

      for (const tc of testCases) {
        clearPlayerSoldIdempotencyCache();
        mockProvider.clearSentMessages();

        await notifyPlayerSold({
          mobile: "+919876543210",
          tournamentId: 101,
          playerId: 10,
          playerName: "Test Player",
          teamName: "Test Team",
          amount: tc.amount,
          auctionUnit: "rupee",
          tournamentName: "Premier League 2026",
          whatsappConsent: true,
        });

        const sent = mockProvider.getSentMessages()[0];
        const bodyComp = sent.templateComponents![1];
        expect(bodyComp.parameters[2].text).toBe(tc.expected);
        expect(sent.textBody).toContain(`for *${tc.expected}* in`);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Provider Payload Generation (KV TechMedia & Meta Direct)
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Provider Payload Construction", () => {
    it("verifies KVTechMediaProvider constructs valid Meta v19.0 Graph API payload", async () => {
      const kvProvider = new KVTechMediaProvider({
        phoneNumberId: "1234567890",
        accessToken: "test_kv_access_token",
        appSecret: "test_secret",
        verifyToken: "test_verify",
      });

      let capturedPayload: any = null;
      vi.spyOn(global, "fetch").mockImplementation(async (_url, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return new Response(JSON.stringify({ messages: [{ id: "wamid.HBgL..." }] }), { status: 200 });
      });

      const sendInput = {
        to: "+919876543210",
        type: "template" as const,
        templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
        templateLanguage: "en",
        templateComponents: [
          {
            type: "header" as const,
            parameters: [{ type: "image" as const, image: { link: "https://bidwar.in/assets/branding/player-sold-banner.jpg" } }],
          },
          {
            type: "body" as const,
            parameters: [
              { type: "text" as const, text: "Jasprit Bumrah" },
              { type: "text" as const, text: "Mumbai Champions" },
              { type: "text" as const, text: "₹18,00,000" },
              { type: "text" as const, text: "T20 Cup 2026" },
            ],
          },
        ],
      };

      const result = await kvProvider.send(sendInput);
      expect(result.success).toBe(true);
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload.messaging_product).toBe("whatsapp");
      expect(capturedPayload.recipient_type).toBe("individual");
      expect(capturedPayload.to).toBe("919876543210");
      expect(capturedPayload.type).toBe("template");
      expect(capturedPayload.template.name).toBe("auction_player_sold");
      expect(capturedPayload.template.language.code).toBe("en");
      expect(capturedPayload.template.components).toHaveLength(2);
      expect(capturedPayload.template.components[0].parameters[0].image.link).toBe("https://bidwar.in/assets/branding/player-sold-banner.jpg");
      expect(capturedPayload.template.components[1].parameters[0].text).toBe("Jasprit Bumrah");
    });

    it("verifies MetaDirectProvider constructs identical native Meta Graph API payload", async () => {
      const metaProvider = new MetaDirectProvider({
        phoneNumberId: "9876543210",
        accessToken: "test_meta_token",
        appSecret: "test_secret",
        verifyToken: "test_verify",
      });

      let capturedPayload: any = null;
      vi.spyOn(global, "fetch").mockImplementation(async (_url, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return new Response(JSON.stringify({ messages: [{ id: "wamid.META..." }] }), { status: 200 });
      });

      const sendInput = {
        to: "9876543210",
        type: "template" as const,
        templateName: META_AUCTION_PLAYER_SOLD_TEMPLATE,
        templateLanguage: "en",
        templateComponents: [
          {
            type: "header" as const,
            parameters: [{ type: "image" as const, image: { link: "https://bidwar.in/assets/branding/player-sold-banner.jpg" } }],
          },
          {
            type: "body" as const,
            parameters: [
              { type: "text" as const, text: "Hardik Pandya" },
              { type: "text" as const, text: "Titans" },
              { type: "text" as const, text: "₹15,00,000" },
              { type: "text" as const, text: "Summer Blast 2026" },
            ],
          },
        ],
      };

      const result = await metaProvider.send(sendInput);
      expect(result.success).toBe(true);
      expect(capturedPayload.template.name).toBe("auction_player_sold");
      expect(capturedPayload.template.components[0].type).toBe("header");
      expect(capturedPayload.template.components[1].parameters).toHaveLength(4);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Idempotency & Duplicate Suppression
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Idempotency & Duplicate Suppression", () => {
    it("suppresses immediate duplicate dispatches for the same sold player and team", async () => {
      const params = {
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 99,
        playerName: "MS Dhoni",
        teamName: "Chennai Kings",
        amount: 20000000,
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      };

      // First dispatch succeeds
      const res1 = await notifyPlayerSold(params);
      expect(res1.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);

      // Immediate duplicate is suppressed
      const res2 = await notifyPlayerSold(params);
      expect(res2.success).toBe(true);
      expect(res2.blocked).toBe(true);
      expect(res2.messageSid).toBe("suppressed_duplicate_idempotency");
      expect(mockProvider.getSentMessages()).toHaveLength(1); // No second send
    });

    it("allows distinct players or distinct tournaments to dispatch independently", async () => {
      await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 1,
        playerName: "Player One",
        teamName: "Team A",
        amount: 100000,
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      await notifyPlayerSold({
        mobile: "+919876543211",
        tournamentId: 101,
        playerId: 2,
        playerName: "Player Two",
        teamName: "Team B",
        amount: 200000,
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      expect(mockProvider.getSentMessages()).toHaveLength(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Fail-Closed Consent Enforcement & Zero SMS Fallback
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Consent & Policy Guards", () => {
    it("blocks dispatch if recipient has not consented to WhatsApp updates", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Unconsented Player",
        teamName: "Team X",
        amount: 500000,
        tournamentName: "Premier League 2026",
        whatsappConsent: false, // Explicitly no consent
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Recipient has not consented to WhatsApp updates");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("blocks dispatch if recipient has revoked WhatsApp updates via STOP/declined", async () => {
      // Mock waConsentEventsTable returning opt_out
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waConsentEventsTable) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ id: 501, eventType: "withdrawn", reason: "STOP_REVOKED" }]),
                }),
              }),
            };
          }
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      })) as any);

      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Revoked Player",
        teamName: "Team Y",
        amount: 700000,
        tournamentName: "Premier League 2026",
        whatsappConsent: true, // Even if entity record says true, revocation event wins
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Recipient has not consented to WhatsApp updates (opted-out via STOP/declined)");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("fails closed without calling SMS fallback when WhatsApp dispatch is blocked", async () => {
      const smsFetchSpy = vi.spyOn(global, "fetch");

      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Blocked Player",
        teamName: "Team Z",
        amount: 1000000,
        tournamentName: "Premier League 2026",
        whatsappConsent: false,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      // No fetch calls were made to BulkSMS or any SMS provider
      expect(smsFetchSpy).not.toHaveBeenCalled();
    });

    it("rejects dispatch safely when mobile number is missing", async () => {
      const res = await notifyPlayerSold({
        mobile: null,
        tournamentId: 101,
        playerName: "Nameless Player",
        teamName: "Team Z",
        amount: 1000000,
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toBe("Missing recipient mobile number");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });
});
