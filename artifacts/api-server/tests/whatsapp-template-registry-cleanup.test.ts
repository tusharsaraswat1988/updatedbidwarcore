import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import commRouter, {
  CANONICAL_WA_TEMPLATES,
  ensureCanonicalTemplatesSeeded,
} from "../src/routes/comm";
import {
  BIDWAR_APPROVED_TEMPLATE_ALLOWLIST,
  VERIFIED_APPROVED_TEMPLATES,
  DEV_UNAPPROVED_TEMPLATES,
  isMetaApprovedTemplate,
  validateTemplateDispatchEligibility,
  getOperationalApprovedTemplates,
  getAllTemplatesForAdminAudit,
  resolvePlayerSoldImageUrl,
} from "../src/lib/communication/template-registry";
import {
  META_AUCTION_PLAYER_SOLD_TEMPLATE,
  META_AUCTION_PLAYER_SOLD_LANGUAGE,
  META_AUCTION_PLAYER_SOLD_CATEGORY,
} from "../src/lib/whatsapp";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
} from "../src/lib/communication/providers";
import {
  db,
  tournamentsTable,
  playersTable,
  teamsTable,
  waTemplatesTable,
  waConsentEventsTable,
  commLogsTable,
} from "@workspace/db";

describe("BIDWAR — WhatsApp Template Registry Cleanup & Approved-Only Admin UI", () => {
  const originalEnv = { ...process.env };
  let mockProvider: MockWhatsAppProvider;

  const licensedTournament = {
    id: 101,
    name: "Indian Premier League 2026",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "live",
    licenseGrantedAt: new Date(),
    featuresJson: { whatsappNotifications: true },
  };

  const app = express();
  app.use(express.json());
  // Mock JWT admin authentication with master admin level
  app.use((req, _res, next) => {
    (req as any).jwtUser = { id: 1, email: "admin@bidwar.in", isAdmin: true, role: "admin", adminLevel: "master" };
    next();
  });
  app.use(commRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "https://test.bidwar.in";
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Audit & Template Registry Truthfulness
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Audit & Template Registry Truthfulness", () => {
    it("allowlist contains ONLY 'auction_player_sold' as confirmed Meta-approved template", () => {
      expect(BIDWAR_APPROVED_TEMPLATE_ALLOWLIST.has("auction_player_sold")).toBe(true);
      expect(BIDWAR_APPROVED_TEMPLATE_ALLOWLIST.size).toBe(1);
    });

    it("isMetaApprovedTemplate returns true ONLY for canonical auction_player_sold", () => {
      expect(isMetaApprovedTemplate("auction_player_sold")).toBe(true);
      expect(isMetaApprovedTemplate("AUCTION_PLAYER_SOLD")).toBe(true);
      // Duplicate aliases, dev placeholders, unapproved templates, and custom messages are strictly false
      expect(isMetaApprovedTemplate("player_sold")).toBe(false);
      expect(isMetaApprovedTemplate("welcome_invite")).toBe(false);
      expect(isMetaApprovedTemplate("auction_reminder")).toBe(false);
      expect(isMetaApprovedTemplate("consent_optin")).toBe(false);
      expect(isMetaApprovedTemplate("credentials_share")).toBe(false);
      expect(isMetaApprovedTemplate("custom")).toBe(false);
      expect(isMetaApprovedTemplate("unknown_template")).toBe(false);
      expect(isMetaApprovedTemplate(null)).toBe(false);
      expect(isMetaApprovedTemplate(undefined)).toBe(false);
    });

    it("preserves exact Meta configuration for auction_player_sold", () => {
      const tpl = VERIFIED_APPROVED_TEMPLATES[META_AUCTION_PLAYER_SOLD_TEMPLATE];
      expect(tpl).toBeDefined();
      expect(tpl.metaTemplateName).toBe("auction_player_sold");
      expect(tpl.language).toBe(META_AUCTION_PLAYER_SOLD_LANGUAGE);
      expect(tpl.category).toBe(META_AUCTION_PLAYER_SOLD_CATEGORY);
      expect(tpl.headerType).toBe("image");
      expect(tpl.status).toBe("approved");
      expect(tpl.metaApproved).toBe(true);
      expect(tpl.isUsableInBidwar).toBe(true);

      // Exact body copy with 4 numbered variables
      expect(tpl.body).toBe(
        "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions"
      );

      // Exact variable mappings
      expect(tpl.variables).toEqual([
        { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
        { key: "2", label: "Winning Team", placeholder: "e.g. Royal Challengers" },
        { key: "3", label: "Sold Amount", placeholder: "e.g. ₹25,00,000" },
        { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      ]);
    });

    it("catalogs all dev placeholders in DEV_UNAPPROVED_TEMPLATES with explicit reasons", () => {
      const devKeys = Object.keys(DEV_UNAPPROVED_TEMPLATES);
      expect(devKeys).toContain("player_sold");
      expect(devKeys).toContain("welcome_invite");
      expect(devKeys).toContain("auction_reminder");
      expect(devKeys).toContain("consent_optin");
      expect(devKeys).toContain("credentials_share");

      for (const key of devKeys) {
        const item = DEV_UNAPPROVED_TEMPLATES[key];
        expect(item.metaApproved).toBe(false);
        expect(item.isUsableInBidwar).toBe(false);
        expect(item.reason).toBeDefined();
        expect(item.reason.length).toBeGreaterThan(10);
      }
    });

    it("indicates live sync unavailability truthfully without claiming live Graph API status", () => {
      const tpl = VERIFIED_APPROVED_TEMPLATES[META_AUCTION_PLAYER_SOLD_TEMPLATE];
      expect(tpl.liveSyncStatus).toBe("sync_unavailable");
      expect(tpl.liveSyncNote).toContain("Live Meta Graph API sync unavailable");
      expect(tpl.evidenceSource).toContain("Meta WhatsApp Business Manager");
      expect(tpl.evidenceTimestamp).toBe("2026-10-29T00:00:00Z");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Dispatch Eligibility Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Dispatch Eligibility Validation", () => {
    it("approves auction_player_sold for dispatch", () => {
      const res = validateTemplateDispatchEligibility("auction_player_sold");
      expect(res.eligible).toBe(true);
      expect(res.canonicalName).toBe("auction_player_sold");
    });

    it("rejects unapproved development placeholders with explicit error", () => {
      const unapprovedList = ["welcome_invite", "auction_reminder", "consent_optin", "credentials_share"];
      for (const tplName of unapprovedList) {
        const res = validateTemplateDispatchEligibility(tplName);
        expect(res.eligible).toBe(false);
        expect(res.error).toContain("is not approved by Meta");
      }
    });

    it("rejects 'custom' direct message with policy instruction", () => {
      const res = validateTemplateDispatchEligibility("custom");
      expect(res.eligible).toBe(false);
      expect(res.error).toContain("Custom direct WhatsApp messages are not permitted");
    });

    it("rejects empty or null template name", () => {
      const res = validateTemplateDispatchEligibility("");
      expect(res.eligible).toBe(false);
      expect(res.error).toContain("require a Meta-approved template");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Admin Templates Endpoint (GET /auth/admin/communicate/templates)
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Admin Templates Endpoint (GET /auth/admin/communicate/templates)", () => {
    it("returns ONLY Meta-approved templates when ?approved_only=true is requested", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === waTemplatesTable) {
            return {
              orderBy: vi.fn().mockResolvedValue([
                { id: 1, templateName: "auction_player_sold", status: "approved" },
                { id: 2, templateName: "player_sold", status: "duplicate" },
                { id: 3, templateName: "welcome_invite", status: "unapproved" },
                { id: 4, templateName: "auction_reminder", status: "unapproved" },
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

      const res = await request(app).get("/auth/admin/communicate/templates?approved_only=true");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Only auction_player_sold should be returned
      expect(res.body).toHaveLength(1);
      expect(res.body[0].templateName).toBe("auction_player_sold");
      expect(res.body[0].metaApproved).toBe(true);
      expect(res.body[0].isUsableInBidwar).toBe(true);
      expect(res.body[0].headerType).toBe("image");
      expect(res.body[0].category).toBe("utility");
      expect(res.body[0].language).toBe("en");
    });

    it("returns all templates for audit view, but marks dev placeholders as unapproved", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === waTemplatesTable) {
            return {
              orderBy: vi.fn().mockResolvedValue([
                { id: 1, templateName: "auction_player_sold", status: "approved" },
                { id: 2, templateName: "player_sold", status: "duplicate" },
                { id: 3, templateName: "welcome_invite", status: "unapproved" },
                { id: 4, templateName: "auction_reminder", status: "unapproved" },
                { id: 5, templateName: "consent_optin", status: "unapproved" },
                { id: 6, templateName: "credentials_share", status: "unapproved" },
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

      const approvedTemplates = res.body.filter((t: any) => t.metaApproved === true);
      expect(approvedTemplates).toHaveLength(1);
      expect(approvedTemplates[0].templateName).toBe("auction_player_sold");

      const devTemplates = res.body.filter((t: any) => t.metaApproved === false);
      expect(devTemplates.length).toBeGreaterThanOrEqual(4);

      // Verify each dev template has unapproved/duplicate status and exclusionReason
      const invite = res.body.find((t: any) => t.templateName === "welcome_invite");
      expect(invite).toBeDefined();
      expect(invite.status).toBe("unapproved");
      expect(invite.metaApproved).toBe(false);
      expect(invite.exclusionReason).toContain("Locally invented placeholder");

      const reminder = res.body.find((t: any) => t.templateName === "auction_reminder");
      expect(reminder).toBeDefined();
      expect(reminder.status).toBe("unapproved");
      expect(reminder.metaApproved).toBe(false);

      const alias = res.body.find((t: any) => t.templateName === "player_sold");
      expect(alias).toBeDefined();
      expect(alias.status).toBe("duplicate");
      expect(alias.exclusionReason).toContain("Duplicate alias");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Server-Side Dispatch Enforcement (POST /auth/admin/communicate/send)
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Server-Side Dispatch Enforcement (POST /auth/admin/communicate/send)", () => {
    it("strictly rejects unapproved template 'welcome_invite' with HTTP 400", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([
                { templateName: "welcome_invite", status: "unapproved" },
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
            "2": "24 Sep 2026, 6:00 PM",
            "3": "Live Arena",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Template "welcome_invite" is not approved');
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("strictly rejects unapproved template 'auction_reminder' with HTTP 400", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([
                { templateName: "auction_reminder", status: "unapproved" },
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
          templateVariables: {
            "1": "Premier League 2026",
            "2": "15",
            "3": "https://bidwar.in/live/742",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Template "auction_reminder" is not approved');
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("strictly rejects unknown template names with HTTP 400", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return { where: vi.fn().mockResolvedValue([licensedTournament]) };
          }
          if (table === waTemplatesTable) {
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
          templateName: "some_unregistered_promotional_template",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("is not approved");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("successfully dispatches canonical auction_player_sold with image header and 4 body variables", async () => {
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
          if (table === playersTable) {
            const res = [{ id: 1, tournamentId: 101, mobileNumber: "9876543210", whatsappConsent: true }];
            return {
              where: vi.fn().mockImplementation(() => ({
                limit: vi.fn().mockResolvedValue(res),
                then: (r: any) => Promise.resolve(res).then(r),
              })),
            };
          }
          if (table === waTemplatesTable) {
            return {
              where: vi.fn().mockResolvedValue([
                { templateName: "auction_player_sold", status: "approved" },
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
          templateName: "auction_player_sold",
          templateVariables: {
            "1": "Rohit Sharma",
            "2": "Mumbai Indians",
            "3": "₹16,00,000",
            "4": "IPL 2026",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sent).toBe(1);

      // Verify message reached mock provider with template metadata
      const sent = mockProvider.getSentMessages();
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("9876543210");
      expect(sent[0].type).toBe("template");
      expect(sent[0].templateName).toBe("auction_player_sold");
      expect(sent[0].templateLanguage).toBe("en");

      // Verify header and body components
      const components = sent[0].templateComponents;
      expect(components).toBeDefined();
      const headerComp = components?.find((c: any) => c.type === "header");
      expect(headerComp).toBeDefined();
      expect(headerComp?.parameters[0].type).toBe("image");
      expect(headerComp?.parameters[0].image.link).toBe(resolvePlayerSoldImageUrl());

      const bodyComp = components?.find((c: any) => c.type === "body");
      expect(bodyComp).toBeDefined();
      expect(bodyComp?.parameters).toHaveLength(4);
      expect(bodyComp?.parameters[0].text).toBe("Rohit Sharma");
      expect(bodyComp?.parameters[1].text).toBe("Mumbai Indians");
      expect(bodyComp?.parameters[2].text).toBe("₹16,00,000");
      expect(bodyComp?.parameters[3].text).toBe("IPL 2026");
    });
  });
});
