import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms, buildWaMeLink, buildConsentSms } from "../src/lib/comm-sender";
import {
  sendDltSms,
  playerSoldTemplateId,
  teamOwnerTemplateId,
  viewerLinkTemplateId,
} from "../src/lib/fast2sms";
import { sendEmail, isEmailEnabled } from "../src/lib/notifications/providers/email-provider";

describe("Stage 0 — SMS & Email Compatibility Baseline Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ─── 1. BulkSMS Gateway SMS Sender ───────────────────────────────────────────

  describe("BulkSMS Gateway (sendSms)", () => {
    it("returns stub success when credentials are not configured", async () => {
      delete process.env.BULKSMS_KEY;
      delete process.env.BULKSMS_PASSWORD;
      delete process.env.BULKSMS_SENDER;
      delete process.env.BULKSMS_TEMPLATE_ID;

      const result = await sendSms("9876543210", "Test message");
      expect(result.success).toBe(true);
      expect(result.stub).toBe(true);
      expect(result.messageSid).toMatch(/^stub_sms_/);
    });

    it("normalises 10, 11, and 12 digit numbers and encodes special characters (&, +, #)", async () => {
      process.env.BULKSMS_KEY = "test_bulk_key";
      process.env.BULKSMS_SENDER = "BIDWAR";
      process.env.BULKSMS_TEMPLATE_ID = "1407161000";

      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          text: async () => "987654321", // positive integer string represents success
        } as Response;
      });

      // Test 1: 10-digit mobile & special characters
      const res1 = await sendSms("9876543210", "Score: 100 & 2 wickets + #1 rank");
      expect(res1.success).toBe(true);
      expect(res1.messageSid).toBe("987654321");

      const parsedUrl1 = new URL(capturedUrl);
      expect(parsedUrl1.origin).toBe("https://api.bulksmsgateway.in");
      expect(parsedUrl1.pathname).toBe("/sendmessage.php");
      expect(parsedUrl1.searchParams.get("user")).toBe("bidwarsms");
      expect(parsedUrl1.searchParams.get("password")).toBe("test_bulk_key");
      expect(parsedUrl1.searchParams.get("sender")).toBe("BIDWAR");
      expect(parsedUrl1.searchParams.get("template_id")).toBe("1407161000");
      expect(parsedUrl1.searchParams.get("type")).toBe("3");
      expect(parsedUrl1.searchParams.get("mobile")).toBe("919876543210");
      // Verify encoding replacements: & -> Jg==, + -> Kw==, # -> Iw==
      expect(parsedUrl1.searchParams.get("message")).toBe("Score: 100 Jg== 2 wickets Kw== Iw==1 rank");

      // Test 2: 11-digit mobile starting with 0
      await sendSms("09876543210", "Message");
      const parsedUrl2 = new URL(capturedUrl);
      expect(parsedUrl2.searchParams.get("mobile")).toBe("919876543210");

      // Test 3: 12-digit mobile starting with 91
      await sendSms("+91 98765-43210", "Message");
      const parsedUrl3 = new URL(capturedUrl);
      expect(parsedUrl3.searchParams.get("mobile")).toBe("919876543210");
    });

    it("handles BulkSMS gateway rejection strings gracefully", async () => {
      process.env.BULKSMS_KEY = "test_bulk_key";
      process.env.BULKSMS_SENDER = "BIDWAR";
      process.env.BULKSMS_TEMPLATE_ID = "1407161000";

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          text: async () => "Invalid Sender ID or Template ID",
        } as Response;
      });

      const res = await sendSms("9876543210", "Message");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid Sender ID or Template ID");
    });

    it("handles network timeout / abort cleanly", async () => {
      process.env.BULKSMS_KEY = "test_bulk_key";
      process.env.BULKSMS_SENDER = "BIDWAR";
      process.env.BULKSMS_TEMPLATE_ID = "1407161000";

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        throw new Error("Connection timeout");
      });

      const res = await sendSms("9876543210", "Message");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Connection timeout");
    });
  });

  // ─── 2. Fast2SMS DLT Sender & Template ID Precedence ─────────────────────────

  describe("Fast2SMS DLT Sender (sendDltSms)", () => {
    it("respects environment variable precedence for DLT template IDs", () => {
      process.env.BULKSMS_PLAYER_SOLD_TEMPLATE_ID = "ENV_SOLD_123";
      process.env.BULKSMS_TEAM_OWNER_TEMPLATE_ID = "ENV_OWNER_456";
      process.env.BULKSMS_VIEWER_LINK_TEMPLATE_ID = "ENV_VIEWER_789";

      expect(playerSoldTemplateId()).toBe("ENV_SOLD_123");
      expect(teamOwnerTemplateId()).toBe("ENV_OWNER_456");
      expect(viewerLinkTemplateId()).toBe("ENV_VIEWER_789");

      delete process.env.BULKSMS_PLAYER_SOLD_TEMPLATE_ID;
      delete process.env.BULKSMS_TEAM_OWNER_TEMPLATE_ID;
      delete process.env.BULKSMS_VIEWER_LINK_TEMPLATE_ID;

      expect(playerSoldTemplateId()).toBe("");
      expect(teamOwnerTemplateId()).toBe("");
      expect(viewerLinkTemplateId()).toBe("");
    });

    it("returns error when API key, sender, or template ID is missing", async () => {
      delete process.env.BULKSMS_KEY;
      delete process.env.BULKSMS_PASSWORD;
      delete process.env.BULKSMS_SENDER;

      const res = await sendDltSms(["9876543210"], "TPL_001", ["Player", "Team"]);
      expect(res.success).toBe(false);
      expect(res.error).toContain("DLT SMS not fully configured");
    });

    it("correctly constructs Fast2SMS DLT payload with pipe-delimited variables", async () => {
      process.env.BULKSMS_KEY = "fast2sms_api_secret";
      process.env.BULKSMS_SENDER = "BIDWAR";

      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return {
          ok: true,
          text: async () => JSON.stringify({ return: true, request_id: "req_f2s_123" }),
        } as Response;
      });

      const res = await sendDltSms(
        ["+919876543210", "9876543211"],
        "DLT_TEMPLATE_100",
        ["Virat Kohli", "Royal Challengers", "1500000", "https://bidwar.in"],
      );

      expect(res.success).toBe(true);
      expect(capturedUrl).toBe("https://www.fast2sms.com/dev/bulkV2");
      expect(capturedInit?.method).toBe("POST");

      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers.authorization).toBe("fast2sms_api_secret");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(capturedInit?.body as string);
      expect(body.sender_id).toBe("BIDWAR");
      expect(body.message).toBe("DLT_TEMPLATE_100");
      expect(body.route).toBe("dlt");
      expect(body.numbers).toBe("9876543210,9876543211");
      expect(body.variables_values).toBe("Virat Kohli|Royal Challengers|1500000|https://bidwar.in");
    });

    it("parses Fast2SMS API errors appropriately", async () => {
      process.env.BULKSMS_KEY = "fast2sms_api_secret";
      process.env.BULKSMS_SENDER = "BIDWAR";

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ return: false, message: ["Invalid mobile number"] }),
        } as Response;
      });

      const res = await sendDltSms(["9876543210"], "DLT_100", ["A", "B"]);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid mobile number");
    });
  });

  // ─── 3. Resend Email Provider ────────────────────────────────────────────────

  describe("Resend Email Provider (sendEmail)", () => {
    it("reports enabled status strictly via EMAIL_ENABLED=true", () => {
      process.env.EMAIL_ENABLED = "true";
      expect(isEmailEnabled()).toBe(true);

      process.env.EMAIL_ENABLED = "false";
      expect(isEmailEnabled()).toBe(false);

      delete process.env.EMAIL_ENABLED;
      expect(isEmailEnabled()).toBe(false);
    });

    it("returns stub mode when EMAIL_ENABLED is false", async () => {
      process.env.EMAIL_ENABLED = "false";
      process.env.RESEND_API_KEY = "re_test_key";
      process.env.MAIL_FROM = "notifications@bidwar.in";

      const res = await sendEmail({
        to: "player@example.com",
        subject: "Welcome",
        html: "<p>Hello</p>",
      });

      expect(res.success).toBe(true);
      expect(res.stub).toBe(true);
      expect(res.messageId).toMatch(/^stub_email_/);
    });

    it("returns stub mode when credentials are missing even if enabled", async () => {
      process.env.EMAIL_ENABLED = "true";
      delete process.env.RESEND_API_KEY;
      delete process.env.MAIL_FROM;

      const res = await sendEmail({
        to: "player@example.com",
        subject: "Welcome",
        html: "<p>Hello</p>",
      });

      expect(res.success).toBe(true);
      expect(res.stub).toBe(true);
      expect(res.messageId).toMatch(/^stub_email_/);
    });

    it("dispatches HTTP POST to Resend API when properly configured", async () => {
      process.env.EMAIL_ENABLED = "true";
      process.env.RESEND_API_KEY = "re_live_secret";
      process.env.MAIL_FROM = "BidWar Notifications <notifications@bidwar.in>";

      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "re_msg_abc123" }),
        } as Response;
      });

      const res = await sendEmail({
        to: "recipient@bidwar.in",
        subject: "Tournament Registered",
        html: "<h1>Welcome</h1>",
      });

      expect(res.success).toBe(true);
      expect(res.messageId).toBe("re_msg_abc123");
      expect(capturedUrl).toBe("https://api.resend.com/emails");
      expect(capturedInit?.method).toBe("POST");

      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer re_live_secret");
      expect(headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(capturedInit?.body as string);
      expect(body.from).toBe("BidWar Notifications <notifications@bidwar.in>");
      expect(body.to).toEqual(["recipient@bidwar.in"]);
      expect(body.subject).toBe("Tournament Registered");
      expect(body.html).toBe("<h1>Welcome</h1>");
    });

    it("captures and returns Resend API errors on failure", async () => {
      process.env.EMAIL_ENABLED = "true";
      process.env.RESEND_API_KEY = "re_live_secret";
      process.env.MAIL_FROM = "notifications@bidwar.in";

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 422,
          json: async () => ({ message: "Domain not verified" }),
        } as Response;
      });

      const res = await sendEmail({
        to: "recipient@bidwar.in",
        subject: "Hello",
        html: "<p>Test</p>",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Domain not verified");
    });
  });

  // ─── 4. Pre-Auction Consent Helpers ──────────────────────────────────────────

  describe("Consent Blast Copy & WhatsApp Link Construction", () => {
    it("constructs correct wa.me link with opt-in token", () => {
      process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+919876543210";
      const link1 = buildWaMeLink("token_abc_123");
      expect(link1).toBe("https://wa.me/919876543210?text=OPTIN%20token_abc_123");

      delete process.env.TWILIO_WHATSAPP_FROM;
      const link2 = buildWaMeLink("token_abc_123");
      expect(link2).toBe("https://wa.me/?text=OPTIN%20token_abc_123");
    });

    it("builds consent SMS with tournament name and link", () => {
      const waLink = "https://wa.me/919876543210?text=OPTIN%20tok123";
      const sms = buildConsentSms("BPL 2026", waLink);
      expect(sms).toBe(
        "BidWar: BPL 2026 auction kal hoga. WhatsApp updates ke liye click karein: https://wa.me/919876543210?text=OPTIN%20tok123 — Reply STOP to opt out.",
      );
    });
  });
});
