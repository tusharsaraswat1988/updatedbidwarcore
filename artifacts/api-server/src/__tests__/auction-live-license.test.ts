import { describe, expect, it } from "vitest";
import {
  _resetAuctionCleanupLocksForTests,
  isAuctionCleanupInProgress,
  tryBeginAuctionCleanup,
} from "../lib/auction-cleanup-lock";
import {
  DemoResetConflictError,
  DemoResetForbiddenError,
  activateTournamentLicense,
  commitDemoCleanup,
  createMemoryDemoStore,
  emptyDemoWorld,
  loadOrganizerDemo,
  ownerCredentialWorks,
  type DemoWorld,
  type LiveLicenseInput,
} from "../lib/auction-demo-reset-plan";

function worldWithDemo(): DemoWorld {
  const world = emptyDemoWorld({
    id: 7,
    organizerId: 42,
    licenseStatus: "trial",
    resetCount: 1,
    settings: { basePurse: 100, minBid: 10, status: "setup" },
    sponsorLogos: [{ url: "https://cdn.example/original-sponsor.png", name: "Original Sponsor" }],
  });
  world.teams.push({
    id: 2,
    tournamentId: 7,
    name: "Original Lions",
    logoUrl: "https://cdn.example/original-team.png",
    accessCode: "ORIG-1",
    purseUsed: 40,
  });
  world.players.push({
    id: 20,
    tournamentId: 7,
    name: "Original Player",
    photoUrl: "https://cdn.example/original-player.png",
    teamId: 2,
    categoryId: null,
    status: "sold",
    soldPrice: 40,
    retainedPrice: null,
  });
  world.bids.push({ id: 1, tournamentId: 7, playerId: 20, teamId: 2, amount: 40 });
  loadOrganizerDemo(world, {
    sessionId: "demo-session-1",
    organizerId: 42,
    settingsApplied: { minBid: 77, status: "live" },
    teams: [{ id: 1, name: "Demo Strikers", logoUrl: "https://cdn.example/demo-team.png", accessCode: "DEMO-ACCESS" }],
    players: [{ id: 11, name: "Demo Player", photoUrl: "https://cdn.example/demo-player.png", teamId: 1, status: "sold", soldPrice: 30 }],
    sponsors: [{ demoSponsorId: "demo-sponsor-1", name: "Demo Sponsor", url: "https://cdn.example/demo-sponsor.png" }],
    ownerSessions: [{ id: "owner-demo-1", teamId: 1 }],
    bids: [{ id: 9, playerId: 11, teamId: 1, amount: 30 }],
  });
  world.tournament!.settings.basePurse = 250;
  return world;
}

function grant(world: DemoWorld, overrides: Partial<LiveLicenseInput> = {}, hooks?: { failAfterApply?: boolean; beforeMutate?: () => void }) {
  return activateTournamentLicense(
    createMemoryDemoStore(world, { beforeMutate: hooks?.beforeMutate }),
    {
      tournamentId: 7,
      nextStatus: "active",
      grantedBy: "master",
      actorLabel: "super_admin",
      authorized: true,
      recordGrant: true,
      ...overrides,
    },
    { failAfterApply: hooks?.failAfterApply },
  );
}

