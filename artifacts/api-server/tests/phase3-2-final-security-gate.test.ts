import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { Request } from "express";
import {
  ConversationRouter,
  conversationRouter,
} from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";
import { verifyTwilioSignature } from "../src/routes/webhooks";
import { db, pool } from "@workspace/db";
import {
  membersTable,
  memberRolesTable,
  memberIdentityLinksTable,
  playersTable,
  teamsTable,
  organizersTable,
  tournamentsTable,
  commLogsTable,
  botSessionsTable,
  waConsentEventsTable,
} from "@workspace/db";

describe("Phase 3.2 Final Security Gate — Concurrency, Authorization & Channel Guard", () => {
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

  // ───────────────────────────────────────────────────────────────────────────
  // P0-A: Durable Inbound Webhook Deduplication and Recovery
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-A — Inbound Deduplication and Concurrency Recovery", () => {
    it("Scenario 1 & 2: concurrent duplicate requests await in-flight execution and deduplicate cleanly (1 reply sent)", async () => {
      let commLogsWritten = false;
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => (commLogsWritten ? [{ id: 101 }] : []),
          }),
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: async () => {
          commLogsWritten = true;
          return {};
        },
      })) as any);

      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const sendSmsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      const msgId = "wamid.CONCURRENT_P0A_001";
      const call1 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: msgId,
      });

      const call2 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: msgId,
      });

      const [res1, res2] = await Promise.all([call1, call2]);

      const repliesSent = [res1.replySent, res2.replySent].filter(Boolean).length;
      expect(repliesSent).toBe(1);

      const deduplicatedCount = [res1.deduplicated, res2.deduplicated].filter(Boolean).length;
      expect(deduplicatedCount).toBe(1);

      expect(sendWhatsAppSpy).toHaveBeenCalledTimes(1);
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("Scenario 3: initial in-flight execution fails; waiting duplicate catches failure, retries and executes cleanly without message loss", async () => {
      let attempts = 0;
      let commLogsWritten = false;

      vi.spyOn(router as any, "executeInboundMessage").mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Simulated transient crash on first attempt");
        }
        commLogsWritten = true;
        return { handled: true, replySent: true, deduplicated: false };
      });

      vi.spyOn(router, "isMessageAlreadyProcessed").mockImplementation(async () => commLogsWritten);

      const msgId = "wamid.CRASH_RETRY_001";
      const call1 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: msgId,
      }).catch((err) => ({ handled: false, error: err.message }));

      const call2 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: msgId,
      });

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.handled).toBe(false);
      expect(res2.handled).toBe(true);
      expect(res2.replySent).toBe(true);
      expect(attempts).toBe(2);
    });

    it("Scenario 4: DB pool connection error during advisory lock attempt falls back gracefully to in-memory lock without crashing", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      if (pool && typeof pool.connect === "function") {
        vi.spyOn(pool, "connect").mockRejectedValueOnce(new Error("ECONNREFUSED ::1:5432"));
      }

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: "wamid.DB_DISCONNECTED_001",
      });

      expect(res.handled).toBe(true);
      expect(res.replySent).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it("Scenario 5 & Idempotency: retry after successful processing is detected in comm_logs and skipped immediately", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(true);
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELLO",
        messageId: "wamid.ALREADY_PROCESSED_DURABLE",
      });

      expect(res.handled).toBe(true);
      expect(res.deduplicated).toBe(true);
      expect(res.replySent).toBe(false);
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it("Scenario 7: distinct provider message IDs execute concurrently without lock collision", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      const [res1, res2] = await Promise.all([
        router.processInboundMessage({
          from: "919876543210",
          channel: "whatsapp",
          text: "HELP",
          messageId: "wamid.DISTINCT_A",
        }),
        router.processInboundMessage({
          from: "919876543210",
          channel: "whatsapp",
          text: "HELP",
          messageId: "wamid.DISTINCT_B",
        }),
      ]);

      expect(res1.handled).toBe(true);
      expect(res2.handled).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });

    it("Scenario 8: lock release in finally block ensures lock is immediately acquirable on subsequent attempt", async () => {
      const lockKey = "wamid.LOCK_RELEASE_CHECK";
      const lock1 = await router.acquireMessageLock(lockKey);
      expect(lock1.acquired).toBe(true);

      await lock1.release();

      const lock2 = await router.acquireMessageLock(lockKey);
      expect(lock2.acquired).toBe(true);
      await lock2.release();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0-B: Multi-Tournament Identity and Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe("P0-B — Multi-Tournament Identity and Authorization (10 Mandatory Scenarios)", () => {
    // 1. A member with roles in two or more tournaments
    it("1. A member with roles in two or more tournaments is marked ambiguous with undefined primaryTournamentId", async () => {
      const mockMember = {
        id: "mem_multi_01",
        displayName: "Rohit Sharma",
        primaryMobile: "919876543210",
        accountStatus: "active",
        isMobileVerified: true,
      };
      const mockRoles = [
        { id: 1, memberId: "mem_multi_01", role: "player", tournamentId: 10, scope: "tournament" },
        { id: 2, memberId: "mem_multi_01", role: "team_owner", tournamentId: 20, scope: "tournament" },
      ];

      vi.spyOn(db, "select").mockImplementation(((fields: any) => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () => (table === membersTable ? [mockMember] : []),
            then: (resolve: any) => {
              if (table === memberRolesTable) return resolve(mockRoles);
              if (table === memberIdentityLinksTable) return resolve([]);
              return resolve([]);
            },
          }),
        }),
      })) as any);

      const identity = await router.resolveIdentity("9876543210");
      expect(identity.kind).toBe("member");
      if (identity.kind === "member") {
        expect(identity.isAmbiguous).toBe(true);
        expect(identity.primaryTournamentId).toBeUndefined();
        expect(identity.tournamentIds).toEqual([10, 20]);
      }
    });

    // 2. A request with no explicit tournament context
    it("2. A request with no explicit tournament context from multi-tournament member stages disambiguation without revealing private data", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "member",
        member: { id: "mem_multi_01" } as any,
        roles: [
          { id: 1, memberId: "mem_multi_01", role: "player", tournamentId: 10, scope: "tournament" } as any,
          { id: 2, memberId: "mem_multi_01", role: "team_owner", tournamentId: 20, scope: "tournament" } as any,
        ],
        links: [],
        tournamentIds: [10, 20],
        isAmbiguous: true,
        primaryTournamentId: undefined,
        displayName: "Rohit Sharma",
      });

      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "isTournamentWaLicensed").mockResolvedValue(true);
      const insertSpy = vi.spyOn(db, "insert").mockImplementation((() => ({
        values: () => ({
          onConflictDoUpdate: vi.fn().mockResolvedValue({}),
        }),
      })) as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "DATA",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Aapke ek se zyada tournaments hain");
      expect(body).toContain("Number chun kar reply karein");
      expect(body).not.toContain("Sold Price");
      expect(body).not.toContain("Purse Remaining");
    });

    // 3. A request with a valid, explicit tournament context
    it("3. A request with a valid, explicit tournament context returns authorized tournament data", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "member",
        member: { id: "mem_multi_01" } as any,
        roles: [
          { id: 1, memberId: "mem_multi_01", role: "captain", tournamentId: 42, scope: "tournament" } as any,
        ],
        links: [],
        tournamentIds: [42],
        isAmbiguous: false,
        primaryTournamentId: 42,
        displayName: "Rohit Sharma",
      });

      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "isTournamentWaLicensed").mockResolvedValue(true);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ name: "Mumbai T20 Cup" }],
          }),
        }),
      })) as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "DATA 42",
      });

      expect(res.handled).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Mumbai T20 Cup");
      expect(body).toContain("Role: captain");
    });

    // 4. An inactive or revoked membership
    it("4. An inactive or revoked membership fails closed, denies private commands, and does NOT fall back to legacy records", async () => {
      const suspendedMember = {
        id: "mem_suspended_01",
        displayName: "Suspended User",
        primaryMobile: "919876543210",
        accountStatus: "suspended", // Inactive!
        isMobileVerified: true,
      };

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () => (table === membersTable ? [suspendedMember] : []),
            then: (resolve: any) => resolve([]),
          }),
        }),
      })) as any);

      const legacySpy = vi.spyOn(router, "findAllConsentTargets");
      const identity = await router.resolveIdentity("9876543210");

      expect(identity.kind).toBe("inactive_member");
      expect(legacySpy).not.toHaveBeenCalled();

      // Now verify that private DATA request is rejected
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "DATA",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Account Inactive");
      expect(body).toContain("suspended");
      expect(body).not.toContain("Sold Price");
    });

    // 5. An unverified phone/member link
    it("5. An unverified phone number link refuses authenticated member status and rejects private access", async () => {
      const unverifiedMember = {
        id: "mem_unverified_01",
        displayName: "Unverified User",
        primaryMobile: "919876543210",
        accountStatus: "active",
        isMobileVerified: false, // Unverified!
      };

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () => (table === membersTable ? [unverifiedMember] : []),
            then: (resolve: any) => resolve([]),
          }),
        }),
      })) as any);

      const identity = await router.resolveIdentity("9876543210");
      expect(identity.kind).toBe("unverified_mobile");

      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "DATA",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Unverified Mobile");
      expect(body).not.toContain("Role");
    });

    // 6. Ambiguous legacy identity records
    it("6. Ambiguous legacy identity records (multiple tournaments) stage disambiguation without leaking data", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
            then: (resolve: any) => resolve([]),
          }),
        }),
      })) as any);

      vi.spyOn(router, "findAllConsentTargets").mockResolvedValue([
        { type: "player", id: 101, name: "Player Ramesh", tournamentId: 5, tournamentName: "Cup Alpha" },
        { type: "team_owner", id: 202, name: "Owner Ramesh", tournamentId: 8, tournamentName: "Cup Beta" },
      ]);

      const identity = await router.resolveIdentity("9876543210");
      expect(identity.kind).toBe("legacy");
      if (identity.kind === "legacy") {
        expect(identity.isAmbiguous).toBe(true);
        expect(identity.primaryTournamentId).toBeUndefined();
      }

      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "isTournamentWaLicensed").mockResolvedValue(true);
      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: () => ({ onConflictDoUpdate: vi.fn().mockResolvedValue({}) }),
      })) as any);

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "DATA",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Aapke ek se zyada tournaments hain");
      expect(body).toContain("Cup Alpha");
      expect(body).toContain("Cup Beta");
      expect(body).not.toContain("Purse");
    });

    // 7. A Guest requesting public scores
    it("7. A Guest requesting public scores receives genuine live scoreboards safely", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      vi.spyOn(router, "getPublicLiveScores").mockResolvedValue(
        "🏏 Current Live Matches:\n• Match #88: Royal XI vs Super Giants",
      );

      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "9876543210",
        channel: "whatsapp",
        text: "SCORES",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Current Live Matches");
      expect(body).toContain("Royal XI vs Super Giants");
    });

    // 8. A Guest requesting private tournament/member data
    it("8. A Guest requesting private tournament/member data is denied with Access Restricted", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "9876543210",
        channel: "whatsapp",
        text: "REPORT",
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Access Restricted");
      expect(body).not.toContain("Purse");
      expect(body).not.toContain("Base Price");
    });

    // 9. An unauthorized role attempting a privileged action
    it("9. An unauthorized role attempting a privileged action or unauthorized tournament is denied", async () => {
      const memberIdentity: any = {
        kind: "member",
        member: { id: "mem_player_only" },
        roles: [
          { id: 1, role: "player", scope: "tournament", tournamentId: 10 },
        ],
        tournamentIds: [10],
      };

      // Member does NOT have organizer role in tournament 10
      expect(router.isAuthorizedForRole(memberIdentity, 10, "organizer")).toBe(false);
      // Member does NOT have player role in tournament 99
      expect(router.isAuthorizedForRole(memberIdentity, 99, "player")).toBe(false);
      // Member DOES have player role in tournament 10
      expect(router.isAuthorizedForRole(memberIdentity, 10, "player")).toBe(true);

      // Now verify via router inbound message requesting unauthorized tournament 99
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "member",
        member: { id: "mem_player_only" } as any,
        roles: [{ id: 1, role: "player", tournamentId: 10, scope: "tournament" } as any],
        links: [],
        tournamentIds: [10],
        isAmbiguous: false,
        primaryTournamentId: 10,
        displayName: "Regular Player",
      });
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "DATA 99", // Tournament 99 is unauthorized!
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendSpy.mock.calls[0];
      expect(body).toContain("Unauthorized");
      expect(body).toContain("Aap is tournament ke authorized member nahi hain");
    });

    // 10. A stale or conflicting identity mapping
    it("10. A stale or conflicting identity mapping (detached status or confidence < 100) is filtered out", async () => {
      const mockMember = {
        id: "mem_stale_01",
        displayName: "Member Stale",
        primaryMobile: "919876543210",
        accountStatus: "active",
        isMobileVerified: true,
      };

      const mockLinks = [
        { id: 1, memberId: "mem_stale_01", sourceTable: "players", sourceRecordId: "1", status: "detached", confidenceScore: 100 },
        { id: 2, memberId: "mem_stale_01", sourceTable: "players", sourceRecordId: "2", status: "rejected", confidenceScore: 100 },
        { id: 3, memberId: "mem_stale_01", sourceTable: "players", sourceRecordId: "3", status: "active", confidenceScore: 50 }, // low confidence
        { id: 4, memberId: "mem_stale_01", sourceTable: "players", sourceRecordId: "4", status: "active", confidenceScore: 100 }, // verified
      ];

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: (table: any) => ({
          where: () => ({
            limit: async () => (table === membersTable ? [mockMember] : []),
            then: (resolve: any) => {
              if (table === memberRolesTable) return resolve([]);
              if (table === memberIdentityLinksTable) return resolve(mockLinks);
              return resolve([]);
            },
          }),
        }),
      })) as any);

      const identity = await router.resolveIdentity("9876543210");
      expect(identity.kind).toBe("member");
      if (identity.kind === "member") {
        // Only link #4 must survive the filter
        expect(identity.links).toHaveLength(1);
        expect(identity.links[0].sourceRecordId).toBe("4");
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P1: Trusted Proxy Validation and Channel-Aware Safeguards
  // ───────────────────────────────────────────────────────────────────────────
  describe("P1 — Trusted Proxy Validation and Channel-Aware Safeguards", () => {
    const authToken = "test_auth_token_secret_12345";
    const baseParams: Record<string, string> = { Body: "HELLO", From: "+919876543210", To: "+14155238886" };

    function computeSig(url: string, params: Record<string, string>): string {
      const sortedKeys = Object.keys(params).sort();
      const str = url + sortedKeys.reduce((acc, k) => acc + k + params[k], "");
      return crypto.createHmac("sha1", authToken).update(str).digest("base64");
    }

    beforeEach(() => {
      process.env.TWILIO_AUTH_TOKEN = authToken;
    });

    it("verifies signature with comma-separated multi-hop proxy headers", () => {
      const originalUrl = "/api/webhooks/comm-inbound";
      const expectedUrl = `https://api.bidwar.in${originalUrl}`;
      const sig = computeSig(expectedUrl, baseParams);

      const mockReq = {
        headers: {
          "x-twilio-signature": sig,
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "api.bidwar.in, 10.0.0.1, edge-gw",
        },
        originalUrl,
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(true);
    });

    it("handles array header values safely without TypeError", () => {
      const originalUrl = "/api/webhooks/comm-inbound";
      const expectedUrl = `https://api.bidwar.in${originalUrl}`;
      const sig = computeSig(expectedUrl, baseParams);

      const mockReq = {
        headers: {
          "x-twilio-signature": sig,
          "x-forwarded-proto": ["https", "http"],
          "x-forwarded-host": ["api.bidwar.in", "10.0.0.1"],
        },
        originalUrl,
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(true);
    });

    it("rejects malformed or empty host header", () => {
      const mockReq = {
        headers: {
          "x-twilio-signature": "some_sig",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "   ",
        },
        originalUrl: "/api/webhooks/comm-inbound",
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(false);
    });

    it("rejects invalid or unsafe host containing illegal characters", () => {
      const mockReq = {
        headers: {
          "x-twilio-signature": "some_sig",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "attacker.com/evil\\injection",
        },
        originalUrl: "/api/webhooks/comm-inbound",
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(false);
    });

    it("rejects malformed or untrusted protocol header", () => {
      const mockReq = {
        headers: {
          "x-twilio-signature": "some_sig",
          "x-forwarded-proto": "javascript:",
          "x-forwarded-host": "api.bidwar.in",
        },
        originalUrl: "/api/webhooks/comm-inbound",
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(false);
    });

    it("suppresses WhatsApp reply without SMS fallback when tournament is unlicensed", async () => {
      vi.spyOn(router, "isTournamentWaLicensed").mockResolvedValue(false);
      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp");
      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      const result = await router.sendReply(
        10, // tournament 10 is unlicensed
        "whatsapp:+919876543210",
        "Hello",
        "whatsapp",
      );

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(sendWhatsAppSpy).not.toHaveBeenCalled();
      expect(sendSmsSpy).not.toHaveBeenCalled(); // Crucial: ZERO SMS fallback!
    });

    it("STOP revokes WhatsApp consent across records without altering SMS consent", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
      } as any);
      vi.spyOn(db, "delete").mockReturnValue({ where: vi.fn().mockResolvedValue({}) } as any);
      vi.spyOn(db, "insert").mockReturnValue({ values: vi.fn().mockResolvedValue({}) } as any);
      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      await router.processInboundMessage({
        from: "+919876543210",
        channel: "whatsapp",
        text: "STOP",
      });

      expect(sendWhatsAppSpy).toHaveBeenCalledTimes(1);
      expect(sendSmsSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      const setCall = (updateSpy.mock.results[0]?.value as any)?.set.mock.calls[0][0];
      expect(setCall).toEqual({ whatsappConsent: false });
      // Confirmed: SMS consent column was NOT modified
      expect(setCall).not.toHaveProperty("smsConsent");
    });
  });
});
