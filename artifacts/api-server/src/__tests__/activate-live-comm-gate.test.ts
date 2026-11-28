import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, tournamentsTable, playersTable, teamsTable, waConsentEventsTable, waTemplatesTable } from "@workspace/db";
import * as commSender from "../lib/comm-sender";
import {
  isTournamentOfficiallyActivatedForComm,
  isTournamentReadyForOutboundComm,
  sendLicensedWhatsApp,
} from "../lib/comm-sender";
import { communicationPolicyEngine } from "../lib/communication/policy-engine";
import {
  notifyPlayerSold,
  notifyTeamOwnerWelcome,
  notifyOrganiserOnboardingWelcome,
  autoDispatchPendingTeamOwnerWelcomes,
  clearPlayerSoldIdempotencyCache,
  clearTeamOwnerWelcomeIdempotencyCache,
  clearOrganiserWelcomeIdempotencyCache,
} from "../lib/whatsapp";
import { enqueuePlayerSoldEmail } from "../lib/communication/player-sold-email-service";
import { enqueueBadmintonMatchWinEmails } from "../lib/communication/badminton-match-win-email-service";
import { createJobFromBusinessEvent } from "../lib/communication/event-bridge";
import * as runtimeEnv from "../lib/runtime-env";
import { getWhatsAppProvider, MockWhatsAppProvider } from "../lib/communication/providers";
import commRouter from "../routes/comm";
import teamsRouter from "../routes/teams";

