import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter, {
  validateAndNormalizeMobile,
  interpolateTemplateVariables,
  CANONICAL_WA_TEMPLATES,
  ensureCanonicalTemplatesSeeded,
} from "../src/routes/comm";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  playersTable,
  teamsTable,
  waTemplatesTable,
  waConsentEventsTable,
  commLogsTable,
  smsNotificationSettingsTable,
} from "@workspace/db";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
} from "../src/lib/communication/providers";
import * as commSender from "../src/lib/comm-sender";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    (req as any).cookies = { bidwar_auth: "mock_admin_token" };
    (req as any).jwtUser = {
      isAdmin: true,
      role: "admin",
      adminLevel: "master",
      email: "master@bidwar.com",
      organizerAccountId: 10,
    };
    next();
  });
  app.use(commRouter);
  return app;
}

describe("Phase 1: WhatsApp Admin P0 Fixes & Verification", () => {
  const originalEnv = { ...process.env };
  const app = createTestApp();
  let mockProvider: MockWhatsAppProvider;

  const licensedTournament = {
    id: 101,
    name: "Premier League 2026",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
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

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    vi.restoreAllMocks();
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();

    // Default DB mock for tests that do not define custom overrides
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
            { templateName: "welcome_invite", status: "approved" },
            { templateName: "player_sold", status: "approved" },
            { templateName: "auction_reminder", status: "approved" },
            { templateName: "consent_optin", status: "approved" },
            { templateName: "credentials_share", status: "approved" },
          ];
          return {
            where: vi.fn().mockResolvedValue(res),
            orderBy: vi.fn().mockResolvedValue(res),
            then: (resolve: any) => Promise.resolve(res).then(resolve),
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
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Helper Unit Tests: Mobile Validation & Normalization
  // ───────────────────────────────────────────────────────────────────────────
  describe("A. Server-Side Mobile Validation & Normalization Helper", () => {
    it("normalizes clean 10-digit Indian numbers", () => {
      const res = validateAndNormalizeMobile("9876543210");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("9876543210");
    });

    it("normalizes 11-digit numbers with leading 0 to 10 digits", () => {
      const res = validateAndNormalizeMobile("09876543210");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("9876543210");
    });

    it("normalizes 12-digit numbers with +91 or 91 prefix to 10 digits", () => {
      const res1 = validateAndNormalizeMobile("+919876543210");
      expect(res1.valid).toBe(true);
      expect(res1.normalized).toBe("9876543210");

      const res2 = validateAndNormalizeMobile("919876543210");
      expect(res2.valid).toBe(true);
      expect(res2.normalized).toBe("9876543210");

      const res3 = validateAndNormalizeMobile("+91 98765 43210");
      expect(res3.valid).toBe(true);
      expect(res3.normalized).toBe("9876543210");
    });

    it("accepts valid international numbers up to 15 digits", () => {
      const res = validateAndNormalizeMobile("+14155552671");
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe("14155552671");
    });

    it("rejects numbers with invalid characters", () => {
      const res = validateAndNormalizeMobile("98765abc10");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("contains invalid characters");
    });

    it("rejects numbers with fewer than 10 digits", () => {
      const res = validateAndNormalizeMobile("987654");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("too few digits");
    });

    it("rejects numbers exceeding 15 digits", () => {
      const res = validateAndNormalizeMobile("12345678901234567");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds maximum allowed length");
    });

    it("rejects empty or whitespace-only values", () => {
      const res1 = validateAndNormalizeMobile("");
      expect(res1.valid).toBe(false);
      const res2 = validateAndNormalizeMobile("   ");
      expect(res2.valid).toBe(false);
      const res3 = validateAndNormalizeMobile(null);
      expect(res3.valid).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Helper Unit Tests: Template Interpolation
  // ───────────────────────────────────────────────────────────────────────────
  describe("B. Template Variable Interpolation Helper", () => {
    it("replaces numeric placeholders {{1}}, {{2}} correctly", () => {
      const tpl = "Hello {{1}}, welcome to {{2}}!";
      const rendered = interpolateTemplateVariables(tpl, {
        "1": "Rohit Sharma",
        "2": "Premier League",
      });
      expect(rendered).toBe("Hello Rohit Sharma, welcome to Premier League!");
    });

    it("leaves unspecified placeholders untouched", () => {
      const tpl = "Hello {{1}}, code is {{2}}.";
      const rendered = interpolateTemplateVariables(tpl, { "1": "Rohit" });
      expect(rendered).toBe("Hello Rohit, code is {{2}}.");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0 Item 1: Custom / Manual Recipient Payload Mismatch & Reconciled Schema
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Custom / Manual Recipient Payload Reconciliation (P0 Fix 1)", () => {
    it("accepts recipientGroup: 'custom' with customMobile and dispatches via active provider", async () => {
      // Mock tournament license query
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
            return {
              where: vi.fn().mockResolvedValue([
                { templateName: "welcome_invite", status: "approved" },
              ]),
              orderBy: vi.fn().mockResolvedValue([
                { templateName: "welcome_invite", status: "approved" },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "+919876543210",
          templateName: "welcome_invite",
          templateVariables: {
            "1": "Premier League 2026",
            "2": "24 Sep 2026, 6:00 PM",
            "3": "Live Arena",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sent).toBe(1);
      expect(res.body.results[0].mobile).toBe("9876543210");
      expect(res.body.results[0].channel).toBe("whatsapp");
      expect(res.body.results[0].success).toBe(true);

      // Verify message reached mock provider
      const sent = mockProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("9876543210");
      expect(sent[0].textBody).toContain("Welcome to BidWar Auction!");
    });

    it("accepts recipientGroup: 'manual' with manualMobiles array (backward compatibility)", async () => {
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
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "manual",
          manualMobiles: ["9876543210"],
          templateName: "custom",
          messageContent: "Manual broadcast message content",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sent).toBe(1);
      expect(res.body.results[0].mobile).toBe("9876543210");
    });

    it("rejects malformed custom recipient phone number safely with HTTP 400", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "12345", // too short
          templateName: "custom",
          messageContent: "Test message",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("too few digits");
    });

    it("rejects phone numbers with invalid alphabetic characters safely with HTTP 400", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "98765abc10",
          templateName: "custom",
          messageContent: "Test message",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("contains invalid characters");
    });

    it("rejects custom dispatch when no mobile number is provided", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          templateName: "custom",
          messageContent: "Test message",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("At least one recipient mobile number is required");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0 Item 2: Approved WhatsApp Template Dispatch & Variable Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Approved WhatsApp Template Dispatch & Authoritative Validation (P0 Fix 2)", () => {
    it("returns authoritative template list from GET /auth/admin/communicate/templates", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === waTemplatesTable) {
            return {
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: 1,
                  templateName: "welcome_invite",
                  templateSid: "HX123",
                  category: "utility",
                  description: "Invitation",
                  status: "approved",
                },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app).get("/auth/admin/communicate/templates");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const invite = res.body.find((t: any) => t.templateName === "welcome_invite");
      expect(invite).toBeDefined();
      expect(invite.variables).toHaveLength(3);
      expect(invite.title).toContain("Welcome & Tournament Invite");
    });

    it("successfully dispatches approved template without requiring manual message body", async () => {
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
            return {
              where: vi.fn().mockResolvedValue([
                { templateName: "auction_reminder", status: "approved" },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "auction_reminder",
          // Notice: messageContent is NOT supplied!
          templateVariables: {
            "1": "Premier League 2026",
            "2": "15",
            "3": "https://bidwar.in/live/742",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const sent = mockProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      expect(sent[0].textBody).toContain("Live Auction Starting Soon!");
      expect(sent[0].textBody).toContain("15 minutes");
      expect(sent[0].textBody).toContain("https://bidwar.in/live/742");
    });

    it("rejects approved template when required dynamic variables are missing", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([
                { templateName: "welcome_invite", status: "approved" },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "welcome_invite",
          templateVariables: {
            "1": "Premier League 2026",
            // missing "2" and "3"!
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing required template variable(s)");
    });

    it("strictly rejects unapproved template name supplied by client with HTTP 400", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waTemplatesTable) {
            // Returns empty -> template not in database!
            return { where: vi.fn().mockResolvedValue([]) };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "malicious_unapproved_promo_blast",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Template "malicious_unapproved_promo_blast" is not approved');
    });

    it("requires messageContent when template is 'custom'", async () => {
      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "custom",
          messageContent: "   ", // empty!
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Message content is required");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // P0 Item 3: SMS Fallback Removal & Licensing/Consent Verification
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. SMS Fallback Removal & Policy Gate Enforcement (P0 Fix 3)", () => {
    it("strictly blocks WhatsApp with 403 when tournament is unlicensed and NEVER sends SMS", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([unlicensedTournament]) };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const smsSpy = vi.spyOn(commSender, "sendSms");

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 102,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "custom",
          messageContent: "Announcement for trial tournament",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("WhatsApp messaging requires a live license and unlocked tournament");
      // Critical check: Zero SMS sends occurred!
      expect(smsSpy).not.toHaveBeenCalled();
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("strictly blocks WhatsApp with 403 when emergency admin lock is active", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([adminLockedTournament]) };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const smsSpy = vi.spyOn(commSender, "sendSms");

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 103,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "custom",
          messageContent: "Emergency announcement",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("WhatsApp messaging requires a live license and unlocked tournament");
      expect(smsSpy).not.toHaveBeenCalled();
    });

    it("fails WhatsApp dispatch when recipient revoked consent via STOP and NEVER falls back to SMS", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
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

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const smsSpy = vi.spyOn(commSender, "sendSms");

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "custom",
          messageContent: "Message to opted-out recipient",
        });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(0);
      expect(res.body.failed).toBe(1);
      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[0].error).toContain("STOP");

      // Critical check: Zero WhatsApp sends, zero SMS fallback!
      expect(mockProvider.getSentMessages()).toHaveLength(0);
      expect(smsSpy).not.toHaveBeenCalled();
    });

    it("when channel is 'both', sends SMS normally but skips WhatsApp for non-consented recipient", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
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

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      const smsSpy = vi.spyOn(commSender, "sendSms").mockResolvedValue({
        success: true,
        messageSid: "sms_mock_123",
      });

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "both",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "custom",
          messageContent: "Multi-channel announcement",
        });

      expect(res.status).toBe(200);
      // WhatsApp failed due to opt-out
      const waResult = res.body.results.find((r: any) => r.channel === "whatsapp");
      expect(waResult?.success).toBe(false);
      expect(waResult?.error).toContain("STOP");

      // SMS succeeded because channel was explicitly 'both'
      const smsResult = res.body.results.find((r: any) => r.channel === "sms");
      expect(smsResult?.success).toBe(true);
      expect(smsSpy).toHaveBeenCalledWith("9876543210", "Multi-channel announcement");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Provider Failure Handling
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Provider Error Handling & Safe Reporting", () => {
    it("handles provider dispatch failure gracefully without crashing and reports failure in results", async () => {
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
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      // Force mock provider to fail
      vi.spyOn(mockProvider, "send").mockResolvedValueOnce({
        success: false,
        error: "Gateway timeout: upstream WhatsApp provider unresponsive",
        retryable: true,
      });

      const res = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "custom",
          customMobile: "9876543210",
          templateName: "custom",
          messageContent: "Test message causing gateway timeout",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sent).toBe(0);
      expect(res.body.failed).toBe(1);
      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[0].error).toContain("upstream WhatsApp provider unresponsive");
    });
  });
});
