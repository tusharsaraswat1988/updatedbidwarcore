import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConversationRouter } from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";
import { db } from "@workspace/db";
import {
  guestAssistantService,
  sessionManager,
  operationalDataService,
  entityResolutionService,
  type AssistantUserContext,
} from "../src/lib/communication/ai-assistant";

describe("BIDWAR WhatsApp Gemini Assistant — Universal Tournament Intelligence & Platform Knowledge", () => {
  const router = new ConversationRouter();
  const ORGANIZER_MOBILE = "919876500010";
  const TEAM_OWNER_MOBILE = "919876500020";
  const PLAYER_MOBILE = "919876500030";
  const TRIAL_MOBILE = "919876500040";
  const GUEST_MOBILE = "919876500050";

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = "mock-gemini-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.AI_ASSISTANT_ENABLED = "true";
    process.env.WHATSAPP_PROVIDER = "mock";
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();

    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
    vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    // Mock db.insert and db.delete for in-memory session operations
    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: () => ({
        onConflictDoUpdate: async () => {},
        returning: async () => [{ id: 1, createdAt: new Date() }],
      }),
    })) as any);

    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {},
    })) as any);

    // Default mock for sessionManager to avoid database connection dependencies in unit tests
    vi.spyOn(sessionManager, "getSession").mockResolvedValue({ messages: [] });
    vi.spyOn(sessionManager, "appendTurn").mockResolvedValue({ messages: [] });
    vi.spyOn(sessionManager, "setPendingEntityConfirmation").mockResolvedValue({ messages: [] });
    vi.spyOn(sessionManager, "setConfirmedTournament").mockResolvedValue({ messages: [] });

    // Default mock for entityResolutionService to resolve test tournaments cleanly
    vi.spyOn(entityResolutionService, "resolveTournament").mockImplementation(async ({ queryText, confirmedTournamentId }) => {
      if (confirmedTournamentId === 201) {
        return {
          status: "resolved",
          tournament: {
            id: 201,
            name: "Diamond Premier League",
            city: "Kanpur",
            sport: "cricket",
            status: "in_progress",
            auctionEnabled: true,
            scoringEnabled: true,
            score: 1.0,
            matchType: "authorized_context",
          },
        };
      }
      if (/unrelated/i.test(queryText)) {
        return {
          status: "resolved",
          tournament: {
            id: 999,
            name: "Unrelated Super League",
            city: "Delhi",
            sport: "cricket",
            status: "in_progress",
            auctionEnabled: true,
            scoringEnabled: true,
            score: 1.0,
            matchType: "exact",
          },
        };
      }
      if (/diamond/i.test(queryText)) {
        return {
          status: "resolved",
          tournament: {
            id: 201,
            name: "Diamond Premier League",
            city: "Kanpur",
            sport: "cricket",
            status: "in_progress",
            auctionEnabled: true,
            scoringEnabled: true,
            score: 1.0,
            matchType: "exact",
          },
        };
      }
      return { status: "not_found", message: "Not found" };
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();
  });

  // ─── 1. Identity & Role Resolution Across Tournaments ───────────────────────
  describe("1. Identity & Role Resolution Across Tournaments", () => {
    it("resolves team owner role, active team ID and associated licensed tournament", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: (table: any) => ({
          where: () => {
            const tableName = table?.[Symbol.for("drizzle:Name")] || table?._?.name;
            if (tableName === "teams") {
              return [
                {
                  id: 15,
                  name: "Royal Strikers",
                  tournamentId: 201,
                },
              ];
            }
            if (tableName === "players") {
              return [];
            }
            // Tournaments
            return [
              {
                id: 201,
                name: "Diamond Premier League",
                sport: "cricket",
                status: "in_progress",
                licenseStatus: "active",
                adminLocked: false,
                auctionEnabled: true,
                scoringEnabled: true,
                scoringPhase: "active",
                licenseGrantedAt: new Date(),
                featuresJson: null,
                organizerMobile: "919999999999",
              },
            ];
          },
        }),
      })) as any);

      const identity = {
        kind: "member" as const,
        member: { id: "mem_owner_1", displayName: "Rajesh Singhania", primaryMobile: TEAM_OWNER_MOBILE } as any,
        roles: [{ id: 1, memberId: "mem_owner_1", role: "team_owner", scope: "tournament", tournamentId: 201 } as any],
        links: [],
        tournamentIds: [201],
        isAmbiguous: false,
        displayName: "Rajesh Singhania",
      };

      const context = await router.resolveAssistantUserContext(identity, TEAM_OWNER_MOBILE);
      expect(context.userCategory).toBe("team_owner");
      expect(context.displayName).toBe("Rajesh Singhania");
      expect(context.authorizedTournaments).toHaveLength(1);
      expect(context.authorizedTournaments![0].id).toBe(201);
      expect(context.authorizedTournaments![0].name).toBe("Diamond Premier League");
      expect(context.memberships).toBeDefined();
      expect(context.memberships![0].role).toBe("team_owner");
      expect(context.memberships![0].teamId).toBe(15);
      expect(context.memberships![0].teamName).toBe("Royal Strikers");
      expect(context.activeTeamId).toBe(15);
    });

    it("resolves registered player role and associated tournament", async () => {
      vi.spyOn(db, "select").mockImplementation((() => ({
        from: (table: any) => ({
          where: () => {
            const tableName = table?.[Symbol.for("drizzle:Name")] || table?._?.name;
            if (tableName === "teams") {
              return [];
            }
            if (tableName === "players") {
              return [
                {
                  id: 42,
                  name: "Amit Sharma",
                  teamId: 15,
                  tournamentId: 201,
                },
              ];
            }
            // Tournaments
            return [
              {
                id: 201,
                name: "Diamond Premier League",
                sport: "cricket",
                status: "in_progress",
                licenseStatus: "active",
                adminLocked: false,
                auctionEnabled: true,
                scoringEnabled: true,
                scoringPhase: "active",
                licenseGrantedAt: new Date(),
                featuresJson: null,
                organizerMobile: "919999999999",
              },
            ];
          },
        }),
      })) as any);

      const identity = {
        kind: "member" as const,
        member: { id: "mem_player_1", displayName: "Amit Sharma", primaryMobile: PLAYER_MOBILE } as any,
        roles: [{ id: 2, memberId: "mem_player_1", role: "player", scope: "tournament", tournamentId: 201 } as any],
        links: [],
        tournamentIds: [201],
        isAmbiguous: false,
        displayName: "Amit Sharma",
      };

      const context = await router.resolveAssistantUserContext(identity, PLAYER_MOBILE);
      expect(context.userCategory).toBe("player");
      expect(context.displayName).toBe("Amit Sharma");
      expect(context.activePlayerId).toBe(42);
      expect(context.memberships![0].role).toBe("player");
    });
  });

  // ─── 2. Access Control & Confidentiality Boundaries ─────────────────────────
  describe("2. Access Control & Confidentiality Boundaries", () => {
    it("denies access when user requests operational data for an unassociated tournament", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "team_owner",
        displayName: "Rajesh",
        mobile: TEAM_OWNER_MOBILE,
        authorizedTournaments: [
          {
            id: 201,
            name: "Diamond Premier League",
            sport: "cricket",
            status: "in_progress",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
      };

      const reply = await guestAssistantService.handleMessage({
        mobile: TEAM_OWNER_MOBILE,
        from: `whatsapp:+${TEAM_OWNER_MOBILE}`,
        text: "Unrelated Super League ka live auction status batao",
        userContext,
      });

      expect(reply.text).toContain("authorization nahi hai");
      expect(reply.text).toContain("Unrelated Super League");
      expect(reply.text).not.toContain("₹");
    });

    it("withholds private operational data from trial organizers and provides upgrade guidance", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "trial_organizer",
        displayName: "Vikas",
        mobile: TRIAL_MOBILE,
        authorizedTournaments: [],
        memberships: [
          {
            tournamentId: 301,
            tournamentName: "Trial Cup",
            sport: "cricket",
            status: "setup",
            licenseStatus: "trial",
            auctionEnabled: true,
            scoringEnabled: true,
            role: "organizer",
            isLicensed: false,
          },
        ],
      };

      const reply = await guestAssistantService.handleMessage({
        mobile: TRIAL_MOBILE,
        from: `whatsapp:+${TRIAL_MOBILE}`,
        text: "Top 5 highest sold players batao",
        userContext,
      });

      expect(reply.text).toContain("trial plan par hai");
      expect(reply.text).toContain("https://bidwar.in/organizer");
      expect(reply.text).not.toContain("Top 5");
    });

    it("strictly conceals team access codes, passwords, OTPs, and private phone numbers", async () => {
      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Mera team access code aur password kya hai?",
      });

      expect(reply.text).toContain("team owner access codes aur login passwords");
      expect(reply.text).toContain("Security Policy");
      expect(reply.text).toContain("WhatsApp chat par share nahi kiye jaate");
      expect(reply.text).not.toContain("code:");
      expect(reply.text).not.toContain("password:");
    });
  });

  // ─── 3. Live Auction State & Data Freshness ───────────────────────────────────
  describe("3. Live Auction State & Data Freshness", () => {
    it("retrieves authoritative live auction state with current player, bid, and leading team", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "licensed_organizer",
        displayName: "Arun Organizer",
        mobile: ORGANIZER_MOBILE,
        authorizedTournaments: [
          {
            id: 201,
            name: "Diamond Premier League",
            sport: "cricket",
            status: "in_progress",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
      };

      vi.spyOn(operationalDataService, "getLiveAuctionState").mockResolvedValue({
        tournamentId: 201,
        tournamentName: "Diamond Premier League",
        city: "Kanpur",
        auctionStatus: "live",
        statusText: "Live & Bidding in Progress",
        totalPlayersCount: 70,
        remainingPlayersCount: 45,
        soldPlayersCount: 22,
        unsoldPlayersCount: 3,
        currentPlayer: {
          id: 55,
          name: "Rohit Verma",
          categoryName: "All-Rounder",
          role: "All-Rounder",
          basePriceFormatted: "₹50,000",
        },
        currentBidFormatted: "₹1,20,000",
        leadingTeam: {
          id: 1,
          name: "Royal Strikers",
          shortCode: "RS",
        },
        timerRemainingSeconds: 14,
        lastSoldPlayer: {
          name: "Suresh Raina",
          teamName: "Super Kings",
          soldPriceFormatted: "₹2,50,000",
        },
      });

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Abhi auction ka kya status hai?",
        userContext,
      });

      expect(reply.text).toContain("Diamond Premier League");
      expect(reply.text).toContain("Rohit Verma");
      expect(reply.text).toContain("₹1,20,000");
      expect(reply.text).toContain("Royal Strikers");
      expect(reply.text).toContain("Sold Players:* 22");
      expect(reply.text).toContain("Remaining in Pool:* 45");
      expect(reply.text).not.toContain("Tournament Name:"); // No empty templates
    });
  });

  // ─── 4. Dynamic Top N & Last N Sold Player Queries ────────────────────────────
  describe("4. Dynamic Top N & Last N Sold Player Queries", () => {
    const userContext: AssistantUserContext = {
      userCategory: "licensed_organizer",
      displayName: "Arun Organizer",
      mobile: ORGANIZER_MOBILE,
      authorizedTournaments: [
        {
          id: 201,
          name: "Diamond Premier League",
          sport: "cricket",
          status: "in_progress",
          licenseStatus: "licensed",
          auctionEnabled: true,
          scoringEnabled: true,
        },
      ],
    };

    it("dynamically resolves limit = 1 for 'Sabse mehenga player kaun bika?'", async () => {
      const spy = vi.spyOn(operationalDataService, "getTopSoldPlayers").mockResolvedValue([
        {
          rank: 1,
          playerName: "Virat Kohli",
          category: "Batsman",
          teamName: "Royal Strikers",
          soldPriceFormatted: "₹5,00,000",
        },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Sabse mehenga player kaun bika?",
        userContext,
      });

      expect(spy).toHaveBeenCalledWith({ tournamentId: 201, limit: 1 });
      expect(reply.text).toContain("Virat Kohli");
      expect(reply.text).toContain("₹5,00,000");
      expect(reply.text).toContain("Royal Strikers");
    });

    it("dynamically resolves user requested N = 3 for 'Top 3 highest sold players'", async () => {
      const spy = vi.spyOn(operationalDataService, "getTopSoldPlayers").mockResolvedValue([
        { rank: 1, playerName: "Player A", category: "All-Rounder", teamName: "Tigers", soldPriceFormatted: "₹4,00,000" },
        { rank: 2, playerName: "Player B", category: "Bowler", teamName: "Lions", soldPriceFormatted: "₹3,50,000" },
        { rank: 3, playerName: "Player C", category: "Batsman", teamName: "Hawks", soldPriceFormatted: "₹3,00,000" },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Top 3 highest sold players batao",
        userContext,
      });

      expect(spy).toHaveBeenCalledWith({ tournamentId: 201, limit: 3 });
      expect(reply.text).toContain("Top 3 Highest Sold Players");
      expect(reply.text).toContain("1. *Player A*");
      expect(reply.text).toContain("2. *Player B*");
      expect(reply.text).toContain("3. *Player C*");
    });

    it("retrieves last N sold players ordered by authoritative auction event time", async () => {
      const spy = vi.spyOn(operationalDataService, "getLastSoldPlayers").mockResolvedValue([
        { rank: 1, playerName: "Latest Guy", category: "Wicket-Keeper", teamName: "Tigers", soldPriceFormatted: "₹1,50,000", soldAtFormatted: "10:45 AM" },
        { rank: 2, playerName: "Earlier Guy", category: "Batsman", teamName: "Warriors", soldPriceFormatted: "₹2,00,000", soldAtFormatted: "10:30 AM" },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Last 5 sold players kaun hain?",
        userContext,
      });

      expect(spy).toHaveBeenCalledWith({ tournamentId: 201, limit: 5 });
      expect(reply.text).toContain("Sold Players");
      expect(reply.text).toContain("Latest Guy");
      expect(reply.text).toContain("Earlier Guy");
    });
  });

  // ─── 5. Team Purse & Spending Rankings ────────────────────────────────────────
  describe("5. Team Purse & Spending Rankings", () => {
    const userContext: AssistantUserContext = {
      userCategory: "licensed_organizer",
      displayName: "Arun Organizer",
      mobile: ORGANIZER_MOBILE,
      authorizedTournaments: [
        {
          id: 201,
          name: "Diamond Premier League",
          sport: "cricket",
          status: "in_progress",
          licenseStatus: "licensed",
          auctionEnabled: true,
          scoringEnabled: true,
        },
      ],
    };

    it("ranks teams by total spending for 'Kaunsi team ne sabse zyada paisa kharch kiya?'", async () => {
      const spy = vi.spyOn(operationalDataService, "getTeamPurseAndRankings").mockResolvedValue([
        {
          rank: 1,
          teamId: 1,
          teamName: "Super Kings",
          shortCode: "CSK",
          ownerName: "N. Srinivasan",
          purseTotal: "₹10,00,000",
          purseUsed: "₹7,50,000",
          purseRemaining: "₹2,50,000",
          spentRaw: 750000,
          remainingRaw: 250000,
          playersBoughtCount: 14,
          maxAllowedBid: "₹1,50,000",
          slotsRequired: 2,
          futureReservePurse: "₹1,00,000",
        },
        {
          rank: 2,
          teamId: 2,
          teamName: "Royal Strikers",
          shortCode: "RS",
          ownerName: "Rajesh Singhania",
          purseTotal: "₹10,00,000",
          purseUsed: "₹5,00,000",
          purseRemaining: "₹5,00,000",
          spentRaw: 500000,
          remainingRaw: 500000,
          playersBoughtCount: 11,
          maxAllowedBid: "₹2,50,000",
          slotsRequired: 3,
          futureReservePurse: "₹1,50,000",
        },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Kaunsi team ne sabse zyada paisa kharch kiya?",
        userContext,
      });

      expect(spy).toHaveBeenCalledWith({ tournamentId: 201, sortBy: "spent" });
      expect(reply.text).toContain("Team Spending Summary");
      expect(reply.text).toContain("Super Kings");
      expect(reply.text).toContain("Spent: ₹7,50,000");
    });

    it("ranks teams by remaining purse for 'Kis team ka purse sabse zyada bacha hai?'", async () => {
      const spy = vi.spyOn(operationalDataService, "getTeamPurseAndRankings").mockResolvedValue([
        {
          rank: 1,
          teamId: 2,
          teamName: "Royal Strikers",
          shortCode: "RS",
          ownerName: "Rajesh Singhania",
          purseTotal: "₹10,00,000",
          purseUsed: "₹3,00,000",
          purseRemaining: "₹7,00,000",
          spentRaw: 300000,
          remainingRaw: 700000,
          playersBoughtCount: 8,
          maxAllowedBid: "₹4,50,000",
          slotsRequired: 5,
          futureReservePurse: "₹2,50,000",
        },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Kis team ka purse sabse zyada bacha hai?",
        userContext,
      });

      expect(spy).toHaveBeenCalledWith({ tournamentId: 201, sortBy: "remaining" });
      expect(reply.text).toContain("Team Remaining Purse Rankings");
      expect(reply.text).toContain("Royal Strikers");
      expect(reply.text).toContain("Remaining: *₹7,00,000*");
    });
  });

  // ─── 6. Maximum Permissible Next Bid & Purse Protection ───────────────────────
  describe("6. Maximum Permissible Next Bid & Purse Protection", () => {
    it("accurately returns spendable purse, reserve purse, and maximum allowed next bid for team owner", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "team_owner",
        displayName: "Rajesh Singhania",
        mobile: TEAM_OWNER_MOBILE,
        activeTeamId: 15,
        authorizedTournaments: [
          {
            id: 201,
            name: "Diamond Premier League",
            sport: "cricket",
            status: "in_progress",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
      };

      vi.spyOn(operationalDataService, "getTeamOwnerPersonalData").mockResolvedValue({
        teamName: "Royal Strikers",
        tournamentName: "Diamond Premier League",
        ownerName: "Rajesh Singhania",
        purseTotal: "₹10,00,000",
        purseUsed: "₹6,00,000",
        purseRemaining: "₹4,00,000",
        playersBoughtCount: 11,
        playersList: [
          { name: "Virat Kohli", price: "₹4,00,000", status: "sold" },
          { name: "Jasprit Bumrah", price: "₹2,00,000", status: "sold" },
        ],
        isBiddingEnabled: true,
        maxAllowedBid: "₹2,50,000",
        reservePurse: "₹1,50,000",
        spendablePurse: "₹2,50,000",
        slotsRequired: 3,
      });

      const reply = await guestAssistantService.handleMessage({
        mobile: TEAM_OWNER_MOBILE,
        from: `whatsapp:+${TEAM_OWNER_MOBILE}`,
        text: "Maximum next bid kitni kar sakte hain?",
        userContext,
      });

      expect(reply.text).toContain("Royal Strikers");
      expect(reply.text).toContain("Maximum Permissible Next Bid:* *₹2,50,000*");
      expect(reply.text).toContain("Reserve Purse for Squad:* ₹1,50,000");
      expect(reply.text).toContain("Remaining Purse:* ₹4,00,000");
    });
  });

  // ─── 7. Team-Wise Acquisition Hierarchy & Sorted Sold Players ──────────────────
  describe("7. Team-Wise Acquisition Hierarchy & Sorted Sold Players", () => {
    const userContext: AssistantUserContext = {
      userCategory: "licensed_organizer",
      displayName: "Arun Organizer",
      mobile: ORGANIZER_MOBILE,
      authorizedTournaments: [
        {
          id: 201,
          name: "Diamond Premier League",
          sport: "cricket",
          status: "in_progress",
          licenseStatus: "licensed",
          auctionEnabled: true,
          scoringEnabled: true,
        },
      ],
    };

    it("returns team-wise acquisition hierarchy with spending and squad breakdown", async () => {
      vi.spyOn(operationalDataService, "getTeamWiseAcquisitionHierarchy").mockResolvedValue([
        {
          teamId: 1,
          teamName: "Royal Strikers",
          shortCode: "RS",
          ownerName: "Rajesh Singhania",
          totalSpent: "₹5,00,000",
          purseRemaining: "₹5,00,000",
          playersCount: 2,
          players: [
            { name: "Virat Kohli", role: "Batsman", price: "₹4,00,000", status: "sold" },
            { name: "Dinesh Karthik", role: "Wicket-Keeper", price: "₹1,00,000", status: "sold" },
          ],
        },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Team-wise sold players ki list do",
        userContext,
      });

      expect(reply.text).toContain("Team-wise Sold Players Hierarchy");
      expect(reply.text).toContain("Royal Strikers");
      expect(reply.text).toContain("Virat Kohli (Batsman): ₹4,00,000");
      expect(reply.text).toContain("Dinesh Karthik (Wicket-Keeper): ₹1,00,000");
    });

    it("returns all sold players sorted in descending order of sold price", async () => {
      const spy = vi.spyOn(operationalDataService, "getAllSoldPlayersSorted").mockResolvedValue([
        { rank: 1, playerName: "Player Top", category: "All-Rounder", teamName: "Tigers", soldPriceFormatted: "₹5,00,000" },
        { rank: 2, playerName: "Player Second", category: "Bowler", teamName: "Hawks", soldPriceFormatted: "₹3,00,000" },
      ]);

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Players ko sold amount ke descending order mein dikhao",
        userContext,
      });

      expect(spy).toHaveBeenCalledWith(201, "desc");
      expect(reply.text).toContain("Player Top");
      expect(reply.text).toContain("Player Second");
    });
  });

  // ─── 8. Configured Tournament & Auction Rules ────────────────────────────────
  describe("8. Configured Tournament & Auction Rules", () => {
    it("returns authoritative configured database rules instead of generic rules", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "player",
        displayName: "Amit Sharma",
        mobile: PLAYER_MOBILE,
        authorizedTournaments: [
          {
            id: 201,
            name: "Diamond Premier League",
            sport: "cricket",
            status: "in_progress",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
      };

      vi.spyOn(operationalDataService, "getTournamentDetailsAndRules").mockResolvedValue({
        tournamentId: 201,
        tournamentName: "Diamond Premier League",
        sport: "cricket",
        status: "in_progress",
        auctionUnit: "inr",
        registeredTeamsCount: 8,
        registeredPlayersCount: 120,
        basePurseFormatted: "₹10,00,000",
        minBidFormatted: "₹20,000",
        bidIncrementFormatted: "₹10,000",
        bidTiers: {
          tier1UpTo: "₹1,00,000",
          tier1Increment: "₹10,000",
          tier2UpTo: "₹5,00,000",
          tier2Increment: "₹25,000",
          tier3Increment: "₹50,000",
        },
        timerSeconds: 30,
        bidTimerSeconds: 15,
        bidExtensionEnabled: true,
        bidExtensionSeconds: 10,
        minimumSquadSize: 11,
        maximumSquadSize: 15,
        playerSelectionMode: "category_serial",
        categories: [
          { id: 1, name: "Batsman", minBidFormatted: "₹20,000" },
          { id: 2, name: "Bowler", minBidFormatted: "₹20,000" },
        ],
      });

      const reply = await guestAssistantService.handleMessage({
        mobile: PLAYER_MOBILE,
        from: `whatsapp:+${PLAYER_MOBILE}`,
        text: "Auction rules kya hain? Bid increment kaise hota hai?",
        userContext,
      });

      expect(reply.text).toContain("Diamond Premier League* — Configured Auction Rules");
      expect(reply.text).toContain("Base Team Purse:* ₹10,00,000");
      expect(reply.text).toContain("Minimum Squad Size:* 11 players");
      expect(reply.text).toContain("Maximum Squad Size:* 15 players");
      expect(reply.text).toContain("Tier 1:* Up to ₹1,00,000 (+₹10,000)");
    });
  });

  // ─── 9. Multi-Turn Conversational Intelligence & Follow-ups ───────────────────
  describe("9. Multi-Turn Conversational Intelligence & Follow-ups", () => {
    it("maintains tournament context across follow-ups without requiring repeated tournament names", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "team_owner",
        displayName: "Rajesh Singhania",
        mobile: TEAM_OWNER_MOBILE,
        activeTeamId: 15,
        authorizedTournaments: [
          {
            id: 201,
            name: "Diamond Premier League",
            sport: "cricket",
            status: "in_progress",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
      };

      // In-memory mock session store that preserves confirmedTournamentId
      let currentSession: any = { messages: [] };
      vi.spyOn(sessionManager, "getSession").mockImplementation(async () => currentSession);
      vi.spyOn(sessionManager, "appendTurn").mockImplementation(async (mob, userT, botT, act, meta) => {
        currentSession = {
          ...currentSession,
          ...meta,
          messages: [...(currentSession.messages || []), { role: "user", text: userT }, { role: "model", text: botT }],
        };
        return currentSession;
      });

      vi.spyOn(operationalDataService, "getLiveAuctionState").mockResolvedValue({
        tournamentId: 201,
        tournamentName: "Diamond Premier League",
        city: "Kanpur",
        auctionStatus: "live",
        statusText: "Live & Bidding in Progress",
        totalPlayersCount: 70,
        remainingPlayersCount: 50,
        soldPlayersCount: 20,
        unsoldPlayersCount: 2,
        timerRemainingSeconds: null,
      });

      vi.spyOn(operationalDataService, "getTopSoldPlayers").mockResolvedValue([
        { rank: 1, playerName: "Virat Kohli", category: "Batsman", teamName: "Royal Strikers", soldPriceFormatted: "₹5,00,000" },
      ]);

      vi.spyOn(operationalDataService, "getTeamOwnerPersonalData").mockResolvedValue({
        teamName: "Royal Strikers",
        tournamentName: "Diamond Premier League",
        ownerName: "Rajesh Singhania",
        purseTotal: "₹10,00,000",
        purseUsed: "₹5,00,000",
        purseRemaining: "₹5,00,000",
        playersBoughtCount: 10,
        playersList: [{ name: "Virat Kohli", price: "₹5,00,000", status: "sold" }],
        isBiddingEnabled: true,
        maxAllowedBid: "₹3,50,000",
        reservePurse: "₹1,50,000",
        spendablePurse: "₹3,50,000",
        slotsRequired: 3,
      });

      // Turn 1: "Diamond Premier League ka status batao"
      const turn1 = await guestAssistantService.handleMessage({
        mobile: TEAM_OWNER_MOBILE,
        from: `whatsapp:+${TEAM_OWNER_MOBILE}`,
        text: "Diamond Premier League ka status batao",
        userContext,
      });
      expect(turn1.text).toContain("Diamond Premier League");
      expect(currentSession.confirmedTournamentId).toBe(201);

      // Turn 2: "Top 5 batao" (no tournament name mentioned)
      const turn2 = await guestAssistantService.handleMessage({
        mobile: TEAM_OWNER_MOBILE,
        from: `whatsapp:+${TEAM_OWNER_MOBILE}`,
        text: "Top 5 batao",
        userContext,
      });
      expect(turn2.text).toContain("Highest Sold Players");
      expect(turn2.text).toContain("Virat Kohli");

      // Turn 3: "Meri team ka purse?" (no tournament name mentioned)
      const turn3 = await guestAssistantService.handleMessage({
        mobile: TEAM_OWNER_MOBILE,
        from: `whatsapp:+${TEAM_OWNER_MOBILE}`,
        text: "Meri team ka purse kitna bacha hai?",
        userContext,
      });
      expect(turn3.text).toContain("Royal Strikers");
      expect(turn3.text).toContain("Purse Remaining: *₹5,00,000*");
      expect(turn3.text).toContain("Maximum Allowed Next Bid: *₹3,50,000*");
    });
  });

  // ─── 10. Multi-Tournament Disambiguation ──────────────────────────────────────
  describe("10. Multi-Tournament Disambiguation", () => {
    it("asks user to clarify which tournament when associated with multiple tournaments and none specified", async () => {
      const userContext: AssistantUserContext = {
        userCategory: "licensed_organizer",
        displayName: "Multi-League Org",
        mobile: ORGANIZER_MOBILE,
        authorizedTournaments: [
          {
            id: 201,
            name: "Diamond Premier League",
            sport: "cricket",
            status: "in_progress",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
          {
            id: 202,
            name: "Golden Super Cup",
            sport: "badminton",
            status: "active",
            licenseStatus: "licensed",
            auctionEnabled: true,
            scoringEnabled: true,
          },
        ],
      };

      vi.spyOn(entityResolutionService, "resolveTournament").mockResolvedValue({
        status: "not_found",
        message: "Not found",
      });

      const reply = await guestAssistantService.handleMessage({
        mobile: ORGANIZER_MOBILE,
        from: `whatsapp:+${ORGANIZER_MOBILE}`,
        text: "Top 5 sold players kaun hain?",
        userContext,
      });

      expect(reply.text).toContain("Aap ek se zyada tournaments se jude hain");
      expect(reply.text).toContain("1. Diamond Premier League");
      expect(reply.text).toContain("2. Golden Super Cup");
    });
  });
});
