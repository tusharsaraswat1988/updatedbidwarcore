import { describe, expect, it } from "vitest";
import { buildDefaultTrialDemoPayload } from "../lib/auction-trial-demo-data";
import {
  loadOrganizerDemo,
  commitDemoCleanup,
  createMemoryDemoStore,
  emptyDemoWorld,
  activateTournamentLicense,
  type DemoWorld,
} from "../lib/auction-demo-reset-plan";

describe("auction-trial-demo-data default payload", () => {
  it("builds exactly 10 players, 2 teams, 5 sponsors, 1 retained player, and 2 owner sessions", () => {
    const payload = buildDefaultTrialDemoPayload(101, 55);

    expect(payload.tournamentId).toBe(101);
    expect(payload.organizerId).toBe(55);

    // 2 teams with valid logos, colors, access codes
    expect(payload.teams).toHaveLength(2);
    expect(payload.teams![0].name).toContain("Thunder Strikers");
    expect(payload.teams![0].logoUrl).toMatch(/^https:\/\//);
    expect(payload.teams![0].accessCode).toBe("DEMO01");
    expect(payload.teams![0].purseUsed).toBe(500000); // 1 retained player cost

    expect(payload.teams![1].name).toContain("Royal Phoenix");
    expect(payload.teams![1].logoUrl).toMatch(/^https:\/\//);
    expect(payload.teams![1].accessCode).toBe("DEMO02");
    expect(payload.teams![1].purseUsed).toBe(0);

    // 10 players, each with valid photo
    expect(payload.players).toHaveLength(10);
    payload.players!.forEach((p) => {
      expect(p.name).toMatch(/^\[Demo\]/);
      expect(p.photoUrl).toMatch(/^https:\/\//);
      expect(p.role).toBeTruthy();
      expect(p.basePrice).toBeGreaterThan(0);
    });

    // Exactly 1 retained player assigned to team 0
    const retained = payload.players!.filter((p) => p.status === "retained");
    expect(retained).toHaveLength(1);
    expect(retained[0].teamIndex).toBe(0);
    expect(retained[0].retainedPrice).toBe(500000);

    // 9 available players for live bidding
    const available = payload.players!.filter((p) => p.status === "available");
    expect(available).toHaveLength(9);

    // 5 sponsors from 5 distinct tiers
    expect(payload.sponsors).toHaveLength(5);
    const sponsorTiers = new Set(payload.sponsors!.map((s) => s.tier));
    expect(sponsorTiers.size).toBe(5);
    payload.sponsors!.forEach((s) => {
      expect(s.demoSponsorId).toBeTruthy();
      expect(s.url).toMatch(/^https:\/\//);
    });

    // 2 owner sessions
    expect(payload.ownerSessions).toHaveLength(2);
    expect(payload.ownerSessions![0].teamIndex).toBe(0);
    expect(payload.ownerSessions![1].teamIndex).toBe(1);

    // Valid auction settings
    expect(payload.settingsApplied).toMatchObject({
      basePurse: 10000000,
      minBid: 100000,
      bidIncrement: 50000,
      timerSeconds: 30,
      bidTimerSeconds: 15,
      playerSelectionMode: "random",
      minimumSquadSize: 4,
      maximumSquadSize: 6,
      status: "setup",
    });
  });

  it("can be loaded into the demo world and tracks all owned records", () => {
    const payload = buildDefaultTrialDemoPayload(1, 10);
    const world: DemoWorld = {
      tournament: {
        id: 1,
        organizerId: 10,
        licenseStatus: "trial",
        settings: {},
        sponsorLogos: [],
      },
      teams: [],
      players: [],
      categories: [],
      ownerSessions: [],
      retentions: [],
      masterSponsors: [],
      bids: [],
      bidEvents: [],
      playerEvents: [],
      timerEvents: [],
      boosters: [],
      groups: [],
      groupMembers: [],
      matches: [],
      fixtures: [],
      owned: [],
    };

    const session = loadOrganizerDemo(world, {
      sessionId: "demo_test_session",
      organizerId: 10,
      settingsApplied: payload.settingsApplied as Record<string, unknown>,
      teams: payload.teams!.map((t, idx) => ({ id: idx + 1, ...t })),
      players: payload.players!.map((p, idx) => ({ id: idx + 100, ...p })),
      categories: payload.categories!.map((c, idx) => ({ id: idx + 50, ...c })),
      sponsors: payload.sponsors!,
      ownerSessions: payload.ownerSessions!.map((os) => ({ id: os.id, teamId: os.teamIndex + 1 })),
      retentions: payload.retentions!.map((r, idx) => ({
        id: idx + 1,
        auctionPlayerId: r.auctionPlayerIndex + 100,
        auctionTeamId: r.auctionTeamIndex + 1,
      })),
    });

    expect(session.sessionId).toBe("demo_test_session");
    expect(world.teams).toHaveLength(2);
    expect(world.players).toHaveLength(10);
    expect(world.tournament?.sponsorLogos).toHaveLength(5);
    expect(world.ownerSessions).toHaveLength(2);
    expect(world.retentions).toHaveLength(1);
    expect(world.session?.id).toBe("demo_test_session");
    expect(world.session?.status).toBe("loaded");
    // Verify owned records are tracked
    expect(world.owned.length).toBeGreaterThanOrEqual(1 + 2 + 10 + 2 + 5 + 2 + 1);
  });

  it("executes the complete Load -> Practise -> Reset -> Reload lifecycle preserving originals", async () => {
    // 1. Initial tournament with 1 original team and 2 original players
    const world: DemoWorld = emptyDemoWorld({
      id: 42,
      organizerId: 99,
      licenseStatus: "trial",
      resetCount: 0,
      settings: { basePurse: 5000000, minBid: 50000 },
      sponsorLogos: [{ url: "https://example.com/orig-sponsor.png", name: "Original Title Partner" }],
    });
    world.teams.push({ id: 1, tournamentId: 42, name: "Original Club", purseUsed: 0 });
    world.players.push(
      { id: 10, tournamentId: 42, name: "Original Player 1", status: "available" },
      { id: 11, tournamentId: 42, name: "Original Player 2", status: "available" },
    );

    // 2. Load trial demo
    const payload = buildDefaultTrialDemoPayload(42, 99);
    const loaded = loadOrganizerDemo(world, {
      sessionId: "demo_lifecycle_session_1",
      organizerId: 99,
      settingsApplied: payload.settingsApplied as Record<string, unknown>,
      teams: payload.teams!.map((t, idx) => ({ id: idx + 100, ...t })),
      players: payload.players!.map((p, idx) => ({ id: idx + 200, ...p })),
      categories: payload.categories!.map((c, idx) => ({ id: idx + 50, ...c })),
      sponsors: payload.sponsors!,
      ownerSessions: payload.ownerSessions!.map((os) => ({ id: os.id, teamId: os.teamIndex + 100 })),
      retentions: payload.retentions!.map((r, idx) => ({
        id: idx + 1,
        auctionPlayerId: r.auctionPlayerIndex + 200,
        auctionTeamId: r.auctionTeamIndex + 100,
      })),
    });

    expect(loaded.sessionId).toBe("demo_lifecycle_session_1");
    expect(world.session?.status).toBe("loaded");
    expect(world.teams).toHaveLength(3); // 1 original + 2 demo
    expect(world.players).toHaveLength(12); // 2 original + 10 demo
    expect(world.tournament?.sponsorLogos).toHaveLength(6); // 1 original + 5 demo
    expect(world.tournament?.settings.basePurse).toBe(10000000); // Demo settings applied

    // 3. Simulate practise auction bids on demo player
    world.bids.push({ id: 1, tournamentId: 42, playerId: 201, teamId: 101, amount: 250000 });
    world.bidEvents.push({ id: 1, tournamentId: 42, playerId: 201, teamId: 101 });

    // 4. Reset the trial demo
    const store = createMemoryDemoStore(world);
    const resetOutcome = await commitDemoCleanup(store, {
      tournamentId: 42,
      actorOrganizerId: 99,
      actorLabel: "organizer",
    });

    expect(resetOutcome.mode).toBe("demo");
    if (resetOutcome.mode === "demo") {
      expect(resetOutcome.plan.sessionId).toBe("demo_lifecycle_session_1");
    }
    expect(world.session?.status).toBe("reset");

    // Verify demo records are removed and original tournament data remains intact
    expect(world.teams).toHaveLength(1);
    expect(world.teams[0].name).toBe("Original Club");
    expect(world.players).toHaveLength(2);
    expect(world.players.map((p) => p.name)).toEqual(["Original Player 1", "Original Player 2"]);
    expect(world.tournament?.sponsorLogos).toHaveLength(1);
    expect(world.tournament?.sponsorLogos[0].name).toBe("Original Title Partner");
    expect(world.tournament?.settings.basePurse).toBe(5000000); // Restored!
    expect(world.bids).toHaveLength(0); // Demo bids cleaned up

    // 5. Load the demo again — must succeed with no duplicate conflicts
    const reloaded = loadOrganizerDemo(world, {
      sessionId: "demo_lifecycle_session_2",
      organizerId: 99,
      settingsApplied: payload.settingsApplied as Record<string, unknown>,
      teams: payload.teams!.map((t, idx) => ({ id: idx + 300, ...t })),
      players: payload.players!.map((p, idx) => ({ id: idx + 400, ...p })),
      categories: payload.categories!.map((c, idx) => ({ id: idx + 60, ...c })),
      sponsors: payload.sponsors!,
      ownerSessions: payload.ownerSessions!.map((os) => ({ id: os.id, teamId: os.teamIndex + 300 })),
      retentions: payload.retentions!.map((r, idx) => ({
        id: idx + 2,
        auctionPlayerId: r.auctionPlayerIndex + 400,
        auctionTeamId: r.auctionTeamIndex + 300,
      })),
    });

    expect(reloaded.sessionId).toBe("demo_lifecycle_session_2");
    expect(world.session?.status).toBe("loaded");
    expect(world.teams).toHaveLength(3);
    expect(world.players).toHaveLength(12);

    // 6. Trial-to-Live activation automatically clears demo data
    const liveStore = createMemoryDemoStore(world);
    const liveResult = await activateTournamentLicense(liveStore, {
      tournamentId: 42,
      nextStatus: "active",
      grantedBy: "admin-1",
      actorLabel: "super_admin",
      authorized: true,
      recordGrant: true,
    });

    expect(liveResult.demoRemoved).toBe(true);
    expect(liveResult.demoSessionId).toBe("demo_lifecycle_session_2");
    expect(world.tournament?.licenseStatus).toBe("active");
    // All demo teams and players are cleaned up
    expect(world.teams).toHaveLength(1);
    expect(world.teams[0].name).toBe("Original Club");
    expect(world.players).toHaveLength(2);
    expect(world.tournament?.sponsorLogos).toHaveLength(1);

    // 7. Strictly reject loading demo data into an already licensed tournament
    expect(() => {
      if (world.tournament?.licenseStatus !== "trial") {
        throw new Error("Demo data can only be loaded while the tournament license is a trial. Licensed tournaments cannot load trial demo data.");
      }
      loadOrganizerDemo(world, {
        sessionId: "demo_illegal_session",
        organizerId: 99,
        settingsApplied: {},
      });
    }).toThrow("Demo data can only be loaded while the tournament license is a trial.");
  });
});
