import { describe, expect, it } from "vitest";
import {
  isAuctionLicenseActive,
  TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT,
} from "@workspace/api-base";
import {
  _resetAuctionCleanupLocksForTests,
  tryBeginAuctionCleanup,
} from "../lib/auction-cleanup-lock";
import {
  DemoResetConflictError,
  DemoResetForbiddenError,
  applyPracticeResetToWorld,
  commitDemoCleanup,
  createMemoryDemoStore,
  emptyDemoWorld,
  loadOrganizerDemo,
  ownerCredentialWorks,
  referencedMediaUrls,
  type DemoWorld,
} from "../lib/auction-demo-reset-plan";

const ORIGINAL_PLAYER_PHOTO = "https://cdn.example/original-player.png";
const ORIGINAL_TEAM_LOGO = "https://cdn.example/original-team.png";
const ORIGINAL_SPONSOR_LOGO = "https://cdn.example/original-sponsor.png";
const DEMO_PLAYER_PHOTO = "https://cdn.example/demo-player.png";
const DEMO_TEAM_LOGO = "https://cdn.example/demo-team.png";
const DEMO_SPONSOR_LOGO = "https://cdn.example/demo-sponsor.png";
const DEMO_MASTER_LOGO = "https://cdn.example/demo-master-sponsor.png";
const DEMO_ACCESS = "DEMO-ACCESS";
const DEMO_SESSION = "owner-demo-1";

function settings(overrides: Record<string, unknown> = {}) {
  return {
    basePurse: 100,
    minBid: 10,
    bidIncrement: 5,
    bidTier1UpTo: 20,
    bidTier1Increment: 5,
    bidTier2UpTo: 50,
    bidTier2Increment: 10,
    bidTier3Increment: 20,
    timerSeconds: 30,
    bidTimerSeconds: 15,
    playerSelectionMode: "sequential",
    status: "setup",
    ...overrides,
  };
}

function baseWorld(): DemoWorld {
  return emptyDemoWorld({
    id: 7,
    organizerId: 42,
    licenseStatus: "trial",
    resetCount: 1,
    settings: settings(),
    sponsorLogos: [{ url: ORIGINAL_SPONSOR_LOGO, name: "Original Sponsor" }],
  });
}

function loadMixedTournament(): DemoWorld {
  const world = baseWorld();
  world.categories.push({ id: 8, tournamentId: 7, name: "Original Gold" });
  world.teams.push({
    id: 2,
    tournamentId: 7,
    name: "Original Lions",
    logoUrl: ORIGINAL_TEAM_LOGO,
    accessCode: "ORIG-1",
    purseUsed: 40,
  });
  world.teams.push({
    id: 3,
    tournamentId: 7,
    name: "Demo Strikers",
    logoUrl: ORIGINAL_TEAM_LOGO,
    accessCode: "ORIG-2",
    purseUsed: 0,
  });
  world.players.push({
    id: 20,
    tournamentId: 7,
    name: "Original Player",
    photoUrl: ORIGINAL_PLAYER_PHOTO,
    teamId: 2,
    categoryId: 8,
    status: "sold",
    soldPrice: 40,
    retainedPrice: null,
  });
  world.players.push({
    id: 21,
    tournamentId: 7,
    name: "Retained Original",
    photoUrl: "https://cdn.example/retained-original.png",
    teamId: 2,
    categoryId: 8,
    status: "retained",
    soldPrice: null,
    retainedPrice: 15,
  });
  world.bids.push({ id: 1, tournamentId: 7, playerId: 20, teamId: 2, amount: 40 });
  world.bidEvents.push({ id: 1, playerId: 20, teamId: 2 });
  world.auctionSession = {
    status: "active",
    currentPlayerId: 11,
    currentBid: 25,
    currentBidTeamId: 1,
    timerEndsAt: "soon",
    deferredPlayerIds: "[11,20]",
    randomDrawQueue: "[11]",
    soldPlayersCount: 2,
    unsoldPlayersCount: 0,
    lastAction: "Demo player on the block",
  };
  loadOrganizerDemo(world, {
    sessionId: "demo-session-1",
    organizerId: 42,
    settingsApplied: { basePurse: 999, minBid: 77, status: "live" },
    teams: [{ id: 1, name: "Demo Strikers", logoUrl: DEMO_TEAM_LOGO, accessCode: DEMO_ACCESS, purseUsed: 30 }],
    players: [
      {
        id: 11,
        name: "Demo Player",
        photoUrl: DEMO_PLAYER_PHOTO,
        teamId: 1,
        categoryId: 9,
        status: "sold",
        soldPrice: 30,
      },
    ],
    categories: [{ id: 9, name: "Demo Platinum" }],
    sponsors: [{ demoSponsorId: "demo-sponsor-1", name: "Demo Sponsor", url: DEMO_SPONSOR_LOGO }],
    ownerSessions: [{ id: DEMO_SESSION, teamId: 1 }],
    retentions: [{ id: 50, auctionPlayerId: 11, auctionTeamId: 1 }],
    bids: [{ id: 9, playerId: 11, teamId: 1, amount: 30 }],
    bidEvents: [{ id: 9, playerId: 11, teamId: 1 }],
    playerEvents: [{ id: 9, playerId: 11 }],
    timerEvents: [{ id: 9, playerId: 11 }, { id: 4, playerId: null }],
    masterSponsors: [{ id: "ms-demo", logoUrl: DEMO_MASTER_LOGO }],
    boosters: [{ id: 70, teamId: 1, status: "active" }, { id: 71, teamId: 2, status: "active" }],
  });
  world.ownerSessions.push({ id: "late-demo-session", tournamentId: 7, teamId: 1 });
  world.tournament!.settings.basePurse = 250;
  return world;
}

