import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConversationRouter,
  conversationRouter,
} from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";
import { db } from "@workspace/db";
import {
  membersTable,
  memberRolesTable,
  memberIdentityLinksTable,
  playersTable,
  teamsTable,
  organizersTable,
  tournamentsTable,
  otpSessionsTable,
  commLogsTable,
  consentTokensTable,
  waConsentEventsTable,
  botSessionsTable,
  bplEditionsTable,
  scoringMatchesTable,
} from "@workspace/db";

describe("Phase 3 — Identity Conversation Router & Inbound Messaging Ingestion", () => {
  const originalEnv = { ...process.env };
  const router = new ConversationRouter();

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Identity Resolution Hierarchy", () => {
    it("resolves canonical member identity with roles and links first", async () => {
      const mockMember = {
        id: "mem_test123",
        displayName: "Suresh Raina",
        primaryMobile: "919876543210",
        accountStatus: "active",
      };
      const mockRoles = [
        { id: 1, memberId: "mem_test123", role: "player", tournamentId: 42 },
      ];
      const mockLinks = [
        { id: 1, memberId: "mem_test123", sourceTable: "players", sourceRecordId: "101", status: "active" },
      ];

      vi.spyOn(db, "select").mockImplementation(((fields: any) => {
        return {
          from: (table: any) => ({
            where: () => ({
              limit: async () => {
                if (table === membersTable) return [mockMember];
                return [];
              },
              then: (resolve: any) => {
                if (table === memberRolesTable) return resolve(mockRoles);
                if (table === memberIdentityLinksTable) return resolve(mockLinks);
                return resolve([]);
              },
            }),
          }),
        } as any;
      }) as any);

      const identity = await router.resolveIdentity("9876543210");
      expect(identity.kind).toBe("member");
      if (identity.kind === "member") {
        expect(identity.member.displayName).toBe("Suresh Raina");
        expect(identity.primaryTournamentId).toBe(42);
        expect(identity.roles).toHaveLength(1);
        expect(identity.links).toHaveLength(1);
      }
    });

    it("falls back to legacy tables when no canonical member exists", async () => {
      vi.spyOn(db, "select").mockImplementation(((fields: any) => {
        return {
          from: (table: any) => ({
            where: () => ({
              limit: async () => {
                if (table === tournamentsTable) {
                  return [{ name: "Varanasi Premier League" }];
                }
                return [];
              },
              then: async (resolve: any) => {
                if (table === playersTable) {
                  return resolve([{ id: 55, name: "Legacy Player", tournamentId: 10 }]);
                }
                if (table === tournamentsTable) {
                  return resolve([{ name: "Varanasi Premier League" }]);
                }
                return resolve([]);
              },
            }),
          }),
        } as any;
      }) as any);

      const identity = await router.resolveIdentity("+919988776655");
      expect(identity.kind).toBe("legacy");
      if (identity.kind === "legacy") {
        expect(identity.displayName).toBe("Legacy Player");
        expect(identity.targets[0].tournamentName).toBe("Varanasi Premier League");
      }
    });

    it("resolves to Guest when no member or legacy record matches phone", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
            then: async (resolve: any) => resolve([]),
          }),
        }),
      })) as any);

      const identity = await router.resolveIdentity("911223344556");
      expect(identity.kind).toBe("guest");
      expect(identity.displayName).toBe("Guest");
    });
  });

  describe("2. Idempotency & Inbound Deduplication", () => {
    it("skips already processed inbound message IDs without sending duplicate replies", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 999 }], // Simulates existing comm_logs row
          }),
        }),
      })) as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELLO",
        messageId: "wamid.HBgLALREADY_PROCESSED_123",
      });

      expect(res.handled).toBe(true);
      expect(res.replySent).toBe(false);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe("3. Strict Guest Privacy Protection & Public Command Ingestion", () => {
    it("refuses to disclose private auction/roster data to unauthenticated Guest", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });

      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "9876543210",
        channel: "whatsapp",
        text: "DATA",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("Access Restricted");
      expect(smsSpy).not.toHaveBeenCalled();
      expect(sentBody).not.toContain("Purse");
      expect(sentBody).not.toContain("Sold Price");
    });

    it("serves public BPL information to Guests safely", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      vi.spyOn(router, "getPublicBplInfo").mockResolvedValue(
        "🏆 BPL Edition 2026\nStatus: LIVE\nVenue: Sigra Stadium, Varanasi\n📺 Live Stream: https://bidwar.in/stream",
      );

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "9876543210",
        channel: "whatsapp",
        text: "BPL",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("BPL Edition 2026");
      expect(sentBody).toContain("Live Stream");
    });

    it("serves public match scores to Guests safely", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      vi.spyOn(router, "getPublicLiveScores").mockResolvedValue(
        "🏏 Current Live Matches:\n• Match #42: Kashi Kings vs Ganga Warriors — Over 14.2",
      );

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "9876543210",
        channel: "whatsapp",
        text: "SCORES",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("Current Live Matches");
      expect(sentBody).toContain("Kashi Kings");
    });
  });

  describe("4. STOP / UNSUBSCRIBE Immediate Revocation", () => {
    it("revokes WhatsApp consent universally across records without altering SMS consent", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      const revokeSpy = vi.spyOn(router, "revokeConsentAcrossRecords").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      const res = await router.processInboundMessage({
        from: "+919876543210",
        channel: "whatsapp",
        text: "STOP",
      });

      expect(res.handled).toBe(true);
      expect(revokeSpy).toHaveBeenCalledWith("919876543210");
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("unsubscribe ho gaye hain");
      expect(smsSpy).not.toHaveBeenCalled();
    });
  });

  describe("5. OTP Security, Attempt Caps & Rate Limiting", () => {
    it("enforces rate limit when requesting OTP > 3 times in 15 minutes", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "isTournamentWaLicensed").mockResolvedValue(true);

      // Mock botSessionsTable lookup returning pending_yes
      vi.spyOn(db, "select").mockImplementation(((fields: any) => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () => {
              if (table === botSessionsTable) {
                return [
                  {
                    mobile: "919876543210",
                    pendingAction: "pending_yes",
                    pendingData: JSON.stringify({ name: "Ramesh", tournamentId: 10 }),
                  },
                ];
              }
              return [];
            },
            then: async (resolve: any) => {
              if (table === otpSessionsTable) {
                // Return 3 recent OTP sessions (rate limit hit)
                return resolve([{ id: 1 }, { id: 2 }, { id: 3 }]);
              }
              return resolve([]);
            },
          }),
        }),
      })) as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "YES",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("bohot baar OTP request kiya hai");
    });

    it("burns session and rejects when user exceeds 3 incorrect OTP attempts", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });

      // Session already had 3 attempts
      const mockSession = {
        id: 77,
        mobile: "919876543210",
        otpHash: "dummy:hash",
        payload: JSON.stringify({ attempts: 3 }),
        used: false,
      };

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [mockSession],
            }),
            limit: async () => [mockSession],
          }),
        }),
      })) as any);

      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: () => ({ where: vi.fn().mockResolvedValue({}) }),
      } as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "123456",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("Bohot baar galat OTP");
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe("6. Consent Token Authorization & Mobile Validation", () => {
    it("rejects OPTIN token when issued mobile does not match inbound mobile", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });

      // Token was issued for 919999999999, but sender is 919876543210
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                token: "optin_token_xyz",
                mobile: "919999999999", // Different mobile!
                recipientType: "player",
                recipientId: 44,
                tournamentId: 10,
                used: false,
              },
            ],
          }),
        }),
      })) as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "OPTIN optin_token_xyz",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, sentBody] = sendSpy.mock.calls[0];
      expect(sentBody).toContain("aapke number ke liye nahi hai");
    });
  });
});
