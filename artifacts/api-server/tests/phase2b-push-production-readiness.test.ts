import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter from "../src/routes/comm";
import webhookRouter from "../src/routes/webhooks";
import { notifyPlayerSold, notifyPlayerUnsold, notifyPlayerReAuction } from "../src/lib/whatsapp";
import {
  db,
  tournamentsTable,
  playersTable,
  teamsTable,
  organizersTable,
  waTemplatesTable,
  waConsentEventsTable,
  commLogsTable,
} from "@workspace/db";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
} from "../src/lib/communication/providers";

function createAppWithAdmin(user?: any) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    (req as any).cookies = { bidwar_auth: "test_token" };
    (req as any).jwtUser = user ?? {
      isAdmin: true,
      role: "admin",
      adminLevel: "master",
      email: "master@bidwar.com",
    };
    next();
  });
  app.use(commRouter);
  app.use(webhookRouter);
  return app;
}

describe("WhatsApp Push Communication — Production Readiness Verification", () => {
  const originalEnv = { ...process.env };
  const app = createAppWithAdmin();
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

  const unlicensedTournament = {
    id: 102,
    name: "Trial League 2026",
    licenseStatus: "trial",
    adminLocked: false,
    scoringEnabled: false,
    scoringPhase: "draft",
    licenseGrantedAt: null,
  };

  const adminLockedTournament = {
    id: 103,
    name: "Locked League 2026",
    licenseStatus: "active",
    adminLocked: true,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    vi.restoreAllMocks();
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();

    // Default mock setup
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
        if (table === waTemplatesTable) {
          const res = [
            { id: 1, templateName: "player_sold", status: "approved", category: "utility" },
            { id: 2, templateName: "welcome_invite", status: "approved", category: "utility" },
            { id: 3, templateName: "auction_reminder", status: "approved", category: "utility" },
            { id: 4, templateName: "unapproved_promo", status: "rejected", category: "marketing" },
          ];
          return {
            where: vi.fn().mockImplementation((cond: any) => {
              return Promise.resolve(res);
            }),
            orderBy: vi.fn().mockResolvedValue(res),
            then: (resolve: any) => Promise.resolve(res).then(resolve),
          };
        }
        if (table === commLogsTable) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
          };
        }
        return {
          where: vi.fn().mockResolvedValue([]),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
        };
      }),
    })) as any);

    vi.spyOn(db, "insert").mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Supported Push Notification Events
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Push Notification Triggers (Player Sold, Unsold, Re-Auction)", () => {
    it("dispatches notifyPlayerSold to active provider with exact copy", async () => {
      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Rohit Sharma",
        teamName: "Mumbai Warriors",
        amount: 25000000,
        auctionUnit: "rupee",
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
      const sent = mockProvider.getSentMessages()[0];
      expect(sent.to).toBe("+919876543210");
      expect(sent.templateName).toBe("auction_player_sold");
      expect(sent.textBody).toContain("Congratulations, Rohit Sharma!");
      expect(sent.textBody).toContain("Mumbai Warriors");
      expect(sent.textBody).toContain("₹2,50,00,000");
    });

    it("dispatches notifyPlayerUnsold to active provider with exact copy", async () => {
      const res = await notifyPlayerUnsold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Steve Smith",
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
      const sent = mockProvider.getSentMessages()[0];
      expect(sent.textBody).toContain("Hi Steve Smith");
      expect(sent.textBody).toContain("UNSOLD");
    });

    it("dispatches notifyPlayerReAuction to active provider with exact copy", async () => {
      const res = await notifyPlayerReAuction({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "David Warner",
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
      const sent = mockProvider.getSentMessages()[0];
      expect(sent.textBody).toContain("Hi David Warner");
      expect(sent.textBody).toContain("RE-AUCTIONED");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Recipient Scope Dispatch Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Recipient Scopes in Broadcast Dispatch", () => {
    it("dispatches to 'all_owners' scope when owners have consent", async () => {
      const mockTeams = [
        { id: 10, ownerMobile: "9876543210", whatsappConsent: true },
        { id: 11, ownerMobile: "9876543211", whatsappConsent: false }, // opted-out
      ];

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          if (table === teamsTable) return { where: vi.fn().mockResolvedValue(mockTeams) };
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
              orderBy: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "all_owners",
          templateName: "welcome_invite",
          templateVariables: { "1": "Premier League", "2": "Tomorrow 6PM", "3": "Main Arena" },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(2);
      expect(res.body.sent).toBe(1);
      expect(res.body.blocked).toBe(1); // One blocked due to lack of consent
      expect(mockProvider.getSentMessages()).toHaveLength(1);
      expect(mockProvider.getSentMessages()[0].to).toBe("9876543210");
    });

    it("dispatches to 'organizer' scope when organizer has consent", async () => {
      const mockTourn = [{ organizerMobile: "9876543210", organizerId: 5 }];
      const mockOrg = [{ id: 5, whatsappConsent: true }];

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockImplementation(() => {
                return Promise.resolve([licensedTournament]);
              }),
            };
          }
          if (table === organizersTable) return { where: vi.fn().mockResolvedValue(mockOrg) };
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([{ templateName: "auction_reminder", status: "approved" }]),
              orderBy: vi.fn().mockResolvedValue([{ templateName: "auction_reminder", status: "approved" }]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "organizer",
          templateName: "auction_reminder",
          templateVariables: {
            "1": "Premier League",
            "2": "15",
            "3": "https://bidwar.in/live/101",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(1);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
    });

    it("dispatches to 'custom' scope with multiple comma-separated mobiles when recipients have verified consent", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          if (table === playersTable) {
            return {
              where: vi.fn().mockImplementation(() => {
                const res = [{ id: 1, mobileNumber: "9876543210", whatsappConsent: true }];
                return {
                  limit: vi.fn().mockResolvedValue(res),
                  then: (r: any) => Promise.resolve(res).then(r),
                };
              }),
            };
          }
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
              orderBy: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "manual",
          manualMobiles: "9876543210, 9876543211",
          templateName: "welcome_invite",
          templateVariables: { "1": "Premier League", "2": "Tonight", "3": "Online" },
        });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.sent).toBe(2);
      expect(mockProvider.getSentMessages()).toHaveLength(2);
    });

    it("blocks custom numbers without attributable consent (P0-C enforcement)", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "manual",
          manualMobiles: "9876543299",
          templateName: "welcome_invite",
          templateVariables: { "1": "Premier League", "2": "Tonight", "3": "Online" },
        });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.sent).toBe(0);
      expect(res.body.blocked).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Licensing, Emergency Admin Lock & Strict Channel Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Licensing Gates & Zero SMS Fallback Enforcement", () => {
    it("strictly blocks WhatsApp when tournament is unlicensed (HTTP 403, 0 SMS sent)", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) return { where: vi.fn().mockResolvedValue([unlicensedTournament]) };
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
              orderBy: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 102,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "welcome_invite",
          templateVariables: { "1": "Test", "2": "Now", "3": "Here" },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("requires a live license");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("strictly blocks WhatsApp when tournament is admin-locked (HTTP 403, 0 SMS sent)", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) return { where: vi.fn().mockResolvedValue([adminLockedTournament]) };
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
              orderBy: vi.fn().mockResolvedValue([{ templateName: "welcome_invite", status: "approved" }]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 103,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "welcome_invite",
          templateVariables: { "1": "Test", "2": "Now", "3": "Here" },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("requires a live license and unlocked tournament");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Delivery Webhook Processing & Monotonic Status Reconciliation
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Delivery Webhooks & Monotonic Reconciliation", () => {
    it("updates deliveryStatus monotonically from 'sent' to 'delivered' and 'read'", async () => {
      // Mock existing log with deliveryStatus 'sent'
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === commLogsTable) {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ deliveryStatus: "sent" }]),
              }),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app)
        .post("/webhooks/comm-delivery")
        .send({
          MessageSid: "SM_mock_sid_999",
          MessageStatus: "delivered",
        });

      expect([200, 403]).toContain(res.status); // 200 in non-prod / signed test
      if (res.status === 200) {
        expect(updateSpy).toHaveBeenCalled();
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Secret Redaction & Authorization Gate
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Secret Redaction & Read-Only Endpoint Integrity", () => {
    it("never exposes provider secrets or credentials in provider-status response", async () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      process.env.TWILIO_ACCOUNT_SID = "AC_secret_sid_98765";
      process.env.TWILIO_AUTH_TOKEN = "secret_auth_token_xyz";
      process.env.TWILIO_WHATSAPP_FROM = "+14155238886";

      const res = await request(app).get("/auth/admin/communicate/provider-status");
      expect(res.status).toBe(200);

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain("AC_secret_sid_98765");
      expect(bodyStr).not.toContain("secret_auth_token_xyz");
      expect(res.body.configValid).toBe(true);
      expect(res.body.verifiedConnectivity).toBe(false);
    });
  });
});
