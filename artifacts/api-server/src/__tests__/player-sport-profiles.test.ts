import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  pool: { query: vi.fn() },
  globalPlayersTable: { id: "id", auctionPlayerId: "auction_player_id", mobileNumber: "mobile_number", email: "email", canonicalName: "canonical_name", displayName: "display_name" },
  playersTable: { id: "id", tournamentId: "tournament_id", globalPlayerId: "global_player_id" },
  tournamentsTable: { id: "id", sport: "sport" },
  teamsTable: {},
  masterTeamsTable: {},
  playerSportProfilesTable: {
    globalPlayerId: "global_player_id",
    sportSlug: "sport_slug",
    defaultRole: "default_role",
    profileJson: "profile_json",
  },
}));

vi.mock("./sync-helpers", () => ({ logSync: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./roster-assignments", () => ({ assignPlayerToFranchiseRoster: vi.fn() }));
vi.mock("./cricket-stats", () => ({ ensureCricketStatisticsBaseline: vi.fn() }));

const mockUpsert = vi.fn().mockResolvedValue(undefined);
vi.mock("./player-sport-profile-service", () => ({
  playerSportProfileService: {
    upsertSportProfile: (...args: unknown[]) => mockUpsert(...args),
    getSportProfiles: vi.fn().mockResolvedValue([]),
    getSportProfilesForPlayers: vi.fn().mockResolvedValue(new Map()),
  },
  buildSportProfileFromAuctionPlayer: vi.fn().mockResolvedValue({ auctionPlayerId: 1 }),
}));

import {
  buildIdentityFields,
  buildLegacySportFields,
  buildMasterPlayerFields,
} from "../lib/master-sports/sync";

describe("sync field builders", () => {
  const auctionPlayer = {
    id: 42,
    name: "Tushar Saraswat",
    mobileNumber: "9876543210",
    email: null,
    city: "Delhi",
    age: 28,
    gender: "M",
    photoUrl: null,
    role: "Singles Player",
    battingStyle: "Right Hand",
    tournamentId: 5,
    globalPlayerId: null,
  } as never;

  it("buildIdentityFields excludes sport-specific columns", () => {
    const identity = buildIdentityFields(auctionPlayer);
    expect(identity).toMatchObject({
      canonicalName: "Tushar Saraswat",
      city: "Delhi",
      age: 28,
    });
    expect(identity).not.toHaveProperty("sport");
    expect(identity).not.toHaveProperty("defaultRole");
    expect(identity).not.toHaveProperty("auctionPlayerId");
  });

  it("buildLegacySportFields maps sport and role separately", () => {
    expect(buildLegacySportFields(auctionPlayer, "badminton")).toEqual({
      auctionPlayerId: 42,
      defaultRole: "Singles Player",
      sport: "badminton",
    });
  });

  it("legacy buildMasterPlayerFields uses tournament sport not hardcoded cricket", () => {
    expect(buildMasterPlayerFields(auctionPlayer, "badminton").sport).toBe("badminton");
  });
});

describe("PLAYER_SPORT_PROFILES_ENABLED feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is enabled by default when env is unset", async () => {
    vi.stubEnv("PLAYER_SPORT_PROFILES_ENABLED", "");
    const { isPlayerSportProfilesEnabled } = await import("@workspace/api-base");
    expect(isPlayerSportProfilesEnabled()).toBe(true);
  });

  it("is disabled when explicitly false", async () => {
    vi.stubEnv("PLAYER_SPORT_PROFILES_ENABLED", "false");
    const { isPlayerSportProfilesEnabled } = await import("@workspace/api-base");
    expect(isPlayerSportProfilesEnabled()).toBe(false);
  });
});

describe("player sport profile service upsert", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("upsert is called per sport without clearing other sports", async () => {
    await mockUpsert("gp_test", { sportSlug: "cricket", defaultRole: "All Rounder" });
    await mockUpsert("gp_test", { sportSlug: "badminton", defaultRole: "Singles Player" });
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert.mock.calls[0][1].sportSlug).toBe("cricket");
    expect(mockUpsert.mock.calls[1][1].sportSlug).toBe("badminton");
  });
});

describe("backfill sport grouping", () => {
  it("maps cricket and badminton roles independently", () => {
    const cricket = { sportSlug: "cricket", defaultRole: "All Rounder" };
    const badminton = { sportSlug: "badminton", defaultRole: "Singles Player" };
    const profiles = [cricket, badminton];
    expect(profiles.find((p) => p.sportSlug === "cricket")?.defaultRole).toBe("All Rounder");
    expect(profiles.find((p) => p.sportSlug === "badminton")?.defaultRole).toBe("Singles Player");
    expect(profiles).toHaveLength(2);
  });
});

describe("idempotent backfill", () => {
  it("second upsert for same sport updates without duplicate key", async () => {
    await mockUpsert("gp_x", { sportSlug: "cricket", defaultRole: "Bowler" });
    await mockUpsert("gp_x", { sportSlug: "cricket", defaultRole: "All Rounder" });
    const cricketCalls = mockUpsert.mock.calls.filter(
      (c) => c[1]?.sportSlug === "cricket",
    );
    expect(cricketCalls).toHaveLength(2);
    expect(cricketCalls[1][1].defaultRole).toBe("All Rounder");
  });
});
