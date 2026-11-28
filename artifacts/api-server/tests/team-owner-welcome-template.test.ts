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
    officialActivatedAt: new Date(),
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

  it("exempts registered team owners from strict marketing opt-in for team_owner_welcome_login utility template", async () => {
    const registeredTeam = {
      id: 5,
      tournamentId: 101,
      name: "Super Kings",
      ownerName: "Dhoni",
      ownerMobile: "+919876543299",
      whatsappConsent: false, // not opted into marketing
    };

    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([licensedTournament])),
            };
          }
          if (table === teamsTable || table?._?.name === "teams") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([registeredTeam])),
            };
          }
          if (table === waConsentEventsTable || table?._?.name === "wa_consent_events") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([])), // not revoked
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
      mobile: "+919876543299",
      tournamentId: 101,
      teamId: 5,
      ownerName: "Dhoni",
      tournamentName: "Bidwar Premier League",
      whatsappConsent: false,
    });

    expect(res.success).toBe(true);
    expect(mockProvider.getSentMessages().length).toBe(1);
    expect(mockProvider.getSentMessages()[0].to).toBe("+919876543299");
    expect(mockProvider.getSentMessages()[0].templateName).toBe("team_owner_welcome_login");
  });

  it("still blocks team_owner_welcome_login if recipient has revoked consent via STOP / declined", async () => {
    const registeredTeam = {
      id: 6,
      tournamentId: 101,
      name: "Knight Riders",
      ownerName: "Shahrukh",
      ownerMobile: "+919876543288",
      whatsappConsent: true,
    };

    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([licensedTournament])),
            };
          }
          if (table === teamsTable || table?._?.name === "teams") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([registeredTeam])),
            };
          }
          if (table === waConsentEventsTable || table?._?.name === "wa_consent_events") {
            return {
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(Promise.resolve([{ eventType: "STOP_REVOKED" }])),
                }),
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
      mobile: "+919876543288",
      tournamentId: 101,
      teamId: 6,
      ownerName: "Shahrukh",
      tournamentName: "Bidwar Premier League",
      whatsappConsent: false,
    });

    expect(res.success).toBe(false);
    expect(res.blocked).toBe(true);
    expect(res.error).toContain("STOP");
    expect(mockProvider.getSentMessages().length).toBe(0);
  });

  it("exempts registered team owner when ownerMobile in DB is formatted as 10 digits without country code", async () => {
    const registeredTeam10 = {
      id: 7,
      tournamentId: 101,
      name: "Delhi Capitals",
      ownerName: "Pant",
      ownerMobile: "9876543277", // 10 digits stored
      whatsappConsent: false,
    };

    vi.spyOn(db, "select").mockImplementation((() => {
      const builder: any = {
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable || table?._?.name === "tournaments") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([licensedTournament])),
            };
          }
          if (table === teamsTable || table?._?.name === "teams") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([registeredTeam10])),
            };
          }
          if (table === waConsentEventsTable || table?._?.name === "wa_consent_events") {
            return {
              where: vi.fn().mockReturnValue(Promise.resolve([])), // not revoked
            };
          }
          return {
            where: vi.fn().mockReturnValue(Promise.resolve([])),
          };
        }),
      };
      return builder;
    }) as any);

    // Call with E.164 +919876543277
    const res = await notifyTeamOwnerWelcome({
      mobile: "+919876543277",
      tournamentId: 101,
      teamId: 7,
      ownerName: "Pant",
      tournamentName: "Bidwar Premier League",
      whatsappConsent: false,
    });

    expect(res.success).toBe(true);
    expect(mockProvider.getSentMessages().length).toBe(1);
    expect(mockProvider.getSentMessages()[0].to).toBe("+919876543277");
  });

  it("records inbound message in comm_logs with direction 'inbound' and associated tournamentId", async () => {
    let insertedRow: any = null;
    vi.spyOn(db, "insert").mockImplementation(((table: any) => {
      return {
        values: vi.fn().mockImplementation((values: any) => {
          insertedRow = values;
          return Promise.resolve();
        }),
      } as any;
    }));

    const { conversationRouter } = await import("../src/lib/communication/conversation-router");
    await conversationRouter.recordProcessedInboundMessage(
      "wamid.test_inbound_123",
      "919876543210",
      "whatsapp",
      "hello",
      101,
    );

    expect(insertedRow).toBeDefined();
    expect(insertedRow.direction).toBe("inbound");
    expect(insertedRow.tournamentId).toBe(101);
    expect(insertedRow.blastId).toBe("inbound_wamid.test_inbound_123");
    expect(insertedRow.metaMessageId).toBe("wamid.test_inbound_123");
    expect(insertedRow.deliveryStatus).toBe("delivered");
  });
});
