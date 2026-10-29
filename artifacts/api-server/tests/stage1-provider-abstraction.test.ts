import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import type { Request } from "express";
import {
  resolveWhatsAppProviderId,
  getWhatsAppProvider,
  getActiveWhatsAppProvider,
  validateWhatsAppProviderAtStartup,
  TwilioWhatsAppProvider,
  MetaDirectProvider,
  KVTechMediaProvider,
  MockWhatsAppProvider,
  nullWhatsAppProvider,
} from "../src/lib/communication/providers";
import {
  sendWhatsApp,
  resolveWhatsAppProvider,
  isTournamentLicensedForComm,
  sendLicensedWhatsApp,
} from "../src/lib/comm-sender";
import { db } from "@workspace/db";

describe("Stage 1: WhatsApp Provider Abstraction & Startup Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Provider Selection and Resolution
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Provider Selection (Single Source of Truth: WHATSAPP_PROVIDER)", () => {
    it("resolves kv_techmedia correctly with case-insensitivity and aliases", () => {
      process.env.WHATSAPP_PROVIDER = "kv_techmedia";
      expect(resolveWhatsAppProviderId()).toBe("kv_techmedia");

      process.env.WHATSAPP_PROVIDER = "KV_TECHMEDIA";
      expect(resolveWhatsAppProviderId()).toBe("kv_techmedia");

      process.env.WHATSAPP_PROVIDER = "kvtmedia";
      expect(resolveWhatsAppProviderId()).toBe("kv_techmedia");

      process.env.WHATSAPP_PROVIDER = "kv";
      expect(resolveWhatsAppProviderId()).toBe("kv_techmedia");
    });

    it("resolves twilio correctly with case-insensitivity", () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      expect(resolveWhatsAppProviderId()).toBe("twilio");

      process.env.WHATSAPP_PROVIDER = "TWILIO";
      expect(resolveWhatsAppProviderId()).toBe("twilio");
    });

    it("resolves meta_direct correctly with case-insensitivity and aliases", () => {
      process.env.WHATSAPP_PROVIDER = "meta_direct";
      expect(resolveWhatsAppProviderId()).toBe("meta_direct");

      process.env.WHATSAPP_PROVIDER = "META_DIRECT";
      expect(resolveWhatsAppProviderId()).toBe("meta_direct");

      process.env.WHATSAPP_PROVIDER = "meta";
      expect(resolveWhatsAppProviderId()).toBe("meta_direct");

      process.env.WHATSAPP_PROVIDER = "meta_cloud";
      expect(resolveWhatsAppProviderId()).toBe("meta_direct");
    });

    it("resolves mock correctly for explicit automated testing", () => {
      process.env.WHATSAPP_PROVIDER = "mock";
      expect(resolveWhatsAppProviderId()).toBe("mock");
    });

    it("resolves none when WHATSAPP_PROVIDER is empty or unsupported", () => {
      delete process.env.WHATSAPP_PROVIDER;
      expect(resolveWhatsAppProviderId()).toBe("none");

      process.env.WHATSAPP_PROVIDER = "unknown_provider";
      expect(resolveWhatsAppProviderId()).toBe("none");
    });

    it("never auto-detects based on credential presence (no silent provider switching)", () => {
      // Unset WHATSAPP_PROVIDER, but define Twilio and KV credentials
      delete process.env.WHATSAPP_PROVIDER;
      process.env.TWILIO_ACCOUNT_SID = "AC_MOCK_ACCOUNT_SID_FOR_TESTS";
      process.env.TWILIO_AUTH_TOKEN = "secret_twilio_token";
      process.env.KV_META_ACCESS_TOKEN = "secret_kv_token";

      // Must remain "none" without auto-detection
      expect(resolveWhatsAppProviderId()).toBe("none");
      expect(resolveWhatsAppProvider()).toBe("none");
    });

    it("comm-sender resolveWhatsAppProvider() matches resolveWhatsAppProviderId()", () => {
      process.env.WHATSAPP_PROVIDER = "meta_direct";
      expect(resolveWhatsAppProvider()).toBe("meta_direct");

      process.env.WHATSAPP_PROVIDER = "twilio";
      expect(resolveWhatsAppProvider()).toBe("twilio");
    });

    it("getWhatsAppProvider returns the matching provider instance", () => {
      expect(getWhatsAppProvider("kv_techmedia").providerId).toBe("kv_techmedia");
      expect(getWhatsAppProvider("twilio").providerId).toBe("twilio");
      expect(getWhatsAppProvider("meta_direct").providerId).toBe("meta_direct");
      expect(getWhatsAppProvider("mock").providerId).toBe("mock");
      expect(getWhatsAppProvider("none").providerId).toBe("none");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Configuration Validation (No Network Calls, No Secret Leakage)
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Configuration Validation & Secret Safety", () => {
    it("validates KVTechMediaProvider required environment variables", () => {
      process.env.NODE_ENV = "production";
      delete process.env.KV_META_PHONE_NUMBER_ID;
      delete process.env.KV_META_ACCESS_TOKEN;
      delete process.env.KV_META_APP_SECRET;
      delete process.env.KV_WEBHOOK_VERIFY_TOKEN;

      const provider = new KVTechMediaProvider();
      const result = provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.errors.some((e) => e.includes("KV_META_PHONE_NUMBER_ID"))).toBe(true);
      expect(result.errors.some((e) => e.includes("KV_META_ACCESS_TOKEN"))).toBe(true);
      expect(result.errors.some((e) => e.includes("KV_META_APP_SECRET"))).toBe(true);
      expect(result.errors.some((e) => e.includes("KV_WEBHOOK_VERIFY_TOKEN"))).toBe(true);
    });

    it("validates TwilioWhatsAppProvider required environment variables", () => {
      const provider = new TwilioWhatsAppProvider({
        accountSid: "",
        authToken: "",
        whatsappFrom: "",
      });
      const result = provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("TWILIO_ACCOUNT_SID"))).toBe(true);
      expect(result.errors.some((e) => e.includes("TWILIO_AUTH_TOKEN"))).toBe(true);
      expect(result.errors.some((e) => e.includes("TWILIO_WHATSAPP_FROM"))).toBe(true);
    });

    it("validates MetaDirectProvider required environment variables", () => {
      process.env.NODE_ENV = "production";
      const provider = new MetaDirectProvider({
        phoneNumberId: "",
        accessToken: "",
        appSecret: "",
        verifyToken: "",
      });
      const result = provider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("META_DIRECT_PHONE_NUMBER_ID"))).toBe(true);
      expect(result.errors.some((e) => e.includes("META_DIRECT_ACCESS_TOKEN"))).toBe(true);
      expect(result.errors.some((e) => e.includes("META_DIRECT_APP_SECRET"))).toBe(true);
      expect(result.errors.some((e) => e.includes("META_DIRECT_VERIFY_TOKEN"))).toBe(true);
    });

    it("guards MockWhatsAppProvider against accidental production usage", () => {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_MOCK_COMM_IN_PROD;

      const mockProvider = new MockWhatsAppProvider();
      const result = mockProvider.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("ALLOW_MOCK_COMM_IN_PROD");

      // Allowed if explicitly opted in
      process.env.ALLOW_MOCK_COMM_IN_PROD = "true";
      expect(mockProvider.validateConfig().valid).toBe(true);
    });

    it("never logs or exposes secret token values in validation errors", () => {
      const secretToken = "super_secret_token_value_999";
      const provider = new MetaDirectProvider({
        phoneNumberId: "123456",
        accessToken: secretToken,
        appSecret: "super_secret_app_secret",
        verifyToken: "", // Only verify token is missing
      });

      const validation = provider.validateConfig();
      const serializedErrors = JSON.stringify(validation.errors);

      expect(serializedErrors).not.toContain(secretToken);
      expect(serializedErrors).not.toContain("super_secret_app_secret");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Application Startup Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Application Startup Validation", () => {
    it("fails startup validation in production if WHATSAPP_PROVIDER is not set", () => {
      process.env.NODE_ENV = "production";
      delete process.env.WHATSAPP_PROVIDER;

      const result = validateWhatsAppProviderAtStartup();
      expect(result.valid).toBe(false);
      expect(result.provider).toBe("none");
      expect(result.errors[0]).toContain("WHATSAPP_PROVIDER is not set");
    });

    it("fails startup validation in production if selected provider credentials are incomplete", () => {
      process.env.NODE_ENV = "production";
      process.env.WHATSAPP_PROVIDER = "twilio";
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      const result = validateWhatsAppProviderAtStartup();
      expect(result.valid).toBe(false);
      expect(result.provider).toBe("twilio");
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it("passes startup validation in non-production with warning when WHATSAPP_PROVIDER is unset", () => {
      process.env.NODE_ENV = "development";
      delete process.env.WHATSAPP_PROVIDER;

      const result = validateWhatsAppProviderAtStartup();
      expect(result.valid).toBe(true);
      expect(result.provider).toBe("none");
      expect(result.errors[0]).toContain("stub/disabled mode");
    });

    it("never makes live HTTP calls during startup validation", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      process.env.WHATSAPP_PROVIDER = "meta_direct";
      process.env.META_DIRECT_PHONE_NUMBER_ID = "10001";
      process.env.META_DIRECT_ACCESS_TOKEN = "EAAGtest";
      process.env.META_DIRECT_APP_SECRET = "testsecret";
      process.env.META_DIRECT_VERIFY_TOKEN = "verify123";

      const result = validateWhatsAppProviderAtStartup();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.valid).toBe(true);
      expect(result.provider).toBe("meta_direct");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Twilio WhatsApp Provider Implementation
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Twilio WhatsApp Provider", () => {
    const validConfig = {
      accountSid: "AC_MOCK_ACCOUNT_SID_FOR_TESTS",
      authToken: "test_auth_token_secret",
      whatsappFrom: "whatsapp:+14155238886",
    };

    it("formats Indian phone numbers to E.164 and appends STOP footer compliance", async () => {
      const provider = new TwilioWhatsAppProvider(validConfig);

      let capturedUrl = "";
      let capturedBody: URLSearchParams | null = null;
      let capturedAuth = "";

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        capturedUrl = url.toString();
        capturedBody = new URLSearchParams(init?.body as string);
        capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
        return new Response(JSON.stringify({ sid: "SM123456" }), { status: 201 });
      });

      const res = await provider.send({
        to: "9876543210",
        type: "text",
        textBody: "Hello from BidWar",
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("SM123456");
      expect(capturedUrl).toContain(validConfig.accountSid);
      expect(capturedBody?.get("To")).toBe("whatsapp:+919876543210");
      expect(capturedBody?.get("From")).toBe(validConfig.whatsappFrom);
      expect(capturedBody?.get("Body")).toContain("Hello from BidWar");
      expect(capturedBody?.get("Body")).toContain("Reply STOP to unsubscribe.");
      expect(capturedAuth).toMatch(/^Basic /);
    });

    it("passes templateSid as ContentSid when provided", async () => {
      const provider = new TwilioWhatsAppProvider(validConfig);
      let capturedBody: URLSearchParams | null = null;

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        capturedBody = new URLSearchParams(init?.body as string);
        return new Response(JSON.stringify({ sid: "SM_TEMPLATE_SID" }), { status: 201 });
      });

      await provider.send({
        to: "+919876543210",
        type: "text",
        textBody: "Template text",
        templateSid: "HX1234567890",
      });

      expect(capturedBody?.get("ContentSid")).toBe("HX1234567890");
    });

    it("classifies HTTP 429 and 5xx as retryable: true, 4xx as retryable: false", async () => {
      const provider = new TwilioWhatsAppProvider(validConfig);

      // 429 Rate Limit
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Too many requests" }), { status: 429 }),
      );
      const res429 = await provider.send({ to: "9876543210", textBody: "test" });
      expect(res429.success).toBe(false);
      expect(res429.retryable).toBe(true);

      // 500 Internal Server Error
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Twilio unavailable" }), { status: 500 }),
      );
      const res500 = await provider.send({ to: "9876543210", textBody: "test" });
      expect(res500.success).toBe(false);
      expect(res500.retryable).toBe(true);

      // 400 Bad Request
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Invalid parameter", code: 21614 }), { status: 400 }),
      );
      const res400 = await provider.send({ to: "9876543210", textBody: "test" });
      expect(res400.success).toBe(false);
      expect(res400.retryable).toBe(false);
    });

    it("verifies webhook signature using HMAC-SHA1 and timingSafeEqual", () => {
      const provider = new TwilioWhatsAppProvider(validConfig);
      const url = "https://api.bidwar.in/webhooks/comm-inbound";
      const params: Record<string, string> = {
        Body: "YES",
        From: "whatsapp:+919876543210",
        To: "whatsapp:+14155238886",
      };

      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, key) => acc + key + params[key], "");
      const expectedSignature = crypto
        .createHmac("sha1", validConfig.authToken)
        .update(url + sortedParams)
        .digest("base64");

      const validReq = {
        headers: {
          "x-twilio-signature": expectedSignature,
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.bidwar.in",
        },
        originalUrl: "/webhooks/comm-inbound",
        body: params,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(validReq)).toBe(true);

      // Tampered body
      const tamperedReq = {
        headers: {
          "x-twilio-signature": expectedSignature,
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.bidwar.in",
        },
        originalUrl: "/webhooks/comm-inbound",
        body: { ...params, Body: "NO" },
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(tamperedReq)).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Meta Direct Cloud API Provider Implementation
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Meta Direct WhatsApp Provider", () => {
    const validConfig = {
      phoneNumberId: "10987654321",
      accessToken: "EAAG_meta_direct_access_token",
      appSecret: "meta_direct_app_secret_12345",
      verifyToken: "meta_direct_verify_token_987",
      apiVersion: "v19.0",
    };

    it("constructs native Meta Graph API text payload with STOP compliance and Bearer auth", async () => {
      const provider = new MetaDirectProvider(validConfig);

      let capturedUrl = "";
      let capturedPayload: any = null;
      let capturedAuth = "";

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        capturedUrl = url.toString();
        capturedPayload = JSON.parse(init?.body as string);
        capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
        return new Response(
          JSON.stringify({
            messaging_product: "whatsapp",
            contacts: [{ input: "919876543210", wa_id: "919876543210" }],
            messages: [{ id: "wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgWM" }],
          }),
          { status: 200 },
        );
      });

      const res = await provider.send({
        to: "+91-9876543210",
        type: "text",
        textBody: "Match starting now!",
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgWM");
      expect(capturedUrl).toBe(
        `https://graph.facebook.com/${validConfig.apiVersion}/${validConfig.phoneNumberId}/messages`,
      );
      expect(capturedAuth).toBe(`Bearer ${validConfig.accessToken}`);
      expect(capturedPayload.messaging_product).toBe("whatsapp");
      expect(capturedPayload.to).toBe("919876543210");
      expect(capturedPayload.type).toBe("text");
      expect(capturedPayload.text.body).toContain("Match starting now!");
      expect(capturedPayload.text.body).toContain("Reply STOP to unsubscribe.");
    });

    it("constructs native Meta Graph API template payload with components", async () => {
      const provider = new MetaDirectProvider(validConfig);
      let capturedPayload: any = null;

      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        capturedPayload = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ messages: [{ id: "wamid.TEMPLATE_MSG_ID" }] }),
          { status: 200 },
        );
      });

      await provider.send({
        to: "9876543210",
        type: "template",
        templateName: "auction_player_sold_v1",
        templateLanguage: "en",
        templateComponents: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Virat Kohli" },
              { type: "text", text: "RCB" },
            ],
          },
        ],
      });

      expect(capturedPayload.type).toBe("template");
      expect(capturedPayload.template.name).toBe("auction_player_sold_v1");
      expect(capturedPayload.template.language.code).toBe("en");
      expect(capturedPayload.template.components[0].parameters[0].text).toBe("Virat Kohli");
    });

    it("verifies webhook GET challenge correctly", () => {
      const provider = new MetaDirectProvider(validConfig);

      const validReq = {
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": validConfig.verifyToken,
          "hub.challenge": "random_hub_challenge_string_123",
        },
      } as unknown as Request;

      const result = provider.verifyWebhookChallenge(validReq);
      expect(result.isValid).toBe(true);
      expect(result.challenge).toBe("random_hub_challenge_string_123");

      const invalidReq = {
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": "wrong_token",
          "hub.challenge": "123",
        },
      } as unknown as Request;

      expect(provider.verifyWebhookChallenge(invalidReq).isValid).toBe(false);
    });

    it("verifies webhook signature using HMAC-SHA256 and constant-time comparison", () => {
      const provider = new MetaDirectProvider(validConfig);
      const rawBody = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }), "utf8");
      const hmac = crypto.createHmac("sha256", validConfig.appSecret).update(rawBody).digest("hex");

      const validReq = {
        headers: { "x-hub-signature-256": `sha256=${hmac}` },
        rawBody,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(validReq)).toBe(true);

      const invalidReq = {
        headers: { "x-hub-signature-256": `sha256=0000000000000000000000000000000000000000000000000000000000000000` },
        rawBody,
      } as unknown as Request;

      expect(provider.verifyWebhookSignature(invalidReq)).toBe(false);
    });

    it("normalizes Meta webhook payloads into standard statuses and messages", () => {
      const provider = new MetaDirectProvider(validConfig);
      const metaPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: "wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgWM",
                      status: "delivered",
                      timestamp: "1700000000",
                      recipient_id: "919876543210",
                    },
                  ],
                  messages: [
                    {
                      from: "919876543210",
                      id: "wamid.INBOUND123",
                      timestamp: "1700000001",
                      type: "text",
                      text: { body: "SCORE" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const normalized = provider.normalizeWebhookPayload(metaPayload);

      expect(normalized.statuses.length).toBe(1);
      expect(normalized.statuses[0].providerMessageId).toBe("wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgWM");
      expect(normalized.statuses[0].status).toBe("delivered");

      expect(normalized.messages.length).toBe(1);
      expect(normalized.messages[0].from).toBe("919876543210");
      expect(normalized.messages[0].messageId).toBe("wamid.INBOUND123");
      expect(normalized.messages[0].text).toBe("SCORE");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Mock Provider Implementation
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Mock Provider for Isolated Testing", () => {
    it("captures sent messages and allows inspection and clearing", async () => {
      const mockProvider = new MockWhatsAppProvider();
      mockProvider.clearSentMessages();

      const result = await mockProvider.send({
        to: "9876543210",
        type: "text",
        textBody: "Mock Message 1",
      });

      expect(result.success).toBe(true);
      expect(result.stub).toBe(true);
      expect(mockProvider.getSentMessages().length).toBe(1);
      expect(mockProvider.getSentMessages()[0].textBody).toBe("Mock Message 1");

      mockProvider.clearSentMessages();
      expect(mockProvider.getSentMessages().length).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. comm-sender.ts Integration & Backward Compatibility
  // ───────────────────────────────────────────────────────────────────────────
  describe("7. comm-sender.ts Backward Compatibility and Invariants", () => {
    it("dispatches sendWhatsApp via active provider seamlessly", async () => {
      process.env.WHATSAPP_PROVIDER = "mock";
      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;
      mock.clearSentMessages();

      const sendResult = await sendWhatsApp("9876543210", "BidWar Tournament Welcome");

      expect(sendResult.success).toBe(true);
      expect(sendResult.messageSid).toMatch(/^mock_wa_/);
      expect(mock.getSentMessages().length).toBe(1);
      expect(mock.getSentMessages()[0].textBody).toBe("BidWar Tournament Welcome");
    });

    it("returns error without cross-provider fallback when active provider fails", async () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      process.env.TWILIO_ACCOUNT_SID = "AC_MOCK_ACCOUNT_SID_FOR_TESTS";
      process.env.TWILIO_AUTH_TOKEN = "secret_token";
      process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

      // Also define KV credentials in the environment
      process.env.KV_META_PHONE_NUMBER_ID = "kv_id";
      process.env.KV_META_ACCESS_TOKEN = "kv_token";

      // Mock Twilio fetch returning an error
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error_message: "Twilio destination unreachable" }), {
          status: 400,
        }),
      );

      const res = await sendWhatsApp("9876543210", "Test message");

      // Must fail cleanly, never fall back to KV TechMedia
      expect(res.success).toBe(false);
      expect(res.error).toBe("Twilio destination unreachable");
    });

    it("preserves isTournamentLicensedForComm logic", () => {
      expect(isTournamentLicensedForComm(null)).toBe(false);
      expect(isTournamentLicensedForComm({ adminLocked: true, licenseStatus: "active" })).toBe(false);
      expect(isTournamentLicensedForComm({ licenseStatus: "active" })).toBe(true);
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "completed",
          scoringEnabled: true,
          scoringPhase: "active",
          licenseGrantedAt: new Date(),
        }),
      ).toBe(true);
      expect(
        isTournamentLicensedForComm({
          licenseStatus: "completed",
          scoringEnabled: false,
        }),
      ).toBe(false);
    });
  });
});
