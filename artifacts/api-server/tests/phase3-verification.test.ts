import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { Request } from "express";
import {
  ConversationRouter,
  conversationRouter,
} from "../src/lib/communication/conversation-router";
import {
  KVTechMediaProvider,
} from "../src/lib/communication/providers/kv-techmedia-provider";
import * as commSender from "../src/lib/comm-sender";
import { verifyTwilioSignature, generateOtp as webhookGenerateOtp } from "../src/routes/webhooks";
import { db } from "@workspace/db";
import {
  commLogsTable,
  otpSessionsTable,
  consentTokensTable,
  botSessionsTable,
  waConsentEventsTable,
  playersTable,
  teamsTable,
  organizersTable,
} from "@workspace/db";

describe("Phase 3.1 Surgical Security Fixes & Re-Verification", () => {
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
  // 1. P0 — Cryptographically Secure OTP Generation
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. P0 — Cryptographically Secure OTP Generation", () => {
    it("ConversationRouter.generateOtp uses CSPRNG and never calls Math.random", () => {
      const mathRandomSpy = vi.spyOn(Math, "random");
      const otp = router.generateOtp();

      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      const val = parseInt(otp, 10);
      expect(val).toBeGreaterThanOrEqual(100000);
      expect(val).toBeLessThan(1000000);

      // Math.random must NEVER be called
      expect(mathRandomSpy).not.toHaveBeenCalled();
    });

    it("webhooks.generateOtp uses CSPRNG and never calls Math.random", () => {
      const mathRandomSpy = vi.spyOn(Math, "random");
      const otp = webhookGenerateOtp();

      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      const val = parseInt(otp, 10);
      expect(val).toBeGreaterThanOrEqual(100000);
      expect(val).toBeLessThan(1000000);

      // Math.random must NEVER be called
      expect(mathRandomSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. P0 — Concurrent Inbound-Message Deduplication
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. P0 — Concurrent Inbound-Message Deduplication", () => {
    it("serializes concurrent duplicate requests: only one executes and sends reply", async () => {
      // Mock db.select returning empty until recorded
      let recordCount = 0;
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => (recordCount > 0 ? [{ id: 1 }] : []),
          }),
        }),
      })) as any);

      vi.spyOn(db, "insert").mockImplementation((() => ({
        values: async () => {
          recordCount++;
          return {};
        },
      })) as any);

      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const sendSmsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      // Two simultaneous calls with the exact same provider message ID
      const call1 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: "wamid.CONCURRENT_LOCK_001",
      });

      const call2 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: "wamid.CONCURRENT_LOCK_001",
      });

      const [res1, res2] = await Promise.all([call1, call2]);

      // Exactly ONE request must execute side effects, the other is deduplicated
      const repliesSent = [res1.replySent, res2.replySent].filter(Boolean).length;
      expect(repliesSent).toBe(1);

      const deduplicatedCount = [res1.deduplicated, res2.deduplicated].filter(Boolean).length;
      expect(deduplicatedCount).toBe(1);

      // Outbound message was sent exactly ONCE
      expect(sendWhatsAppSpy).toHaveBeenCalledTimes(1);
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("processes different message IDs independently without locking collisions", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      })) as any);
      vi.spyOn(db, "insert").mockImplementation((() => ({ values: async () => ({}) })) as any);
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      const call1 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: "wamid.DIFF_ID_001",
      });

      const call2 = router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: "wamid.DIFF_ID_002",
      });

      const [res1, res2] = await Promise.all([call1, call2]);
      expect(res1.replySent).toBe(true);
      expect(res2.replySent).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });

    it("handles missing messageId safely without locking failure", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      })) as any);
      vi.spyOn(db, "insert").mockImplementation((() => ({ values: async () => ({}) })) as any);
      const sendSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

      const res = await router.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        // messageId omitted
      });

      expect(res.handled).toBe(true);
      expect(res.replySent).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it("cleans up lock on processing failure, leaving recovery path for provider retry", async () => {
      const lockKey = "wamid.CRASH_TEST_001";
      const lock = await router.acquireMessageLock(lockKey);
      expect(lock.acquired).toBe(true);

      // Releasing lock makes it acquirable again
      await lock.release();

      const lock2 = await router.acquireMessageLock(lockKey);
      expect(lock2.acquired).toBe(true);
      await lock2.release();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. P1 — Prevent Accidental WhatsApp-to-SMS Fallback
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. P1 — Prevent Accidental WhatsApp-to-SMS Fallback", () => {
    it("inbound WhatsApp STOP replies strictly on WhatsApp and NEVER calls sendSms", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "revokeConsentAcrossRecords").mockResolvedValue();
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const sendSmsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "+919876543210",
        channel: "whatsapp",
        text: "STOP",
      });

      expect(sendWhatsAppSpy).toHaveBeenCalledTimes(1);
      const [to, body] = sendWhatsAppSpy.mock.calls[0];
      expect(to).toBe("whatsapp:+919876543210");
      expect(body).toContain("unsubscribe ho gaye hain");

      // Crucial: sendSms must NEVER be called
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("inbound WhatsApp Guest command replies strictly on WhatsApp and NEVER calls sendSms", async () => {
      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest",
      });
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const sendSmsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "+919876543210",
        channel: "whatsapp",
        text: "REPORT",
      });

      expect(sendWhatsAppSpy).toHaveBeenCalledTimes(1);
      const [, body] = sendWhatsAppSpy.mock.calls[0];
      expect(body).toContain("Access Restricted");
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("inbound SMS command routes to sendSms and never sends on WhatsApp", async () => {
      vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();

      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });
      const sendSmsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({ success: true });

      await router.processInboundMessage({
        from: "+919876543210",
        channel: "sms",
        text: "HELP",
      });

      expect(sendSmsSpy).toHaveBeenCalledTimes(1);
      expect(sendWhatsAppSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. P1 — Twilio Reverse-Proxy Host Parsing
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. P1 — Twilio Reverse-Proxy Host Parsing", () => {
    const authToken = "auth_token_secret_1234567890";
    const baseParams: Record<string, string> = {
      Body: "HELLO",
      From: "+919876543210",
      To: "+14155238886",
    };

    function computeSignature(url: string, params: Record<string, string>): string {
      const sortedKeys = Object.keys(params).sort();
      const str = url + sortedKeys.reduce((acc, k) => acc + k + params[k], "");
      return crypto.createHmac("sha1", authToken).update(str).digest("base64");
    }

    beforeEach(() => {
      process.env.TWILIO_AUTH_TOKEN = authToken;
    });

    it("verifies signature with single X-Forwarded-Host", () => {
      const originalUrl = "/api/webhooks/comm-inbound";
      const expectedUrl = `https://api.bidwar.in${originalUrl}`;
      const sig = computeSignature(expectedUrl, baseParams);

      const mockReq = {
        headers: {
          "x-twilio-signature": sig,
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.bidwar.in",
        },
        originalUrl,
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(true);
    });

    it("verifies signature with multi-hop comma-separated X-Forwarded-Host", () => {
      const originalUrl = "/api/webhooks/comm-inbound";
      const expectedUrl = `https://api.bidwar.in${originalUrl}`;
      const sig = computeSignature(expectedUrl, baseParams);

      const mockReq = {
        headers: {
          "x-twilio-signature": sig,
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "api.bidwar.in, 10.0.1.50, edge-proxy-01",
        },
        originalUrl,
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(true);
    });

    it("falls back to req.headers.host when X-Forwarded-Host is absent", () => {
      const originalUrl = "/api/webhooks/comm-inbound";
      const expectedUrl = `https://direct.bidwar.in${originalUrl}`;
      const sig = computeSignature(expectedUrl, baseParams);

      const mockReq = {
        headers: {
          "x-twilio-signature": sig,
          host: "direct.bidwar.in",
        },
        originalUrl,
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(true);
    });

    it("rejects tampered signature behind proxy", () => {
      const originalUrl = "/api/webhooks/comm-inbound";
      const mockReq = {
        headers: {
          "x-twilio-signature": "tampered_signature_123=",
          "x-forwarded-host": "api.bidwar.in, 10.0.1.50",
        },
        originalUrl,
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(false);
    });

    it("fails closed in production when TWILIO_AUTH_TOKEN is missing", () => {
      process.env.NODE_ENV = "production";
      delete process.env.TWILIO_AUTH_TOKEN;

      const mockReq = {
        headers: {
          "x-twilio-signature": "some_sig",
          "x-forwarded-host": "api.bidwar.in",
        },
        originalUrl: "/api/webhooks/comm-inbound",
        body: baseParams,
      } as unknown as Request;

      expect(verifyTwilioSignature(mockReq)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Meta Webhook Signature Security
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Meta Webhook Signature Security", () => {
    const testSecret = "sec_test_secret_1234567890";
    const provider = new KVTechMediaProvider({ appSecret: testSecret });
    const payloadBuffer = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));

    it("rejects signatures with valid length but tampered digest bytes", () => {
      const tamperedHex = "a".repeat(64);
      const mockReq = {
        headers: { "x-hub-signature-256": `sha256=${tamperedHex}` },
        rawBody: payloadBuffer,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(false);
    });

    it("rejects requests where rawBody is not a Buffer", () => {
      const validHmac = crypto.createHmac("sha256", testSecret).update(payloadBuffer).digest("hex");
      const mockReq = {
        headers: { "x-hub-signature-256": `sha256=${validHmac}` },
        rawBody: JSON.stringify({ object: "test" }),
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(false);
    });

    it("fails closed in production if secret is an empty string", () => {
      process.env.NODE_ENV = "production";
      const emptySecretProvider = new KVTechMediaProvider({ appSecret: "   " });
      const mockReq = {
        headers: { "x-hub-signature-256": `sha256=${"b".repeat(64)}` },
        rawBody: payloadBuffer,
      } as unknown as Request;

      expect(emptySecretProvider.verifyWebhookSignature(mockReq)).toBe(false);
    });
  });
});
