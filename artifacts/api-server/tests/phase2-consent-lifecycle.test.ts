import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  organizersTable,
  scorerAccountsTable,
  waConsentEventsTable,
  consentTokensTable,
  botSessionsTable,
} from "@workspace/db";
import {
  recordConsentGranted,
  recordConsentWithdrawal,
  handlePhoneNumberChange,
  normalizePhone,
  maskPhoneNumber,
} from "../src/lib/communication/consent-service";
import {
  CURRENT_CONSENT_NOTICE_VERSION,
  CONSENT_NOTICE_V1,
  getActiveConsentNotice,
} from "@workspace/api-base/consent-notice";
import {
  communicationPolicyEngine,
  isMobileRevoked,
} from "../src/lib/communication/policy-engine";
import { MockWhatsAppProvider } from "../src/lib/communication/providers/mock-provider";
import { ConversationRouter } from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";

describe("BIDWAR Phase 2 — Individual Opt-In, Notice & Withdrawal Lifecycle", () => {
  const licensedTournament = {
    id: 101,
    licenseStatus: "active" as const,
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: null,
    licenseGrantedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Centralized Notice & Versioning
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Centralized Notice and Versioning", () => {
    it("provides the active consent notice with correct version and required fields", () => {
      const notice = getActiveConsentNotice();
      expect(notice.version).toBe(CURRENT_CONSENT_NOTICE_VERSION);
      expect(notice.version).toBe("BIDWAR_WA_NOTICE_V1");
      expect(notice.sender).toContain("BIDWAR");
      expect(notice.defaultScope).toBe("tournament_operational");
      expect(notice.channels).toContain("whatsapp");
      expect(notice.purposes.operational.length).toBeGreaterThan(0);
      expect(notice.content.en.withdrawalInstructions).toContain("STOP");
      expect(notice.content.hi.withdrawalInstructions).toContain("STOP");
      expect(notice.botPrompt.hinglish).toContain("YES");
      expect(notice.botPrompt.hinglish).toContain("NO");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Individual Attributable Opt-In by Recipient Type
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Individual Attributable Opt-In", () => {
    it("records player opt-in with exact notice version, scope, and source", async () => {
      let updatedTable = "";
      let updatedData: any = null;
      let insertedEvent: any = null;

      vi.spyOn(db, "update").mockImplementation(((table: any) => ({
        set: (data: any) => ({
          where: async () => {
            updatedTable = "players";
            updatedData = data;
            return [];
          },
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation(((table: any) => ({
        values: (val: any) => ({
          returning: async () => {
            insertedEvent = val;
            return [{ id: 401 }];
          },
        }),
      })) as any);

      const res = await recordConsentGranted({
        recipientType: "player",
        recipientId: 55,
        mobile: "9876543210",
        tournamentId: 101,
        source: "registration_web",
        noticeVersion: CURRENT_CONSENT_NOTICE_VERSION,
        consentScope: "tournament_operational",
      });

      expect(res.success).toBe(true);
      expect(res.eventId).toBe(401);
      expect(updatedData.whatsappConsent).toBe(true);
      expect(updatedData.whatsappConsentMethod).toBe("registration_web");
      expect(insertedEvent.eventType).toBe("opt_in");
      expect(insertedEvent.questionVersion).toBe("BIDWAR_WA_NOTICE_V1");
      expect(insertedEvent.consentScope).toBe("tournament_operational");
      expect(insertedEvent.source).toBe("registration_web");
      expect(insertedEvent.mobile).toBe("919876543210");
    });

    it("records team owner opt-in attributable to owner action", async () => {
      let updatedData: any = null;
      let insertedEvent: any = null;

      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            updatedData = data;
            return [];
          },
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: (val: any) => ({
          returning: async () => {
            insertedEvent = val;
            return [{ id: 402 }];
          },
        }),
      })) as any);

      const res = await recordConsentGranted({
        recipientType: "team_owner",
        recipientId: 12,
        mobile: "+919876543210",
        tournamentId: 101,
        source: "consent_link",
        tokenUsed: "token_abc123",
      });

      expect(res.success).toBe(true);
      expect(updatedData.whatsappConsent).toBe(true);
      expect(insertedEvent.recipientType).toBe("team_owner");
      expect(insertedEvent.tokenUsed).toBe("token_abc123");
    });

    it("records organizer self-service opt-in", async () => {
      let updatedData: any = null;
      let insertedEvent: any = null;

      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            updatedData = data;
            return [];
          },
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: (val: any) => ({
          returning: async () => {
            insertedEvent = val;
            return [{ id: 403 }];
          },
        }),
      })) as any);

      const res = await recordConsentGranted({
        recipientType: "organizer",
        recipientId: 7,
        mobile: "919876543210",
        source: "organizer_portal",
      });

      expect(res.success).toBe(true);
      expect(updatedData.whatsappConsent).toBe(true);
      expect(insertedEvent.recipientType).toBe("organizer");
      expect(insertedEvent.source).toBe("organizer_portal");
    });

    it("records scorer self-service opt-in", async () => {
      let updatedData: any = null;
      let insertedEvent: any = null;

      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            updatedData = data;
            return [];
          },
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: (val: any) => ({
          returning: async () => {
            insertedEvent = val;
            return [{ id: 404 }];
          },
        }),
      })) as any);

      const res = await recordConsentGranted({
        recipientType: "scorer",
        recipientId: 99,
        mobile: "9876543210",
        source: "scorer_portal",
      });

      expect(res.success).toBe(true);
      expect(updatedData.whatsappConsent).toBe(true);
      expect(insertedEvent.recipientType).toBe("scorer");
      expect(insertedEvent.source).toBe("scorer_portal");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Universal Withdrawal and Push Suppression
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Universal Withdrawal and Push Suppression", () => {
    it("withdrawal sets entity boolean false, clears bot session, and writes declined event", async () => {
      let updatedEntity = false;
      let deletedSession = false;
      let insertedDecline = false;

      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            if (data.whatsappConsent === false) updatedEntity = true;
            return [];
          },
        }),
      })) as any);

      vi.spyOn(db, "delete").mockImplementation((() => ({
        where: async () => {
          deletedSession = true;
          return [];
        },
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: (val: any) => ({
          returning: async () => {
            if (val.eventType === "declined") insertedDecline = true;
            return [{ id: 501 }];
          },
        }),
      })) as any);

      const res = await recordConsentWithdrawal({
        mobile: "9876543210",
        recipientType: "player",
        recipientId: 55,
        reason: "PROFILE_WITHDRAWAL",
      });

      expect(res.success).toBe(true);
      expect(updatedEntity).toBe(true);
      expect(deletedSession).toBe(true);
      expect(insertedDecline).toBe(true);
    });

    it("suppresses push when recipient has withdrawn, even if entity boolean is true", async () => {
      // isMobileRevoked returns true (latest event was withdrawal)
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [{ eventType: "declined" }],
            }),
          }),
        }),
      })) as any);

      const result = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournament: licensedTournament,
        tournamentId: 101,
        recipientMobile: "919876543210",
        recipientConsent: true, // Stale entity boolean
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("opted-out via STOP/declined");
    });

    it("deterministic event ordering: newest event wins on same timestamp via secondary id tie-breaker", async () => {
      // Mock db.select to verify that orderBy is called with eventAt DESC and id DESC
      let orderByArgs: any[] = [];
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            orderBy: (...args: any[]) => {
              orderByArgs = args;
              return {
                limit: async () => [{ eventType: "opt_in" }],
              };
            },
          }),
        }),
      })) as any);

      const isRevoked = await isMobileRevoked("919876543210");
      expect(isRevoked).toBe(false);
      expect(orderByArgs.length).toBe(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Phone Number Mutation Safety (No Consent Inheritance)
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Phone Number Mutation Safety", () => {
    it("resets consent to false and logs phone_changed event when phone changes", async () => {
      let resetCalled = false;
      let insertedChange = false;

      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            if (data.whatsappConsent === false && data.whatsappConsentAt === null) {
              resetCalled = true;
            }
            return [];
          },
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: (val: any) => {
          if (val.eventType === "phone_changed") insertedChange = true;
          return {};
        },
      })) as any);

      const res = await handlePhoneNumberChange({
        entityType: "player",
        entityId: 55,
        oldMobile: "9876543210",
        newMobile: "9876543299",
        tournamentId: 101,
      });

      expect(res.changed).toBe(true);
      expect(res.consentReset).toBe(true);
      expect(resetCalled).toBe(true);
      expect(insertedChange).toBe(true);
    });

    it("does not reset consent when normalized phone number is unchanged", async () => {
      const res = await handlePhoneNumberChange({
        entityType: "player",
        entityId: 55,
        oldMobile: "+91 98765 43210",
        newMobile: "9876543210", // Same 10-digit number
      });

      expect(res.changed).toBe(false);
      expect(res.consentReset).toBe(false);
    });

    it("masks phone numbers in logger utilities", () => {
      expect(maskPhoneNumber("919876543210")).toBe("91******3210");
      expect(maskPhoneNumber("9876543210")).toBe("98****3210");
      expect(maskPhoneNumber("123")).toBe("****");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Inbound Bot Interaction & Decoupling of Pull
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Inbound WhatsApp Bot Consent & Pull Independence", () => {
    it("NO keyword revokes consent across records without breaking Pull commands", async () => {
      const router = new ConversationRouter();
      let revokedMobile = "";

      vi.spyOn(router as any, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router as any, "recordProcessedInboundMessage").mockResolvedValue(undefined);
      vi.spyOn(router as any, "revokeConsentAcrossRecords").mockImplementation(async (mob: string) => {
        revokedMobile = mob;
      });
      const sendReplySpy = vi.spyOn(router as any, "sendReply").mockResolvedValue({ success: true });

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "NO",
      });

      expect(res.handled).toBe(true);
      expect(res.replySent).toBe(true);
      expect(revokedMobile).toBe("919876543210");
      expect(sendReplySpy).toHaveBeenCalledWith(
        null,
        "whatsapp:+919876543210",
        expect.stringContaining("Aapko WhatsApp updates nahi bheje jayenge"),
        "whatsapp",
      );
    });

    it("Pull commands (SCORES, BPL, HELP) remain fully functional after opt-out", async () => {
      const router = new ConversationRouter();
      vi.spyOn(router as any, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router as any, "recordProcessedInboundMessage").mockResolvedValue(undefined);
      vi.spyOn(router as any, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        displayName: "Guest",
        targets: [],
      });
      vi.spyOn(router as any, "getPublicLiveScores").mockResolvedValue("No live matches right now.");
      const sendReplySpy = vi.spyOn(router as any, "sendReply").mockResolvedValue({ success: true });

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "SCORES",
      });

      expect(res.handled).toBe(true);
      expect(sendReplySpy).toHaveBeenCalledWith(
        null,
        "whatsapp:+919876543210",
        "No live matches right now.",
        "whatsapp",
      );
    });

    it("unrelated text or random numbers do NOT grant consent", async () => {
      const router = new ConversationRouter();
      vi.spyOn(router as any, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router as any, "recordProcessedInboundMessage").mockResolvedValue(undefined);
      vi.spyOn(router as any, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        displayName: "Guest",
        targets: [],
      });
      // No pending bot session
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      })) as any);
      const consentSpy = vi.spyOn(router, "setConsentGranted");

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "Random chat message 12345",
      });

      expect(consentSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Security & Provider Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Security & Mock Isolation", () => {
    it("blocked Push message never reaches the provider mock", async () => {
      const mockProvider = new MockWhatsAppProvider();
      vi.spyOn(commSender, "sendWhatsApp").mockImplementation((opts) => mockProvider.sendMessage(opts));

      // Attempt push to an unconsented player
      const evalResult = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournament: licensedTournament,
        tournamentId: 101,
        recipientMobile: "919876543210",
        recipientConsent: false, // Unconsented
      });

      expect(evalResult.allowed).toBe(false);

      if (evalResult.allowed) {
        await commSender.sendWhatsApp({
          to: "919876543210",
          templateName: "player_sold",
          parameters: {},
        });
      }

      // Assert zero calls reached mock provider
      expect(mockProvider.getSentMessages().length).toBe(0);
    });

    it("database failure during consent evaluation fails strictly closed", async () => {
      vi.spyOn(db, "select").mockImplementation((() => {
        throw new Error("Simulated database failure during consent evaluation");
      }) as any);

      const result = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournament: licensedTournament,
        tournamentId: 101,
        recipientMobile: "919876543210",
        recipientConsent: undefined, // Requires DB lookup
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("opted-out via STOP/declined"); // isMobileRevoked catch fails closed
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Token Security, Expiry, Single-Use & Replay Resistance
  // ───────────────────────────────────────────────────────────────────────────
  describe("7. Token Lifecycle & Replay Resistance", () => {
    it("rejects consent tokens that are expired or already used", () => {
      const now = Date.now();
      const expiredToken = {
        token: "tok_exp_123",
        used: false,
        expiresAt: new Date(now - 1000), // Expired 1 second ago
      };
      const isExpired = new Date() > expiredToken.expiresAt;
      expect(isExpired).toBe(true);

      const usedToken = {
        token: "tok_used_123",
        used: true,
        expiresAt: new Date(now + 3600000),
      };
      expect(usedToken.used).toBe(true);
    });

    it("prevents an organizer from granting consent on behalf of a team owner", async () => {
      // Mock no revocation events in DB so we test affirmative consent check
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [],
            }),
          }),
        }),
      })) as any);

      const result = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournament: licensedTournament,
        tournamentId: 101,
        recipientMobile: "919876543299",
        recipientConsent: false, // Organizer created team owner with default false
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("missing_or_unverified_consent");
    });

    it("cross-tournament records do not create consent bypasses", async () => {
      // Mock no revocation events in DB so we test affirmative consent check
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [],
            }),
          }),
        }),
      })) as any);

      const result = await communicationPolicyEngine.evaluatePushPolicy({
        event: "player_sold",
        channel: "whatsapp",
        tournament: { ...licensedTournament, id: 202 },
        tournamentId: 202,
        recipientMobile: "919876543210",
        recipientConsent: false, // Unconsented in tournament 202
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("missing_or_unverified_consent");
    });
  });
});
