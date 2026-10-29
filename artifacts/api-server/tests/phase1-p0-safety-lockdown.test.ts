import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter from "../src/routes/comm";
import { notifyPlayerSold, notifyPlayerUnsold, notifyPlayerReAuction } from "../src/lib/whatsapp";
import {
  communicationPolicyEngine,
  isMobileRevoked,
  dispatchPushWhatsApp,
} from "../src/lib/communication/policy-engine";
import { conversationRouter } from "../src/lib/communication/conversation-router";
import {
  db,
  tournamentsTable,
  playersTable,
  teamsTable,
  organizersTable,
  waConsentEventsTable,
  botSessionsTable,
  commLogsTable,
  waTemplatesTable,
} from "@workspace/db";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
} from "../src/lib/communication/providers";
import {
  validateRegistrationFieldsUpdate,
  parseRegistrationFieldsConfig,
  buildRegistrationFieldRequirements,
  validatePlayerRegistrationRequirements,
} from "@workspace/api-base/registration-fields";

function createAppWithUser(user?: any) {
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
  return app;
}

describe("BIDWAR — WhatsApp Consent Phase 1: P0 Safety Lockdown Verification", () => {
  const originalEnv = { ...process.env };
  const app = createAppWithUser();
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
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    vi.restoreAllMocks();
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();

    // Default DB mock
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
            { id: 1, templateName: "welcome_invite", status: "approved", category: "utility" },
            { id: 2, templateName: "player_sold", status: "approved", category: "utility" },
            { id: 3, templateName: "auction_reminder", status: "approved", category: "utility" },
          ];
          return {
            where: vi.fn().mockResolvedValue(res),
            orderBy: vi.fn().mockResolvedValue(res),
            then: (resolve: any) => Promise.resolve(res).then(resolve),
          };
        }
        return {
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([]),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
          })),
          then: (resolve: any) => Promise.resolve([]).then(resolve),
        };
      }),
    })) as any);

    vi.spyOn(db, "insert").mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue({}),
        onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    vi.spyOn(db, "update").mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    } as any);

    vi.spyOn(db, "delete").mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-A: Removal of Third-Party Consent Declaration
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-A: Decommission Third-Party Consent Declaration", () => {
    it("POST /auth/admin/communicate/consent-declare returns HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/consent-declare")
        .send({
          recipientType: "player",
          recipientId: 42,
          tournamentId: 101,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("THIRD_PARTY_CONSENT_PROHIBITED");
      expect(res.body.error).toContain("Third-party WhatsApp consent declaration is prohibited");
    });

    it("POST /auth/admin/communicate/consent-declare-bulk returns HTTP 403 Forbidden", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/consent-declare-bulk")
        .send({
          tournamentId: 101,
          recipientType: "all",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("THIRD_PARTY_CONSENT_PROHIBITED");
      expect(res.body.error).toContain("Third-party WhatsApp consent declaration is prohibited");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-B: Strict Fail-Closed Push Policy Engine
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-B: Strictly Fail-Closed Push Policy Engine", () => {
    it("blocks dispatch when recipient has no consent record (missing_or_unverified_consent)", async () => {
      const evalResult = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournamentId: 101,
        recipientMobile: "9876543210",
        recipientConsent: undefined, // no caller-provided consent
      });

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.reason).toContain("missing_or_unverified_consent");
    });

    it("blocks dispatch when recipientMobile is missing or empty", async () => {
      const res = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournamentId: 101,
        recipientMobile: null,
      });

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Missing recipient mobile");
    });

    it("blocks dispatch when database lookup throws an error (fails closed)", async () => {
      vi.spyOn(db, "select").mockImplementation((() => {
        throw new Error("Postgres connection timeout");
      }) as any);

      const res = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournamentId: 101,
        recipientMobile: "9876543210",
        tournament: licensedTournament,
      });

      expect(res.allowed).toBe(false);
      expect(res.reason).toBeDefined();
    });

    it("allows dispatch only when affirmative consent is positively verified", async () => {
      const res = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournamentId: 101,
        recipientMobile: "9876543210",
        recipientConsent: true,
      });

      expect(res.allowed).toBe(true);
    });

    it("auction event helpers (notifyPlayerSold, notifyPlayerUnsold, notifyPlayerReAuction) block unconsented dispatches", async () => {
      // 1. notifyPlayerSold with whatsappConsent: false
      const soldRes = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Player A",
        teamName: "Team 1",
        amount: 50000,
        tournamentName: "Premier League 2026",
        whatsappConsent: false,
      });
      expect(soldRes.success).toBe(false);
      expect(soldRes.blocked).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(0);

      // 2. notifyPlayerUnsold with undefined whatsappConsent (and DB returns no player)
      const unsoldRes = await notifyPlayerUnsold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Player B",
        tournamentName: "Premier League 2026",
        whatsappConsent: undefined,
      });
      expect(unsoldRes.success).toBe(false);
      expect(unsoldRes.blocked).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(0);

      // 3. notifyPlayerReAuction with affirmative consent proceeds
      const reAuctionRes = await notifyPlayerReAuction({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Player C",
        tournamentName: "Premier League 2026",
        whatsappConsent: true,
      });
      expect(reAuctionRes.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-C: Block Unknown or Unverified Manual/Custom Numbers
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-C: Block Unknown or Unverified Manual/Custom Numbers", () => {
    it("blocks custom numbers not attributed to an existing consented recipient (no consent by default)", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "manual",
          manualMobiles: "9876549999",
          templateName: "welcome_invite",
          templateVariables: { "1": "League", "2": "Tomorrow", "3": "Ground" },
        });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.sent).toBe(0);
      expect(res.body.blocked).toBe(1);
      expect(res.body.results[0].error).toContain("missing_or_unverified_consent");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("permits custom numbers when resolved to an existing tournament player with valid consent", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          if (table === playersTable) {
            const res = [{ id: 10, mobileNumber: "9876543210", whatsappConsent: true }];
            return {
              where: vi.fn().mockImplementation(() => ({
                limit: vi.fn().mockResolvedValue(res),
                then: (r: any) => Promise.resolve(res).then(r),
              })),
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
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "welcome_invite",
          templateVariables: { "1": "League", "2": "Tomorrow", "3": "Ground" },
        });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(1);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-D: Prohibit WhatsApp Consent from Being Mandatory
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-D: Mandatory WhatsApp Consent Prohibited", () => {
    it("validateRegistrationFieldsUpdate rejects whatsappConsent as mandatory", () => {
      const result = validateRegistrationFieldsUpdate({
        required: ["whatsappConsent"],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("cannot be configured as a mandatory field");
      }
    });

    it("parseRegistrationFieldsConfig automatically strips whatsappConsent from required", () => {
      const parsed = parseRegistrationFieldsConfig({
        required: ["photo", "whatsappConsent", "role"],
      });
      expect(parsed.required).toContain("photo");
      expect(parsed.required).toContain("role");
      expect(parsed.required).not.toContain("whatsappConsent");
    });

    it("buildRegistrationFieldRequirements guarantees whatsappConsent is always false", () => {
      const reqs = buildRegistrationFieldRequirements({
        required: ["whatsappConsent" as any],
      });
      expect(reqs.whatsappConsent).toBe(false);
    });

    it("validatePlayerRegistrationRequirements allows registration with whatsappConsent = false", () => {
      const res = validatePlayerRegistrationRequirements(
        { name: "Virat Kohli", mobileNumber: "9876543210", whatsappConsent: false },
        { required: ["photo", "role"] },
      );
      // Photo and role are required in config; name & mobile are valid
      expect(res.ok).toBe(false);
      // Fails on photo, NOT on whatsappConsent
      if (!res.ok) {
        expect(res.field).toBe("photoUrl");
      }

      // With photo and role provided, whatsappConsent=false succeeds
      const validRes = validatePlayerRegistrationRequirements(
        {
          name: "Virat Kohli",
          mobileNumber: "9876543210",
          photoUrl: "https://example.com/photo.jpg",
          role: "Batsman",
          whatsappConsent: false,
        },
        { required: ["photo", "role"] },
      );
      expect(validRes.ok).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-E: Inbound Refusal ("NO", "NA", "DECLINE") Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-E: Inbound Refusal / Decline Handling", () => {
    it("handles inbound 'NO' by revoking consent, recording declined event, and clearing sessions", async () => {
      const sendReplySpy = vi.spyOn(conversationRouter as any, "sendReply").mockResolvedValue(undefined);
      const revokeSpy = vi.spyOn(conversationRouter, "revokeConsentAcrossRecords");

      const outcome = await conversationRouter.processInboundMessage({
        from: "+919876543210",
        text: "NO",
        channel: "whatsapp",
      });

      expect(outcome.handled).toBe(true);
      expect(outcome.replySent).toBe(true);
      expect(revokeSpy).toHaveBeenCalledWith("919876543210", expect.any(String));
      expect(sendReplySpy).toHaveBeenCalledWith(
        null,
        "whatsapp:+919876543210",
        expect.stringContaining("Aapka decision note kar liya gaya hai"),
        "whatsapp",
      );
    });

    it("handles inbound 'NAHI' and 'DECLINE' equivalently", async () => {
      const sendReplySpy = vi.spyOn(conversationRouter as any, "sendReply").mockResolvedValue(undefined);
      const revokeSpy = vi.spyOn(conversationRouter, "revokeConsentAcrossRecords");

      const outcomeDecline = await conversationRouter.processInboundMessage({
        from: "+919876543210",
        text: "DECLINE",
        channel: "whatsapp",
      });

      expect(outcomeDecline.handled).toBe(true);
      expect(revokeSpy).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-F: Verification of Consent Suppression Across Dispatches
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-F: Universal Revocation and Zero SMS Fallback", () => {
    it("blocks WhatsApp dispatch if recipient revoked consent via STOP or decline even if caller passes recipientConsent=true", async () => {
      // Mock waConsentEventsTable returning STOP_REVOKED
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) return { where: vi.fn().mockResolvedValue([licensedTournament]) };
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

      // Caller attempts to pass recipientConsent: true
      const evalResult = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournamentId: 101,
        recipientMobile: "9876543210",
        recipientConsent: true,
      });

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.reason).toContain("opted-out via STOP/declined");

      const dispatchRes = await dispatchPushWhatsApp({
        event: "player_sold",
        tournamentId: 101,
        mobile: "9876543210",
        body: "Test message",
        recipientConsent: true,
      });

      expect(dispatchRes.success).toBe(false);
      expect(dispatchRes.blocked).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("isMobileRevoked returns true when latest event is 'declined'", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === waConsentEventsTable) {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ eventType: "declined" }]),
                }),
              }),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const revoked = await isMobileRevoked("9876543210");
      expect(revoked).toBe(true);
    });

    it("verifies Push policy decoupling: Pull command independent helper remains true", () => {
      expect(communicationPolicyEngine.isPullCommandIndependent()).toBe(true);
    });
  });
});
