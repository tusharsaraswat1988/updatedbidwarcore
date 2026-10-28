import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { Request } from "express";
import {
  KVTechMediaProvider,
  kvTechMediaProvider,
} from "../src/lib/communication/providers/kv-techmedia-provider";
import {
  resolveWhatsAppProvider,
  sendWhatsApp,
  isTournamentLicensedForComm,
} from "../src/lib/comm-sender";
import { maskPhoneNumber, maskSecret } from "../src/lib/logger";

describe("KV TechMedia WhatsApp Provider & Communication Gateway", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Phone & Secret Masking", () => {
    it("masks Indian MSISDNs correctly without leaking middle digits", () => {
      expect(maskPhoneNumber("+919876543210")).toBe("+91******3210");
      expect(maskPhoneNumber("919876543210")).toBe("91******3210");
      expect(maskPhoneNumber("9876543210")).toBe("98******3210");
      expect(maskPhoneNumber("123")).toBe("****");
      expect(maskPhoneNumber(null)).toBe("[EMPTY]");
    });

    it("masks secrets safely", () => {
      expect(maskSecret("EAAGm0PX4ZCpsBAK7...")).toContain("...");
      expect(maskSecret("123")).toBe("***");
      expect(maskSecret(undefined)).toBe("[UNSET]");
    });
  });

  describe("MSISDN Normalization", () => {
    it("normalizes various Indian phone formats to standard 12-digit format", () => {
      const provider = new KVTechMediaProvider();
      expect(provider.normalizeMsisdn("+919876543210")).toBe("919876543210");
      expect(provider.normalizeMsisdn("09876543210")).toBe("919876543210");
      expect(provider.normalizeMsisdn("9876543210")).toBe("919876543210");
      expect(provider.normalizeMsisdn("919876543210")).toBe("919876543210");
    });
  });

  describe("Webhook GET Challenge Verification", () => {
    it("verifies challenge when mode=subscribe and token matches", () => {
      const provider = new KVTechMediaProvider({ verifyToken: "secret_verify_token_123" });
      const mockReq = {
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": "secret_verify_token_123",
          "hub.challenge": "1158201236",
        },
      } as unknown as Request;

      const result = provider.verifyWebhookChallenge(mockReq);
      expect(result.isValid).toBe(true);
      expect(result.challenge).toBe("1158201236");
    });

    it("rejects challenge when token does not match", () => {
      const provider = new KVTechMediaProvider({ verifyToken: "secret_verify_token_123" });
      const mockReq = {
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": "wrong_token",
          "hub.challenge": "1158201236",
        },
      } as unknown as Request;

      const result = provider.verifyWebhookChallenge(mockReq);
      expect(result.isValid).toBe(false);
      expect(result.challenge).toBeUndefined();
    });

    it("fails closed when verify token is not configured", () => {
      delete process.env.KV_WEBHOOK_VERIFY_TOKEN;
      const provider = new KVTechMediaProvider({ verifyToken: undefined });
      const mockReq = {
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": "any_token",
          "hub.challenge": "1158201236",
        },
      } as unknown as Request;

      const result = provider.verifyWebhookChallenge(mockReq);
      expect(result.isValid).toBe(false);
    });
  });

  describe("Webhook POST Signature Verification (HMAC-SHA256)", () => {
    const testSecret = "test_meta_app_secret_998877";
    const rawPayload = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));

    function computeSignature(payload: Buffer, secret: string): string {
      const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      return `sha256=${hmac}`;
    }

    it("verifies authentic payload with valid signature", () => {
      const provider = new KVTechMediaProvider({ appSecret: testSecret });
      const validSig = computeSignature(rawPayload, testSecret);

      const mockReq = {
        headers: { "x-hub-signature-256": validSig },
        rawBody: rawPayload,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(true);
    });

    it("rejects tampered rawBody with original signature", () => {
      const provider = new KVTechMediaProvider({ appSecret: testSecret });
      const validSig = computeSignature(rawPayload, testSecret);
      const tamperedBody = Buffer.from(JSON.stringify({ object: "tampered" }));

      const mockReq = {
        headers: { "x-hub-signature-256": validSig },
        rawBody: tamperedBody,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(false);
    });

    it("rejects header missing sha256= prefix", () => {
      const provider = new KVTechMediaProvider({ appSecret: testSecret });
      const hex = crypto.createHmac("sha256", testSecret).update(rawPayload).digest("hex");

      const mockReq = {
        headers: { "x-hub-signature-256": hex }, // Missing sha256= prefix
        rawBody: rawPayload,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(false);
    });

    it("rejects invalid hex length or malformed characters before timingSafeEqual", () => {
      const provider = new KVTechMediaProvider({ appSecret: testSecret });

      const mockReq = {
        headers: { "x-hub-signature-256": "sha256=tooshorthex" },
        rawBody: rawPayload,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(false);
    });

    it("fails closed when app secret is missing in production", () => {
      process.env.NODE_ENV = "production";
      delete process.env.KV_META_APP_SECRET;
      delete process.env.BIDWAR_ALLOW_INSECURE_TEST_WEBHOOK;

      const provider = new KVTechMediaProvider({ appSecret: undefined });
      const mockReq = {
        headers: { "x-hub-signature-256": "sha256=" + "a".repeat(64) },
        rawBody: rawPayload,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(false);
    });

    it("permits signature bypass ONLY in isolated test env with explicit flag", () => {
      process.env.NODE_ENV = "test";
      process.env.BIDWAR_ALLOW_INSECURE_TEST_WEBHOOK = "true";

      const provider = new KVTechMediaProvider({ appSecret: undefined });
      const mockReq = {
        headers: {},
        rawBody: rawPayload,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(mockReq)).toBe(true);
    });
  });

  describe("Error Classification (Retryable vs Permanent)", () => {
    const provider = new KVTechMediaProvider();

    it("classifies HTTP 429 as retryable", () => {
      const res = provider.classifyError(429, { error: { message: "Too many requests" } });
      expect(res.retryable).toBe(true);
      expect(res.message).toContain("Rate limited");
    });

    it("classifies Meta error code 80007 / 130429 as retryable rate limit", () => {
      const res = provider.classifyError(400, { error: { code: 130429, message: "Cloud API rate limit hit" } });
      expect(res.retryable).toBe(true);
    });

    it("classifies HTTP 5xx gateway errors as retryable", () => {
      const res = provider.classifyError(502, { error: { message: "Bad Gateway" } });
      expect(res.retryable).toBe(true);
      expect(res.message).toContain("Gateway server error");
    });

    it("classifies Meta code 131026 (recipient not on WhatsApp) as permanent non-retryable", () => {
      const res = provider.classifyError(400, {
        error: { code: 131026, message: "Receiver is incapable of receiving this message" },
      });
      expect(res.retryable).toBe(false);
      expect(res.message).toContain("Recipient not on WhatsApp");
    });

    it("classifies Meta code 132000 (template parameter error) as permanent non-retryable", () => {
      const res = provider.classifyError(400, {
        error: { code: 132000, message: "Template param count mismatch" },
      });
      expect(res.retryable).toBe(false);
      expect(res.message).toContain("Template parameter error");
    });
  });

  describe("Outbound Message Dispatch (Mocked HTTP)", () => {
    it("sends message successfully and parses message ID", async () => {
      const provider = new KVTechMediaProvider({
        baseUrl: "https://crmapi.kvtmedia.com/api/meta",
        apiVersion: "v19.0",
        phoneNumberId: "10987654321",
        accessToken: "test_access_token",
      });

      const mockResponse = {
        messaging_product: "whatsapp",
        contacts: [{ input: "919876543210", wa_id: "919876543210" }],
        messages: [{ id: "wamid.HBgLMTE1ODI..." }],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await provider.send({
        to: "9876543210",
        type: "text",
        textBody: "Hello BidWar Player",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("wamid.HBgLMTE1ODI...");
      expect(result.retryable).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://crmapi.kvtmedia.com/api/meta/v19.0/10987654321/messages");
      expect(calledInit?.headers).toEqual(
        expect.objectContaining({
          Authorization: "Bearer test_access_token",
          "Content-Type": "application/json",
        }),
      );
    });

    it("handles network timeout gracefully with retryable=true", async () => {
      const provider = new KVTechMediaProvider({
        phoneNumberId: "10987654321",
        accessToken: "test_token",
      });

      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "TimeoutError";

      vi.spyOn(globalThis, "fetch").mockRejectedValue(timeoutError);

      const result = await provider.send({
        to: "9876543210",
        textBody: "Timeout test",
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toBe("Provider network timeout");
    });

    it("handles malformed JSON response safely", async () => {
      const provider = new KVTechMediaProvider({
        phoneNumberId: "10987654321",
        accessToken: "test_token",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token in JSON");
        },
      } as unknown as Response);

      const result = await provider.send({
        to: "9876543210",
        textBody: "Malformed test",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain("kv_accepted_");
    });

    it("returns stub in non-production when credentials are absent", async () => {
      process.env.NODE_ENV = "test";
      delete process.env.KV_META_PHONE_NUMBER_ID;
      delete process.env.KV_META_ACCESS_TOKEN;

      const provider = new KVTechMediaProvider({
        phoneNumberId: undefined,
        accessToken: undefined,
      });

      const result = await provider.send({
        to: "9876543210",
        textBody: "Stub test",
      });

      expect(result.success).toBe(true);
      expect(result.stub).toBe(true);
      expect(result.messageId).toContain("stub_kv_wa_");
    });

    it("fails safely in production when credentials are absent", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.KV_META_PHONE_NUMBER_ID;
      delete process.env.KV_META_ACCESS_TOKEN;

      const provider = new KVTechMediaProvider({
        phoneNumberId: undefined,
        accessToken: undefined,
      });

      const result = await provider.send({
        to: "9876543210",
        textBody: "Prod test",
      });

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("credentials not configured");
    });
  });

  describe("Webhook Payload Normalization", () => {
    const provider = new KVTechMediaProvider();

    it("extracts delivery status receipts from Meta webhook payload", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_ID_1",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  statuses: [
                    {
                      id: "wamid.HBgLMTIz",
                      status: "delivered",
                      timestamp: "1710000000",
                      recipient_id: "919876543210",
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const normalized = provider.normalizeWebhookPayload(payload);
      expect(normalized.statuses).toHaveLength(1);
      expect(normalized.statuses[0].providerMessageId).toBe("wamid.HBgLMTIz");
      expect(normalized.statuses[0].status).toBe("delivered");
      expect(normalized.statuses[0].recipientId).toBe("919876543210");
      expect(normalized.messages).toHaveLength(0);
    });

    it("extracts inbound user messages from Meta webhook payload", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "WABA_ID_1",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  messages: [
                    {
                      from: "919876543210",
                      id: "wamid.INBOUND_001",
                      timestamp: "1710000000",
                      type: "text",
                      text: { body: "STOP" },
                    },
                  ],
                },
                field: "messages",
              },
            ],
          },
        ],
      };

      const normalized = provider.normalizeWebhookPayload(payload);
      expect(normalized.messages).toHaveLength(1);
      expect(normalized.messages[0].from).toBe("919876543210");
      expect(normalized.messages[0].text).toBe("STOP");
      expect(normalized.messages[0].messageId).toBe("wamid.INBOUND_001");
      expect(normalized.statuses).toHaveLength(0);
    });
  });

  describe("Provider Selection & Licensing Governance", () => {
    it("explicitly selects KV TechMedia when WHATSAPP_PROVIDER=kv_techmedia", () => {
      process.env.WHATSAPP_PROVIDER = "kv_techmedia";
      expect(resolveWhatsAppProvider()).toBe("kv_techmedia");
    });

    it("explicitly selects Twilio when WHATSAPP_PROVIDER=twilio", () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      expect(resolveWhatsAppProvider()).toBe("twilio");
    });

    it("preserves tournament licensing contract", () => {
      // Unlicensed or locked
      expect(isTournamentLicensedForComm(null)).toBe(false);
      expect(isTournamentLicensedForComm({ adminLocked: true })).toBe(false);
      expect(isTournamentLicensedForComm({ licenseStatus: "inactive" })).toBe(false);

      // Active license
      expect(isTournamentLicensedForComm({ licenseStatus: "active", adminLocked: false })).toBe(true);

      // Concluded auction but live active scoring phase
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "completed",
          adminLocked: false,
          scoringEnabled: true,
          scoringPhase: "active",
          licenseGrantedAt: new Date(),
        }),
      ).toBe(true);
    });
  });
});
