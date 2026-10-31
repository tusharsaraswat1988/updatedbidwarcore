import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  notifyPlayerSold,
  notifyPlayerUnsold,
  notifyPlayerReAuction,
} from "../src/lib/whatsapp";
import {
  sendLicensedWhatsApp,
  sendWhatsApp,
  sendSms,
  isTournamentLicensedForComm,
  resolveWhatsAppProvider,
} from "../src/lib/comm-sender";
import * as commSender from "../src/lib/comm-sender";
import {
  communicationPolicyEngine,
  dispatchPushWhatsApp,
} from "../src/lib/communication/policy-engine";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
} from "../src/lib/communication/providers";
import { conversationRouter } from "../src/lib/communication/conversation-router";
import { db } from "@workspace/db";

describe("Stage 2: WhatsApp Push & Communication Policy Engine", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    vi.restoreAllMocks();
    const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mock.clearSentMessages();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. WhatsApp Push Notifications (Player Sold, Unsold, Re-Auction)
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Player Sold, Unsold, and Re-Auction WhatsApp Push Dispatch", () => {
    const licensedTournament = {
      id: 101,
      name: "Premier Cricket League 2026",
      licenseStatus: "active",
      adminLocked: false,
      scoringEnabled: true,
      scoringPhase: "active",
      auctionUnit: "rupee",
      licenseGrantedAt: new Date(),
    };

    it("dispatches Player Sold notification through active provider with exact copy", async () => {
      // Mock db query for tournament license lookup
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([licensedTournament]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const result = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Virat Kohli",
        teamName: "Royal Challengers",
        amount: 15000000,
        tournamentName: "Premier Cricket League 2026",
        auctionUnit: "rupee",
        whatsappConsent: true,
      });

      expect(result.success).toBe(true);
      expect(result.blocked).toBeUndefined();
      expect(mock.getSentMessages().length).toBe(1);

      const sent = mock.getSentMessages()[0];
      expect(sent.to).toBe("+919876543210");
      expect(sent.templateName).toBe("auction_player_sold");
      expect(sent.textBody).toContain("Congratulations, Virat Kohli!");
      expect(sent.textBody).toContain("SOLD");
      expect(sent.textBody).toContain("Royal Challengers");
      expect(sent.textBody).toContain("₹1,50,00,000");
      expect(sent.textBody).toContain("Premier Cricket League 2026");
    });

    it("blocks Player Unsold notification as permanently disabled", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([licensedTournament]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const result = await notifyPlayerUnsold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "Steve Smith",
        tournamentName: "Premier Cricket League 2026",
        auctionUnit: "rupee",
        whatsappConsent: true,
      });

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.error).toContain("disabled");
      expect(mock.getSentMessages().length).toBe(0);
    });

    it("blocks Player Re-Auction notification as permanently disabled", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([licensedTournament]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const result = await notifyPlayerReAuction({
        mobile: "+919876543210",
        tournamentId: 101,
        playerName: "David Warner",
        tournamentName: "Premier Cricket League 2026",
        auctionUnit: "rupee",
        whatsappConsent: true,
      });

      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.error).toContain("disabled");
      expect(mock.getSentMessages().length).toBe(0);
    });

    it("safely handles missing recipient mobile without sending or erroring", async () => {
      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const resSold = await notifyPlayerSold({
        mobile: null,
        tournamentId: 101,
        playerName: "Player",
        teamName: "Team",
        amount: 1000,
        tournamentName: "League",
      });
      expect(resSold.success).toBe(false);
      expect(resSold.blocked).toBe(true);
      expect(resSold.error).toContain("Missing recipient mobile");

      const resUnsold = await notifyPlayerUnsold({
        mobile: "",
        tournamentId: 101,
        playerName: "Player",
        tournamentName: "League",
      });
      expect(resUnsold.success).toBe(false);
      expect(resUnsold.blocked).toBe(true);

      expect(mock.getSentMessages().length).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Licensing and Emergency Lock Enforcement
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Licensing and Emergency Lock Enforcement", () => {
    it("blocks WhatsApp Push when tournament is unlicensed (e.g. trial or expired)", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "trial",
              adminLocked: false,
              scoringEnabled: false,
            },
          ]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const res = await notifyPlayerSold({
        mobile: "9876543210",
        tournamentId: 999,
        playerName: "Trial Player",
        teamName: "Trial Team",
        amount: 5000,
        tournamentName: "Trial League",
        whatsappConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Tournament licensing status 'trial' not eligible");
      expect(mock.getSentMessages().length).toBe(0);
    });

    it("blocks WhatsApp Push when tournament is emergency admin-locked", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "active",
              adminLocked: true, // Emergency lock active
              scoringEnabled: true,
            },
          ]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const res = await notifyPlayerSold({
        mobile: "9876543210",
        tournamentId: 101,
        playerName: "Locked Player",
        teamName: "Locked Team",
        amount: 5000,
        tournamentName: "Locked League",
        whatsappConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Tournament is admin-locked");
      expect(mock.getSentMessages().length).toBe(0);
    });

    it("allows match communications when auction is completed but sports scoring license is actively granted", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "completed",
              adminLocked: false,
              scoringEnabled: true,
              scoringPhase: "active",
              licenseGrantedAt: new Date(),
            },
          ]),
        }),
      } as any);

      const res = await dispatchPushWhatsApp({
        event: "match_score_update",
        tournamentId: 101,
        mobile: "9876543210",
        body: "Match 1: Over 5 completed",
        recipientConsent: true,
      });

      expect(res.success).toBe(true);
      expect(res.blocked).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Strict Elimination of WhatsApp-to-SMS Fallback
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Strict Elimination of Unintended SMS Fallback", () => {
    it("never calls sendSms when sendLicensedWhatsApp is blocked for an unlicensed tournament", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "unlicensed",
              adminLocked: false,
            },
          ]),
        }),
      } as any);

      const sendSmsSpy = vi.spyOn(commSender, "sendSms");
      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp");

      const res = await sendLicensedWhatsApp(888, "9876543210", "Test WhatsApp message");

      // Result must be blocked
      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Tournament not licensed");

      // CRITICAL ASSERTION: sendSms must NEVER be called as a substitute
      expect(sendSmsSpy).not.toHaveBeenCalled();
      expect(sendWhatsAppSpy).not.toHaveBeenCalled();
    });

    it("never calls sendSms when sendLicensedWhatsApp is blocked due to admin lock", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "active",
              adminLocked: true,
            },
          ]),
        }),
      } as any);

      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      const res = await sendLicensedWhatsApp(888, "9876543210", "Locked tournament message");

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("never calls sendSms when sendLicensedWhatsApp is invoked with missing tournament context", async () => {
      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      const res = await sendLicensedWhatsApp(null, "9876543210", "No tournament context");

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Missing tournament context");
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("never calls sendSms when WhatsApp push dispatch fails at provider level", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "active",
              adminLocked: false,
            },
          ]),
        }),
      } as any);

      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      // Active WhatsApp provider returns an error
      const mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
      vi.spyOn(mockProvider, "send").mockResolvedValueOnce({
        success: false,
        error: "Provider 500 Server Error",
        retryable: false,
      });

      const res = await sendLicensedWhatsApp(101, "9876543210", "Auction alert");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Provider 500 Server Error");
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Standalone SMS Workflows Untouched
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Standalone SMS Workflows Preserved", () => {
    it("standalone sendSms functions normally without dependency on WhatsApp", async () => {
      // In non-production, missing BulkSMS keys returns stub mode success
      delete process.env.BULKSMS_KEY;
      delete process.env.BULKSMS_PASSWORD;

      const smsResult = await sendSms("9876543210", "Standalone SMS OTP: 123456");

      expect(smsResult.success).toBe(true);
      expect(smsResult.stub).toBe(true);
      expect(smsResult.messageSid).toMatch(/^stub_sms_/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Recipient WhatsApp Consent Checks
  // ───────────────────────────────────────────────────────────────────────────
  describe("5. Recipient Consent Guard", () => {
    const licensedTournament = {
      licenseStatus: "active",
      adminLocked: false,
    };

    it("suppresses WhatsApp Push when recipient has not consented (whatsappConsent=false)", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([licensedTournament]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const res = await dispatchPushWhatsApp({
        event: "player_sold",
        tournamentId: 101,
        mobile: "9876543210",
        body: "Congratulations Player",
        recipientConsent: false, // Explicitly opted-out / no consent
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("not consented to WhatsApp updates");
      expect(mock.getSentMessages().length).toBe(0);
    });

    it("allows WhatsApp Push when recipient has given consent (whatsappConsent=true)", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([licensedTournament]),
        }),
      } as any);

      const mock = getWhatsAppProvider("mock") as MockWhatsAppProvider;

      const res = await dispatchPushWhatsApp({
        event: "player_sold",
        tournamentId: 101,
        mobile: "9876543210",
        body: "Congratulations Player",
        recipientConsent: true,
      });

      expect(res.success).toBe(true);
      expect(mock.getSentMessages().length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Push and Pull Logical Independence
  // ───────────────────────────────────────────────────────────────────────────
  describe("6. Push and Pull Logical Independence", () => {
    it("guarantees Pull bot commands continue to work even when Push notifications are suppressed or unlicensed", async () => {
      vi.spyOn(conversationRouter, "isMessageAlreadyProcessed").mockResolvedValue(false);
      vi.spyOn(conversationRouter, "recordProcessedInboundMessage").mockResolvedValue();
      vi.spyOn(conversationRouter, "resolveIdentity").mockResolvedValue({
        kind: "guest",
        mobile: "919876543210",
        displayName: "Guest User",
      });

      // Inbound HELP command from WhatsApp user
      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({
        success: true,
        messageSid: "wa_reply_123",
      });

      const inboundResult = await conversationRouter.processInboundMessage({
        from: "919876543210",
        channel: "whatsapp",
        text: "HELP",
        messageId: "inbound_msg_1",
      });

      expect(inboundResult.handled).toBe(true);
      // Inbound bot reply dispatches via sendWhatsApp
      expect(sendWhatsAppSpy).toHaveBeenCalled();
    });

    it("policyEngine confirms Pull bot independence", () => {
      expect(communicationPolicyEngine.isPullCommandIndependent()).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. No Cross-Provider Failover Invariant
  // ───────────────────────────────────────────────────────────────────────────
  describe("7. Provider Invariant & No Cross-Provider Fallback", () => {
    it("fails cleanly without attempting to invoke other providers when active provider returns error", async () => {
      process.env.WHATSAPP_PROVIDER = "twilio";
      process.env.TWILIO_ACCOUNT_SID = "AC_MOCK_ACCOUNT_SID_FOR_TESTS";
      process.env.TWILIO_AUTH_TOKEN = "secret_auth_token";
      process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";

      // Also set KV and Meta credentials in environment
      process.env.KV_META_ACCESS_TOKEN = "kv_secret";
      process.env.META_DIRECT_ACCESS_TOKEN = "meta_secret";

      // Mock fetch failing on Twilio call
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error_message: "Twilio HTTP 429 Too Many Requests" }), {
          status: 429,
        }),
      );

      const result = await sendWhatsApp("9876543210", "Test push dispatch");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Twilio HTTP 429");
      // Must NOT fail over to KV or Meta
      expect(resolveWhatsAppProvider()).toBe("twilio");
    });
  });
});