describe("trial to live license removes loaded demo data", () => {
  it("removes the loaded demo and marks the license active", async () => {
    const world = worldWithDemo();
    const result = await grant(world);

    expect(result.demoRemoved).toBe(true);
    expect(result.demoSessionId).toBe("demo-session-1");
    expect(world.tournament?.licenseStatus).toBe("active");
    expect(world.tournament?.licenseGrantedBy).toBe("master");
    expect(world.tournament?.licenseGrantedAt).toEqual(expect.any(String));
    expect(world.teams.map((team) => team.id)).toEqual([2]);
    expect(world.players.map((player) => player.id)).toEqual([20]);
    expect(world.players[0]?.status).toBe("sold");
    expect(world.players[0]?.photoUrl).toBe("https://cdn.example/original-player.png");
    expect(world.bids).toEqual([{ id: 1, tournamentId: 7, playerId: 20, teamId: 2, amount: 40 }]);
    expect(world.tournament?.sponsorLogos).toEqual([
      { url: "https://cdn.example/original-sponsor.png", name: "Original Sponsor" },
    ]);
    expect(world.tournament?.settings.basePurse).toBe(250);
    expect(world.tournament?.settings.minBid).toBe(10);
    expect(ownerCredentialWorks(world, "ORIG-1")).toBe(true);
    expect(ownerCredentialWorks(world, "DEMO-ACCESS", "owner-demo-1")).toBe(false);
    expect(world.session?.status).toBe("reset");
  });

  it("grants live without a demo session and leaves original data unchanged", async () => {
    const world = worldWithDemo();
    world.session = null;
    world.owned = [];
    const before = structuredClone(world);
    const result = await grant(world);

    expect(result.demoRemoved).toBe(false);
    expect(world.tournament?.licenseStatus).toBe("active");
    expect(world.teams).toEqual(before.teams);
    expect(world.players).toEqual(before.players);
    expect(world.bids).toEqual(before.bids);
    expect(world.tournament?.settings.basePurse).toBe(250);
    expect(world.tournament?.resetCount).toBe(1);
  });

  it("cancels activation when demo data is referenced outside the demo", async () => {
    const world = worldWithDemo();
    world.players.find((player) => player.id === 20)!.teamId = 1;
    const snapshot = structuredClone(world);

    await expect(grant(world)).rejects.toBeInstanceOf(DemoResetConflictError);
    expect(world.tournament?.licenseStatus).toBe("trial");
    expect(world.teams.map((team) => team.id).sort()).toEqual(snapshot.teams.map((team) => team.id).sort());
    expect(world.session?.status).toBe("loaded");
  });

  it("rolls back the license and the demo cleanup when the write fails", async () => {
    const world = worldWithDemo();
    await expect(grant(world, {}, { failAfterApply: true })).rejects.toThrow("Simulated demo reset failure");
    expect(world.tournament?.licenseStatus).toBe("trial");
    expect(world.tournament?.licenseGrantedAt).toBeUndefined();
    expect(world.teams.some((team) => team.id === 1)).toBe(true);
    expect(world.session?.status).toBe("loaded");
  });

  it("refuses an unauthorised caller and a demo session for another tournament", async () => {
    const denied = worldWithDemo();
    await expect(grant(denied, { authorized: false })).rejects.toBeInstanceOf(DemoResetForbiddenError);
    expect(denied.tournament?.licenseStatus).toBe("trial");
    expect(denied.teams.some((team) => team.id === 1)).toBe(true);

    const mismatched = worldWithDemo();
    mismatched.session!.tournamentId = 99;
    await expect(grant(mismatched)).rejects.toBeInstanceOf(DemoResetForbiddenError);
    expect(mismatched.tournament?.licenseStatus).toBe("trial");
    expect(mismatched.teams.some((team) => team.id === 1)).toBe(true);
  });

  it("does not clean demo data when the tournament is already live", async () => {
    const world = worldWithDemo();
    world.tournament!.licenseStatus = "active";
    const result = await grant(world);

    expect(result.demoRemoved).toBe(false);
    expect(world.teams.some((team) => team.id === 1)).toBe(true);
    expect(world.session?.status).toBe("loaded");
    expect(world.tournament?.resetCount).toBe(1);
  });

  it("keeps a later bid on original data and drops a bid that lands on demo data before cleanup", async () => {
    const world = worldWithDemo();
    const result = await grant(world, {}, {
      beforeMutate: () => {
        world.bids.push({ id: 77, tournamentId: 7, playerId: 20, teamId: 2, amount: 50 });
        world.bids.push({ id: 78, tournamentId: 7, playerId: 11, teamId: 1, amount: 35 });
      },
    });

    expect(result.demoRemoved).toBe(true);
    expect(world.tournament?.licenseStatus).toBe("active");
    expect(world.bids.map((bid) => bid.id).sort()).toEqual([1, 77]);
  });

  it("serializes a second live grant behind an in-progress cleanup", () => {
    _resetAuctionCleanupLocksForTests();
    const held = tryBeginAuctionCleanup(7);
    expect(held).not.toBeNull();
    expect(tryBeginAuctionCleanup(7)).toBeNull();
    expect(isAuctionCleanupInProgress(7)).toBe(true);
    held?.release();
    expect(isAuctionCleanupInProgress(7)).toBe(false);
  });

  it("does not repeat demo removal or bump reset count on a second grant", async () => {
    const world = worldWithDemo();
    const first = await grant(world);
    const resetCount = world.tournament?.resetCount;
    const second = await grant(world);

    expect(first.demoRemoved).toBe(true);
    expect(second.demoRemoved).toBe(false);
    expect(world.tournament?.resetCount).toBe(resetCount);
    expect(world.players.map((player) => player.id)).toEqual([20]);
    expect(world.teams.map((team) => team.id)).toEqual([2]);
  });

  it("still follows the practice reset when no demo remains, and payment grant does not stamp licenseGrantedAt", async () => {
    const world = emptyDemoWorld({
      id: 7,
      organizerId: 42,
      licenseStatus: "trial",
      resetCount: 1,
      settings: { basePurse: 100, minBid: 10, status: "setup" },
      sponsorLogos: [{ url: "https://cdn.example/original-sponsor.png", name: "Original Sponsor" }],
    });
    world.teams.push({
      id: 2,
      tournamentId: 7,
      name: "Original Lions",
      logoUrl: "https://cdn.example/original-team.png",
      accessCode: "ORIG-1",
      purseUsed: 0,
    });
    await grant(world, { recordGrant: false, scoringEnabled: true, touchUpdatedAt: true });
    expect(world.tournament?.licenseStatus).toBe("active");
    expect(world.tournament?.licenseGrantedAt).toBeUndefined();
    expect(world.tournament?.scoringEnabled).toBe(true);
    expect(world.tournament?.updatedAt).toEqual(expect.any(String));

    const practice = await commitDemoCleanup(
      createMemoryDemoStore(world),
      { tournamentId: 7, actorOrganizerId: 42, actorLabel: "operator" },
    );
    expect(practice.mode).toBe("practice");
    expect(world.teams.map((team) => team.id)).toEqual([2]);
    expect(world.tournament?.sponsorLogos[0]?.url).toBe("https://cdn.example/original-sponsor.png");
  });
});
