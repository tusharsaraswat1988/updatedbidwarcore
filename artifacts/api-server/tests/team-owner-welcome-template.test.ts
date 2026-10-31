import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  notifyTeamOwnerWelcome,
  autoDispatchPendingTeamOwnerWelcomes,
  clearTeamOwnerWelcomeIdempotencyCache,
  META_TEAM_OWNER_WELCOME_TEMPLATE,
} from "../src/lib/whatsapp";
import {
  VERIFIED_APPROVED_TEMPLATES,
  BIDWAR_APPROVED_TEMPLATE_ALLOWLIST,
  validateTemplateDispatchEligibility,
  normalizeTemplateKey,
} from "../src/lib/communication/template-registry";
import {
  db,
  tournamentsTable,
  teamsTable,
  commLogsTable,
  waConsentEventsTable,
} from "@workspace/db";
import {
  getWhatsAppProvider,
  MockWhatsAppProvider,
} from "../src/lib/communication/providers";

describe("Team Owner Welcome WhatsApp Template & Auto-Dispatch", () => {
  const originalEnv = { ...process.env };
  let mockProvider: MockWhatsAppProvider;

  const licensedTournament = {
    id: 101,
    name: "Bidwar Premier League",
    licenseStatus: "active",
    adminLocked: false,
    scoringEnabled: true,
    scoringPhase: "active",
    licenseGrantedAt: new Date(),
  };

  const trialTournament = {
    id: 102,
    name: "Trial Cricket League",
    licenseStatus: "trial",
    adminLocked: false,
    scoringEnabled: false,
    scoringPhase: "setup",
    licenseGrantedAt: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WHATSAPP_PROVIDER = "mock";
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();
    clearTeamOwnerWelcomeIdempotencyCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("verifies team_owner_welcome_login is Meta-approved and on the BIDWAR allowlist", () => {
    expect(BIDWAR_APPROVED_TEMPLATE_ALLOWLIST.has("team_owner_welcome_login")).toBe(true);

    const tpl = VERIFIED_APPROVED_TEMPLATES["team_owner_welcome_login"];
    expect(tpl).toBeDefined();
    expect(tpl.status).toBe("approved");
    expect(tpl.category).toBe("utility");
    expect(tpl.metaApproved).toBe(true);
    expect(tpl.isUsableInBidwar).toBe(true);

    const eligibility = validateTemplateDispatchEligibility("team_owner_welcome_login");
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.canonicalName).toBe("team_owner_welcome_login");

    expect(normalizeTemplateKey("team_owner_welcome")).toBe("team_owner_welcome_login");
    expect(normalizeTemplateKey("welcome_team_owner")).toBe("team_owner_welcome_login");
  });

  it("dispatches notifyTeamOwnerWelcome with exact copy and components in live mode", async () => {
    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([licensedTournament])),
            };
          }
          if (table === waConsentEventsTable || table?._?.name === "wa_consent_events") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([])),
            };
          }
          if (table === commLogsTable || table?._?.name === "comm_logs") {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(Promise.resolve([])),
              }),
            };
          }
          return {
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          };
        }),
      };
      return builder;
    }) as any);

    const res = await notifyTeamOwnerWelcome({
      mobile: "+919876543210",
      tournamentId: 101,
      teamId: 1,
      ownerName: "Tushar",
      tournamentName: "Bidwar Premier League",
      whatsappConsent: true,
    });

    expect(res.success).toBe(true);
    const sent = mockProvider.getSentMessages();
    expect(sent.length).toBe(1);

    const msg = sent[0];
    expect(msg.to).toBe("+919876543210");
    expect(msg.templateName).toBe("team_owner_welcome_login");
    expect(msg.textBody).toContain("🏏 Welcome to BIDWAR, Tushar!");
    expect(msg.textBody).toContain("You have been successfully registered as a Team Owner for Bidwar Premier League.");
    expect(msg.textBody).toContain("Your login details will be shared with you before the auction starts.");
    expect(msg.textBody).toContain("Stay tuned, and get ready for an exciting tournament!");
    expect(msg.textBody).toContain("Best Wishes !");

    // Check template components
    const bodyComp = msg.templateComponents?.find((c: any) => c.type === "body");
    expect(bodyComp).toBeDefined();
    expect(bodyComp.parameters).toEqual([
      { type: "text", text: "Tushar" },
      { type: "text", text: "Bidwar Premier League" },
    ]);
  });

  it("blocks dispatch when tournament is in trial mode (live mode only)", async () => {
    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([trialTournament])),
            };
          }
          return {
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          };
        }),
      };
      return builder;
    }) as any);

    const res = await notifyTeamOwnerWelcome({
      mobile: "+919876543210",
      tournamentId: 102,
      teamId: 2,
      ownerName: "Tushar",
      tournamentName: "Trial Cricket League",
      whatsappConsent: true,
    });

    expect(res.success).toBe(false);
    expect(res.blocked).toBe(true);
    expect(res.error).toContain("Tournament licensing status 'trial' not eligible for communications");
    expect(mockProvider.getSentMessages().length).toBe(0);
  });

  it("blocks dispatch when recipient has not consented to WhatsApp updates", async () => {
    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([licensedTournament])),
            };
          }
          return {
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          };
        }),
      };
      return builder;
    }) as any);

    const res = await notifyTeamOwnerWelcome({
      mobile: "+919876543210",
      tournamentId: 101,
      teamId: 1,
      ownerName: "Tushar",
      tournamentName: "Bidwar Premier League",
      whatsappConsent: false,
    });

    expect(res.success).toBe(false);
    expect(res.blocked).toBe(true);
    expect(res.error).toContain("Recipient has not consented to WhatsApp updates");
    expect(mockProvider.getSentMessages().length).toBe(0);
  });

  it("autoDispatchPendingTeamOwnerWelcomes dispatches to consented teams and skips unconsented or already sent", async () => {
    const teamsInTournament = [
      { id: 1, name: "Team One", ownerName: "Owner 1", ownerMobile: "+919876543211", whatsappConsent: true },
      { id: 2, name: "Team Two", ownerName: "Owner 2", ownerMobile: "+919876543212", whatsappConsent: true }, // already sent
      { id: 3, name: "Team Three", ownerName: "Owner 3", ownerMobile: "+919876543213", whatsappConsent: false }, // no consent
    ];

    vi.spyOn(db, "select").mockImplementation(((fields: any) => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === teamsTable || table?._?.name === "teams") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve(teamsInTournament.filter(t => t.whatsappConsent))),
            };
          }
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([licensedTournament])),
            };
          }
          if (table === commLogsTable || table?._?.name === "comm_logs") {
            return {
              where: vi.fn().mockImplementation(() => ({
                limit: vi.fn().mockImplementation(() => {
                  // Team 2 is already sent
                  return Promise.resolve([{ id: 999 }]);
                }),
              })),
            };
          }
          return {
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          };
        }),
      };
      return builder;
    }) as any);

    // Now mock commLogsTable specifically for team 1 (not sent) and team 2 (sent)
    let callCount = 0;
    vi.spyOn(db, "select").mockImplementation(((fields: any) => {
      return {
        from: (table: any) => {
          if (table === teamsTable || table?._?.name === "teams") {
            return {
              where: () => Promise.resolve([teamsInTournament[0], teamsInTournament[1]]),
            };
          }
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: () => Promise.resolve([licensedTournament]),
            };
          }
          if (table === commLogsTable || table?._?.name === "comm_logs") {
            return {
              where: () => ({
                limit: () => {
                  callCount++;
                  // First call is team 1 (not sent: return empty)
                  // Second call is team 2 (already sent: return row)
                  if (callCount === 1) return Promise.resolve([]);
                  return Promise.resolve([{ id: 999 }]);
                },
              }),
            };
          }
          return {
            where: () => Promise.resolve([]),
          };
        },
      } as any;
    }));

    const result = await autoDispatchPendingTeamOwnerWelcomes(101, "Bidwar Premier League");

    expect(result.dispatched).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockProvider.getSentMessages().length).toBe(1);
    expect(mockProvider.getSentMessages()[0].to).toBe("+919876543211");
  });
});