describe("Activate Live Communication Gate (officialActivatedAt)", () => {
  const originalEnv = { ...process.env };
  let mockProvider: MockWhatsAppProvider;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.WHATSAPP_PROVIDER = "mock";
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "https://bidwar.in";
    vi.restoreAllMocks();
    clearPlayerSoldIdempotencyCache();
    clearTeamOwnerWelcomeIdempotencyCache();
    clearOrganiserWelcomeIdempotencyCache();
    mockProvider = getWhatsAppProvider("mock") as MockWhatsAppProvider;
    mockProvider.clearSentMessages();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("1. Helper entitlement checks", () => {
    it("requires officialActivatedAt for outbound communication even when licenseStatus is active", () => {
      expect(
        isTournamentOfficiallyActivatedForComm({ officialActivatedAt: null }),
      ).toBe(false);
      expect(
        isTournamentOfficiallyActivatedForComm({ officialActivatedAt: new Date() }),
      ).toBe(true);

      // Licensed but NOT officially activated -> blocked
      expect(
        isTournamentReadyForOutboundComm({
          licenseStatus: "active",
          adminLocked: false,
          officialActivatedAt: null,
        }),
      ).toBe(false);

      // Officially activated AND licensed -> allowed
      expect(
        isTournamentReadyForOutboundComm({
          licenseStatus: "active",
          adminLocked: false,
          officialActivatedAt: new Date(),
        }),
      ).toBe(true);

      // Officially activated but emergency admin-locked -> blocked
      expect(
        isTournamentReadyForOutboundComm({
          licenseStatus: "active",
          adminLocked: true,
          officialActivatedAt: new Date(),
        }),
      ).toBe(false);
    });
  });

  describe("2. WhatsApp gating (sendLicensedWhatsApp, PolicyEngine, notifyPlayerSold, notifyTeamOwnerWelcome)", () => {
    it("blocks sendLicensedWhatsApp when licensed tournament has not clicked Activate Live", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              licenseStatus: "active",
              adminLocked: false,
              scoringEnabled: false,
              scoringPhase: null,
              licenseGrantedAt: new Date(),
              officialActivatedAt: null,
              featuresJson: null,
            },
          ]),
        }),
      } as any);

      const sendWhatsAppSpy = vi.spyOn(commSender, "sendWhatsApp");
      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      const res = await sendLicensedWhatsApp(101, "9876543210", "Player sold test");

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Activate Live");
      expect(sendWhatsAppSpy).not.toHaveBeenCalled();
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("blocks notifyPlayerSold when tournament is licensed (active) but officialActivatedAt is null", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([
                {
                  id: 101,
                  licenseStatus: "active",
                  adminLocked: false,
                  scoringEnabled: false,
                  scoringPhase: null,
                  licenseGrantedAt: new Date(),
                  officialActivatedAt: null,
                  auctionUnit: "rupee",
                  featuresJson: null,
                },
              ]),
            };
          }
          return {
            where: vi.fn().mockResolvedValue([]),
          };
        }),
      })) as any);

      const res = await notifyPlayerSold({
        mobile: "+919876543210",
        tournamentId: 101,
        playerId: 1,
        playerName: "Test Player",
        teamId: 1,
        teamName: "Test Team",
        amount: 50000,
        tournamentName: "Test League",
        whatsappConsent: true,
        headerImageUrl: "https://bidwar.in/assets/branding/player-sold-banner.jpg",
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Activate Live");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("blocks notifyTeamOwnerWelcome when tournament is licensed but officialActivatedAt is null", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([
                {
                  licenseStatus: "active",
                  adminLocked: false,
                  officialActivatedAt: null,
                },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await notifyTeamOwnerWelcome({
        mobile: "+919876543210",
        tournamentId: 101,
        teamId: 5,
        ownerName: "Owner",
        tournamentName: "Test League",
        whatsappConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.error).toContain("Activate Live");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("still allows account-level notifyOrganiserOnboardingWelcome when tournamentId is null", async () => {
      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      const res = await notifyOrganiserOnboardingWelcome({
        mobile: "+919876543210",
        organizerId: 10,
        name: "Organizer",
        whatsappConsent: true,
      });

      expect(res.success).toBe(true);
      expect(mockProvider.getSentMessages()).toHaveLength(1);
    });

    it("autoDispatchPendingTeamOwnerWelcomes returns 0 dispatched when officialActivatedAt is null", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([
                {
                  licenseStatus: "active",
                  adminLocked: false,
                  officialActivatedAt: null,
                },
              ]),
            };
          }
          throw new Error("Should not query teams when tournament is not officially activated");
        }),
      })) as any);

      const res = await autoDispatchPendingTeamOwnerWelcomes(101, "Test League");
      expect(res).toEqual({ dispatched: 0, skipped: 0 });
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });

  describe("3. Email gating (Player Sold, Badminton Match Win, Event Bridge)", () => {
    it("skips enqueuePlayerSoldEmail without creating pending or queued jobs when officialActivatedAt is null", async () => {
      const insertSpy = vi.spyOn(db, "insert");
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    licenseStatus: "active",
                    status: "active",
                    adminLocked: false,
                    officialActivatedAt: null,
                  },
                ]),
              }),
            };
          }
          throw new Error("Should not query players when Activate Live is not completed");
        }),
      })) as any);

      await enqueuePlayerSoldEmail({
        playerId: 1,
        teamId: 2,
        amount: 10000,
        tournamentId: 101,
      });

      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("skips enqueueBadmintonMatchWinEmails when officialActivatedAt is null", async () => {
      const insertSpy = vi.spyOn(db, "insert");
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    name: "Badminton Open",
                    organizerName: "Org",
                    organizerEmail: "org@example.com",
                    organizerId: 1,
                    officialActivatedAt: null,
                    adminLocked: false,
                  },
                ]),
              }),
            };
          }
          throw new Error("Should not query players/fixtures when Activate Live is not completed");
        }),
      })) as any);

      await enqueueBadmintonMatchWinEmails({
        matchId: 55,
        tournamentId: 101,
        state: {
          winnerSide: "left",
          leftSide: { label: "Player A", players: [] },
          rightSide: { label: "Player B", players: [] },
          games: [],
          gamesLeft: 2,
          gamesRight: 0,
          matchStatus: "completed",
        } as any,
      });

      expect(insertSpy).not.toHaveBeenCalled();
    });

    it("createJobFromBusinessEvent skips TEAM_OWNER_REGISTERED when officialActivatedAt is null", async () => {
      vi.spyOn(runtimeEnv, "getPublicOrigin").mockReturnValue("https://bidwar.in");
      vi.spyOn(runtimeEnv, "buildPublicUrl").mockImplementation((p: string) => `https://bidwar.in${p}`);
      const insertSpy = vi.spyOn(db, "insert");
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    officialActivatedAt: null,
                    adminLocked: false,
                  },
                ]),
              }),
            };
          }
          return {
            limit: vi.fn().mockResolvedValue([]),
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "tpl-1", internalKey: "welcome_team_owner" }]),
            }),
          };
        }),
      })) as any);

      const jobId = await createJobFromBusinessEvent("TEAM_OWNER_REGISTERED", {
        teamId: 10,
        teamName: "Warriors",
        ownerName: "Owner",
        email: "owner@example.com",
        ownerPhotoUrl: null,
        tournamentId: 101,
        tournamentName: "Test League",
        tournamentLogoUrl: null,
      });

      expect(jobId).toBeNull();
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe("4. Route-level gating (comm.ts & teams.ts)", () => {
    function createAdminCommApp() {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        (req as any).jwtUser = {
          id: "admin_1",
          isAdmin: true,
          adminLevel: "master",
          email: "master@bidwar.com",
          organizerAccountId: 10,
        };
        next();
      });
      app.use(commRouter);
      app.use(teamsRouter);
      return app;
    }

    it("blocks POST /auth/admin/communicate/send for SMS and WhatsApp when licensed but officialActivatedAt is null", async () => {
      const app = createAdminCommApp();
      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([
                {
                  id: 101,
                  name: "Licensed Unactivated League",
                  licenseStatus: "active",
                  adminLocked: false,
                  scoringEnabled: false,
                  scoringPhase: null,
                  licenseGrantedAt: new Date(),
                  officialActivatedAt: null,
                  featuresJson: null,
                  auctionUnit: "rupee",
                },
              ]),
            };
          }
          if (table === waTemplatesTable) {
            const res = [{ templateName: "auction_player_sold", status: "approved" }];
            return {
              where: vi.fn().mockResolvedValue(res),
              orderBy: vi.fn().mockResolvedValue(res),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      // SMS channel
      const smsRes = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "sms",
          tournamentId: 101,
          recipientGroup: "manual",
          manualMobiles: ["9876543210"],
          templateName: "custom",
          messageContent: "Test SMS",
        });
      expect(smsRes.status).toBe(403);
      expect(smsRes.body.error).toContain("Activate Live");
      expect(sendSmsSpy).not.toHaveBeenCalled();

      // WhatsApp channel
      const waRes = await request(app)
        .post("/auth/admin/communicate/send")
        .send({
          channel: "whatsapp",
          tournamentId: 101,
          recipientGroup: "manual",
          manualMobiles: ["9876543210"],
          templateName: "custom",
          messageContent: "Test WhatsApp",
        });
      expect(waRes.status).toBe(403);
      expect(waRes.body.error).toContain("Activate Live");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });

    it("blocks POST /consent/generate when officialActivatedAt is null", async () => {
      const app = createAdminCommApp();
      const sendSmsSpy = vi.spyOn(commSender, "sendSms");

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([
                {
                  name: "Licensed Unactivated League",
                  officialActivatedAt: null,
                  adminLocked: false,
                },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/consent/generate")
        .send({
          recipientType: "player",
          recipientId: 1,
          mobile: "9876543210",
          tournamentId: 101,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Activate Live");
      expect(sendSmsSpy).not.toHaveBeenCalled();
    });

    it("blocks POST /tournaments/:tournamentId/teams/:teamId/send-welcome-whatsapp when officialActivatedAt is null", async () => {
      const app = createAdminCommApp();

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: vi.fn().mockImplementation((table: any) => {
          if (table === tournamentsTable) {
            return {
              where: vi.fn().mockResolvedValue([
                {
                  id: 101,
                  name: "Licensed Unactivated League",
                  licenseStatus: "active",
                  officialActivatedAt: null,
                  adminLocked: false,
                },
              ]),
            };
          }
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      })) as any);

      const res = await request(app)
        .post("/tournaments/101/teams/5/send-welcome-whatsapp")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Activate Live");
      expect(mockProvider.getSentMessages()).toHaveLength(0);
    });
  });

  describe("5. Call-site verification for auction, teams, push, scheduler, and worker", () => {
    it("verifies all operational dispatch paths enforce officialActivatedAt", async () => {
      const [auctionSrc, teamsSrc, pushSrc, schedulerSrc, workerSrc, tournamentsSrc] = await Promise.all([
        readFile(path.resolve(__dirname, "../routes/auction.ts"), "utf8"),
        readFile(path.resolve(__dirname, "../routes/teams.ts"), "utf8"),
        readFile(path.resolve(__dirname, "../routes/push.ts"), "utf8"),
        readFile(path.resolve(__dirname, "../lib/scheduler.ts"), "utf8"),
        readFile(path.resolve(__dirname, "../lib/communication/worker.ts"), "utf8"),
        readFile(path.resolve(__dirname, "../routes/tournaments.ts"), "utf8"),
      ]);

      expect(auctionSrc).toContain("if (tournament?.officialActivatedAt)");
      expect(auctionSrc).toContain("if (manualTournament?.officialActivatedAt)");
      expect(teamsSrc).toContain("Boolean(tournament.officialActivatedAt)");
      expect(pushSrc).toContain("officialActivatedAt: tournamentsTable.officialActivatedAt");
      expect(schedulerSrc).toContain("isNotNull(tournamentsTable.officialActivatedAt)");
      expect(workerSrc).toContain("official_activated_at");
      expect(tournamentsSrc).toContain("Boolean(tournament.officialActivatedAt)");
    });
  });
});