function cleanup(world: DemoWorld, actorOrganizerId = 42, hooks?: { failAfterApply?: boolean; beforeMutate?: () => void }) {
  return commitDemoCleanup(
    createMemoryDemoStore(world, { beforeMutate: hooks?.beforeMutate }),
    { tournamentId: 7, actorOrganizerId, actorLabel: "operator" },
    { failAfterApply: hooks?.failAfterApply },
  );
}

describe("demo-aware auction reset", () => {
  it("removes loaded demo teams, players, and sponsors and leaves originals", async () => {
    const world = loadMixedTournament();
    const outcome = await cleanup(world);

    expect(outcome.mode).toBe("demo");
    expect(world.teams.map((team) => team.id).sort()).toEqual([2, 3]);
    expect(world.players.map((player) => player.id).sort()).toEqual([20, 21]);
    expect(world.categories.map((category) => category.id)).toEqual([8]);
    expect(world.tournament?.sponsorLogos).toEqual([
      { url: ORIGINAL_SPONSOR_LOGO, name: "Original Sponsor" },
    ]);
    expect(world.masterSponsors).toEqual([]);
    expect(world.session?.status).toBe("reset");
  });

  it("drops references to demo photos and logos", async () => {
    const world = loadMixedTournament();
    await cleanup(world);
    const urls = referencedMediaUrls(world);
    expect(urls.has(DEMO_PLAYER_PHOTO)).toBe(false);
    expect(urls.has(DEMO_TEAM_LOGO)).toBe(false);
    expect(urls.has(DEMO_SPONSOR_LOGO)).toBe(false);
    expect(urls.has(DEMO_MASTER_LOGO)).toBe(false);
    expect(urls.has(ORIGINAL_PLAYER_PHOTO)).toBe(true);
    expect(urls.has(ORIGINAL_TEAM_LOGO)).toBe(true);
    expect(urls.has(ORIGINAL_SPONSOR_LOGO)).toBe(true);
  });

  it("keeps original records, images, and organiser edits to settings", async () => {
    const world = loadMixedTournament();
    await cleanup(world);

    expect(world.players.find((player) => player.id === 20)?.photoUrl).toBe(ORIGINAL_PLAYER_PHOTO);
    expect(world.players.find((player) => player.id === 20)?.status).toBe("sold");
    expect(world.teams.find((team) => team.id === 2)?.logoUrl).toBe(ORIGINAL_TEAM_LOGO);
    expect(world.tournament?.settings.basePurse).toBe(250);
    expect(world.tournament?.settings.minBid).toBe(10);
    expect(world.tournament?.settings.status).toBe("setup");
    expect(world.tournament?.licenseStatus).toBe("trial");
    expect(world.bids).toEqual([{ id: 1, tournamentId: 7, playerId: 20, teamId: 2, amount: 40 }]);
  });

  it("removes demo auction results and retained-player assignments", async () => {
    const world = loadMixedTournament();
    await cleanup(world);

    expect(world.bids.some((bid) => bid.id === 9)).toBe(false);
    expect(world.bidEvents.some((event) => event.id === 9)).toBe(false);
    expect(world.playerEvents).toEqual([]);
    expect(world.timerEvents).toEqual([{ id: 4, playerId: null }]);
    expect(world.retentions).toEqual([]);
    expect(world.boosters.find((row) => row.id === 70)?.status).toBe("cancelled");
    expect(world.boosters.find((row) => row.id === 71)?.status).toBe("active");
    expect(world.auctionSession?.currentPlayerId).toBeNull();
    expect(world.auctionSession?.deferredPlayerIds).toBe("[20]");
    expect(world.teams.find((team) => team.id === 2)?.purseUsed).toBe(40);
  });

  it("revokes demo owner credentials and sessions", async () => {
    const world = loadMixedTournament();
    expect(ownerCredentialWorks(world, DEMO_ACCESS, DEMO_SESSION)).toBe(true);
    await cleanup(world);
    expect(ownerCredentialWorks(world, DEMO_ACCESS, DEMO_SESSION)).toBe(false);
    expect(world.ownerSessions.some((row) => row.id === "late-demo-session")).toBe(false);
    expect(ownerCredentialWorks(world, "ORIG-1")).toBe(true);
  });

  it("is safe to repeat and does not delete unrelated data", async () => {
    const world = loadMixedTournament();
    await cleanup(world);
    const second = await cleanup(world);
    expect(second.mode).toBe("practice");
    applyPracticeResetToWorld(world);

    expect(world.teams.map((team) => team.id).sort()).toEqual([2, 3]);
    expect(world.players.map((player) => player.id).sort()).toEqual([20, 21]);
    expect(world.players.find((player) => player.id === 21)?.status).toBe("retained");
    expect(world.players.find((player) => player.id === 20)?.status).toBe("available");
    expect(world.tournament?.sponsorLogos[0]?.url).toBe(ORIGINAL_SPONSOR_LOGO);
    expect(world.tournament?.licenseStatus).toBe("trial");
  });

  it("rejects a reset from another organiser", async () => {
    const world = loadMixedTournament();
    const before = structuredClone(world);
    await expect(cleanup(world, 99)).rejects.toBeInstanceOf(DemoResetForbiddenError);
    expect(world.teams.map((team) => team.id).sort()).toEqual(before.teams.map((team) => team.id).sort());
    expect(world.session?.status).toBe("loaded");
  });

  it("blocks concurrent cleanup and rolls back a conflicting auction write", async () => {
    _resetAuctionCleanupLocksForTests();
    const first = tryBeginAuctionCleanup(7);
    expect(first).not.toBeNull();
    expect(tryBeginAuctionCleanup(7)).toBeNull();
    first?.release();

    const world = loadMixedTournament();
    await expect(
      cleanup(world, 42, {
        beforeMutate: () => {
          world.externalTeamRefs.push({ teamId: 1, source: "scoring fixture" });
        },
      }),
    ).rejects.toBeInstanceOf(DemoResetConflictError);
    expect(world.teams.some((team) => team.id === 1)).toBe(true);
    expect(world.externalTeamRefs).toEqual([]);
    expect(world.session?.status).toBe("loaded");
  });

  it("rolls back partial deletes when a later step fails", async () => {
    const world = loadMixedTournament();
    await expect(cleanup(world, 42, { failAfterApply: true })).rejects.toThrow(
      /Simulated demo reset failure/,
    );
    expect(world.teams.some((team) => team.id === 1)).toBe(true);
    expect(world.players.some((player) => player.id === 11)).toBe(true);
    expect(world.session?.status).toBe("loaded");
    expect(referencedMediaUrls(world).has(DEMO_PLAYER_PHOTO)).toBe(true);
  });

  it("follows the practice-reset contract when no demo session is loaded", async () => {
    const world = baseWorld();
    world.teams.push({
      id: 2,
      tournamentId: 7,
      name: "Original Lions",
      logoUrl: ORIGINAL_TEAM_LOGO,
      accessCode: "ORIG-1",
      purseUsed: 80,
    });
    world.players.push(
      {
        id: 20,
        tournamentId: 7,
        name: "Sold Player",
        photoUrl: ORIGINAL_PLAYER_PHOTO,
        teamId: 2,
        categoryId: null,
        status: "sold",
        soldPrice: 40,
        retainedPrice: null,
      },
      {
        id: 21,
        tournamentId: 7,
        name: "Retained Player",
        photoUrl: "https://cdn.example/retained-original.png",
        teamId: 2,
        categoryId: null,
        status: "retained",
        soldPrice: null,
        retainedPrice: 15,
      },
    );
    world.bids.push({ id: 1, tournamentId: 7, playerId: 20, teamId: 2, amount: 40 });
    world.auctionSession = {
      status: "active",
      currentPlayerId: 20,
      currentBid: 40,
      currentBidTeamId: 2,
      timerEndsAt: "soon",
      deferredPlayerIds: "[20]",
      randomDrawQueue: null,
      soldPlayersCount: 1,
      unsoldPlayersCount: 0,
      lastAction: "Sold",
    };

    const outcome = await cleanup(world);
    expect(outcome.mode).toBe("practice");
    const plan = applyPracticeResetToWorld(world);
    expect(plan.deletesAllBids).toBe(true);
    expect(plan.preservesTeams).toBe(true);
    expect(plan.preservesRetainedPlayers).toBe(true);
    expect(plan.setsTournamentStatus).toBe("setup");
    expect(plan.purseByTeamId[2]).toBe(15);
    expect(world.players.find((player) => player.id === 20)?.status).toBe("available");
    expect(world.players.find((player) => player.id === 21)?.status).toBe("retained");
    expect(world.teams).toHaveLength(1);
    expect(world.bids).toEqual([]);
    expect(world.auctionSession?.status).toBe("idle");
    expect(world.tournament?.settings.basePurse).toBe(100);
    expect(world.tournament?.sponsorLogos[0]?.url).toBe(ORIGINAL_SPONSOR_LOGO);
  });

  it("keeps trial licensing rules and does not treat the first teams as demo data", async () => {
    const world = loadMixedTournament();
    await cleanup(world);
    expect(isAuctionLicenseActive("trial")).toBe(false);
    expect(isAuctionLicenseActive(world.tournament?.licenseStatus)).toBe(false);
    expect(TRIAL_AUCTION_ELIGIBLE_TEAM_LIMIT).toBeGreaterThan(0);
    expect(world.tournament?.licenseStatus).toBe("trial");
    expect(world.teams.some((team) => team.id === 1)).toBe(false);
    expect(world.teams.some((team) => team.name === "Demo Strikers" && team.id === 3)).toBe(true);
  });

  it("refuses to delete demo rows that another tournament record depends on", async () => {
    const world = loadMixedTournament();
    world.players.push({
      id: 30,
      tournamentId: 7,
      name: "Original linked to demo team",
      photoUrl: "https://cdn.example/linked.png",
      teamId: 1,
      categoryId: 8,
      status: "sold",
      soldPrice: 10,
      retainedPrice: null,
    });
    await expect(cleanup(world)).rejects.toBeInstanceOf(DemoResetConflictError);
    expect(world.teams.some((team) => team.id === 1)).toBe(true);
    expect(world.players.some((player) => player.id === 30)).toBe(true);
  });
});
